import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { toTitleCase, formatCurrency } from "@/lib/utils";

const NOTIFICATIONS_COLLECTION = "admin_notifications";
const READ_IDS_KEY = "mk_admin_read_notification_ids";
const DISMISSED_IDS_KEY = "mk_admin_dismissed_notification_ids";

// Notifications automatically expire after 2 days (48 hours)
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

function getStoredIdSet(key) {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveStoredIdSet(key, set) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // Ignore storage quota errors
  }
}

export function parseTimestamp(val) {
  if (!val) return null;
  if (typeof val.toDate === "function") return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Checks if a date falls strictly within the last 48 hours (2 days).
 * Any event older than 48 hours is automatically discarded.
 */
export function isWithinTwoDays(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return false;
  const age = Date.now() - date.getTime();
  // Allow up to 5 minutes of client clock skew into the future
  return age >= -300000 && age <= TWO_DAYS_MS;
}

/**
 * Creates an explicit persistent admin notification in Firestore.
 */
export async function createAdminNotification({ title, description, type = "system", link = "/super-admin" }) {
  if (!isFirebaseConfigured || !db) return null;
  try {
    const colRef = collection(db, NOTIFICATIONS_COLLECTION);
    const docRef = await addDoc(colRef, {
      title,
      description,
      type,
      link,
      createdAt: serverTimestamp(),
      read: false,
    });
    return docRef.id;
  } catch (err) {
    console.warn("Failed to create admin notification:", err);
    return null;
  }
}

/**
 * Real-time subscription to actual live system notifications across:
 * 1. Admin notifications collection (system/admin events within 2 days)
 * 2. Real incoming orders (orders placed/delivered within 2 days)
 * 3. Registered chefs / active cooks (within 2 days)
 * 4. Newly registered societies (within 2 days)
 *
 * Rules:
 * - Strictly excludes events older than 2 days.
 * - Societies: only notify ONCE at initial registration (no loops or recurring 'Society Active' alerts).
 * - Status changes (enabled/disabled): logged as discrete single events via createAdminNotification.
 */
export function subscribeToAdminNotifications(callback) {
  if (!isFirebaseConfigured || !db) {
    callback([], 0);
    return () => {};
  }

  let explicitNotifs = [];
  let ordersList = [];
  let chefsList = [];
  let societiesList = [];

  const updateSubscribers = () => {
    const readIds = getStoredIdSet(READ_IDS_KEY);
    const dismissedIds = getStoredIdSet(DISMISSED_IDS_KEY);
    const combined = [];

    // 1. Explicit admin notifications from Firestore (Status changes, broadcasts, admin alerts)
    explicitNotifs.forEach((docSnap) => {
      const data = docSnap.data();
      const date = parseTimestamp(data.createdAt);
      if (!date || !isWithinTwoDays(date)) return;

      const id = docSnap.id;
      if (dismissedIds.has(id)) return;

      combined.push({
        id,
        title: data.title || "System Alert",
        description: data.description || "",
        type: data.type || "system",
        link: data.link || "/super-admin",
        timestamp: date,
        read: Boolean(data.read || readIds.has(id)),
      });
    });

    // 2. Real Orders (within the last 2 days)
    ordersList.forEach((order) => {
      const date = parseTimestamp(order.createdAt || order.timestamp || order.date);
      if (!date || !isWithinTwoDays(date)) return;

      const id = `ord_${order.id}`;
      if (dismissedIds.has(id)) return;

      const amount = Number(order.totalAmount || order.amount || order.itemTotal || 0);
      const society = order.deliveryAddress?.societyName || order.societyName || "Society";
      const cust = order.customerName || order.userName || "Customer";
      const ordNum = order.orderNumber || `#${order.id.slice(0, 8)}`;

      let title = `Order Placed ${ordNum}`;
      let description = `${cust} placed an order of ${formatCurrency(amount)} in ${society}.`;

      if (order.status === "delivered") {
        title = `Order Delivered ${ordNum}`;
        description = `Order for ${cust} (${formatCurrency(amount)}) was delivered in ${society}.`;
      } else if (order.status === "cancelled" || order.status === "rejected") {
        title = `Order Cancelled ${ordNum}`;
        description = `Order ${ordNum} in ${society} was cancelled${order.rejectionReason ? `: ${order.rejectionReason}` : "."}`;
      }

      combined.push({
        id,
        title,
        description,
        type: "order",
        link: "/super-admin/reports",
        timestamp: date,
        read: readIds.has(id),
      });
    });

    // 3. Real Chefs (only newly registered within the last 2 days)
    chefsList.forEach((chef) => {
      const regDate = parseTimestamp(chef.createdAt);
      if (regDate && isWithinTwoDays(regDate)) {
        const regId = `chef_reg_${chef.id}`;
        if (!dismissedIds.has(regId)) {
          const name = toTitleCase(chef.fullName || chef.name || "Home Cook");
          const chefCode = chef.chefId || chef.id;
          const soc = toTitleCase(chef.baseSociety || chef.area || "Pune");
          const isSeller = String(chef.role || "").toLowerCase().includes("marketplace") || String(chef.role || "").toLowerCase().includes("seller");

          combined.push({
            id: regId,
            title: `New ${isSeller ? "Seller" : "Chef"} Registered: ${name}`,
            description: `${name} (${chefCode}) registered for home kitchen cooking in ${soc}.`,
            type: "chef",
            link: "/super-admin/chefs",
            timestamp: regDate,
            read: readIds.has(regId),
          });
        }
      }

      // Recent Online Activity (only if login was within the last 2 days)
      if (chef.isActive && chef.lastLoginAt) {
        const actDate = parseTimestamp(chef.lastLoginAt);
        if (actDate && isWithinTwoDays(actDate)) {
          const actId = `chef_active_${chef.id}_${Math.floor(actDate.getTime() / (3600000 * 24))}`;
          if (!dismissedIds.has(actId)) {
            const name = toTitleCase(chef.fullName || chef.name || "Home Cook");
            const soc = toTitleCase(chef.baseSociety || "assigned zone");

            combined.push({
              id: actId,
              title: `Chef Online & Active: ${name}`,
              description: `${name} is currently accepting live food orders in ${soc}.`,
              type: "chef",
              link: "/super-admin/chefs",
              timestamp: actDate,
              read: readIds.has(actId),
            });
          }
        }
      }
    });

    // 4. Real Societies (strictly at registration time, only within last 2 days — NO duplicate loops)
    societiesList.forEach((soc) => {
      // Must have an explicit createdAt within 2 days to count as a new registration
      const regDate = parseTimestamp(soc.createdAt);
      if (!regDate || !isWithinTwoDays(regDate)) return;

      const id = `soc_reg_${soc.id}`;
      if (dismissedIds.has(id)) return;

      const name = toTitleCase(soc.name || "Residential Hub");
      const wings = soc.wings?.length || soc.numberOfWings || 1;
      const area = soc.area ? `${toTitleCase(soc.area)}, ` : "";
      const city = toTitleCase(soc.city || "Pune");

      combined.push({
        id,
        title: `New Society Registered: ${name}`,
        description: `${name} registered with ${wings} ${wings === 1 ? "wing" : "wings"} in ${area}${city}.`,
        type: "society",
        link: "/super-admin/society",
        timestamp: regDate,
        read: readIds.has(id),
      });
    });

    // Sort descending by timestamp (newest first)
    combined.sort((a, b) => b.timestamp - a.timestamp);

    // Filter to max 30 recent valid alerts
    const recentNotifications = combined.slice(0, 30);
    const unreadCount = recentNotifications.filter((n) => !n.read).length;

    callback(recentNotifications, unreadCount);
  };

  // Subscriptions to live collections
  const unsubNotifs = onSnapshot(
    collection(db, NOTIFICATIONS_COLLECTION),
    (snap) => {
      explicitNotifs = snap.docs;
      updateSubscribers();
    },
    () => {}
  );

  const unsubOrders = onSnapshot(
    collection(db, "orders"),
    (snap) => {
      ordersList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      updateSubscribers();
    },
    () => {}
  );

  const unsubChefs = onSnapshot(
    collection(db, "chefs"),
    (snap) => {
      chefsList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      updateSubscribers();
    },
    () => {}
  );

  const unsubSocieties = onSnapshot(
    collection(db, "societies"),
    (snap) => {
      societiesList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      updateSubscribers();
    },
    () => {}
  );

  // Cross-tab storage sync
  const handleStorageChange = (e) => {
    if (e.key === READ_IDS_KEY || e.key === DISMISSED_IDS_KEY) {
      updateSubscribers();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorageChange);
  }

  return () => {
    unsubNotifs();
    unsubOrders();
    unsubChefs();
    unsubSocieties();
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorageChange);
    }
  };
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationAsRead(id) {
  const readIds = getStoredIdSet(READ_IDS_KEY);
  readIds.add(id);
  saveStoredIdSet(READ_IDS_KEY, readIds);

  if (!id.startsWith("ord_") && !id.startsWith("chef_") && !id.startsWith("soc_") && isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, NOTIFICATIONS_COLLECTION, id);
      await updateDoc(docRef, { read: true });
    } catch {
      // Ignore
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("storage"));
  }
}

/**
 * Mark all current notifications as read.
 */
export async function markAllNotificationsAsRead(notifications) {
  const readIds = getStoredIdSet(READ_IDS_KEY);
  (notifications || []).forEach((n) => {
    readIds.add(n.id);
  });
  saveStoredIdSet(READ_IDS_KEY, readIds);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("storage"));
  }
}

/**
 * Dismiss / delete a single notification.
 */
export function dismissNotification(id) {
  const dismissedIds = getStoredIdSet(DISMISSED_IDS_KEY);
  dismissedIds.add(id);
  saveStoredIdSet(DISMISSED_IDS_KEY, dismissedIds);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("storage"));
  }
}

/**
 * Clear all notifications.
 */
export function clearAllNotifications(notifications) {
  const dismissedIds = getStoredIdSet(DISMISSED_IDS_KEY);
  (notifications || []).forEach((n) => {
    dismissedIds.add(n.id);
  });
  saveStoredIdSet(DISMISSED_IDS_KEY, dismissedIds);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("storage"));
  }
}

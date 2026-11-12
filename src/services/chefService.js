import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { db, firebaseConfig, isFirebaseConfigured } from "@/lib/firebase";

const COLLECTION_NAME = "users";

/**
 * Creates a Firebase Authentication account for the chef on a secondary Firebase app.
 * This guarantees the Super Admin's active session is NOT interrupted or logged out.
 * Priority:
 * 1. If chef provides a valid email (e.g. sunita@gmail.com), use it directly.
 * 2. If email is blank or missing, fallback to synthetic email: <cleanMobile>@motherskitchen.com
 */
export async function createChefAuthAccount({ email, mobileNumber, password, fullName }) {
  const cleanMobile = (mobileNumber || "").replace(/\D/g, "");
  const trimmedEmail = (email || "").trim().toLowerCase();
  const hasValidEmail = Boolean(trimmedEmail && trimmedEmail.includes("@") && trimmedEmail.includes("."));
  const authEmail = hasValidEmail ? trimmedEmail : (cleanMobile ? `${cleanMobile}@motherskitchen.com` : "");

  if (!authEmail) {
    return { uid: null, authEmail: "", error: "Missing or invalid email/mobile number" };
  }

  try {
    const secondaryAppName = "MotherKitchenChefProvisioner";
    const existingApps = getApps();
    const secondaryApp =
      existingApps.find((a) => a.name === secondaryAppName) ||
      initializeApp(firebaseConfig, secondaryAppName);

    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, authEmail, password);

    if (fullName && cred.user) {
      try {
        await updateProfile(cred.user, { displayName: fullName });
      } catch (profileErr) {
        console.warn("Could not set displayName on chef auth account:", profileErr);
      }
    }

    return {
      uid: cred.user.uid,
      authEmail,
      success: true,
    };
  } catch (err) {
    if (err.code === "auth/email-already-in-use") {
      console.info(`Chef auth account already exists for ${authEmail}`);
      return { uid: null, authEmail, alreadyExists: true };
    }
    console.warn("Chef Firebase Auth creation note:", err.message);
    return { uid: null, authEmail, error: err.message };
  }
}

/**
 * Subscribes to live real-time updates for Chefs.
 * Returns only data present in the database.
 * Uses two clean fields:
 *   isActive         — controlled by chef mobile app (self-deactivation)
 *   isDeactivatedByAdmin — controlled by Super Admin dashboard
 */
export function subscribeToChefs(callback, onError) {
  if (!isFirebaseConfigured || !db) {
    callback([], true);
    return () => {};
  }

  const colRef = collection(db, COLLECTION_NAME);

  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        callback([], true /* isEmptyInFirestore */);
        return;
      }

      const list = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const cleanMobile = (data.mobileNumber || "").replace(/\D/g, "");

        // Single source of truth:
        // 1. If data.isActive is explicitly true in Firestore, the chef IS ACTIVE on the app!
        const isActive = Boolean(data.isActive);
        // 2. A chef is only considered admin-deactivated if isDeactivatedByAdmin is true AND isActive is false.
        // If a chef became active again on the app, admin deactivation is automatically superseded.
        const isDeactivated = Boolean(data.isDeactivatedByAdmin) && !isActive;
        // Account approval status must strictly be 'enabled' or 'disabled' (NEVER 'offline', which is just isActive: false)
        const accountStatus = isDeactivated ? "disabled" : "enabled";

        // Auto-heal legacy or invalid statuses in Firestore so mobile app is never blocked
        if (data.status === "offline" || (data.isActive === true && (data.isDeactivatedByAdmin === true || data.status === "disabled"))) {
          updateDoc(docSnap.ref, {
            isDeactivatedByAdmin: false,
            status: "enabled",
            updatedAt: serverTimestamp(),
          }).catch((err) => console.warn("Auto-heal isDeactivatedByAdmin error:", err));
        }

        return {
          id: docSnap.id,
          ...data,
          role: data.role || "chef",
          fullName: data.fullName || data.name || "Chef",
          isActive,
          isDeactivatedByAdmin: isDeactivated,
          status: accountStatus,
          loginMobile: data.loginMobile || cleanMobile,
          authEmail: data.authEmail || (cleanMobile ? `${cleanMobile}@motherskitchen.com` : ""),
          password: data.password || data.defaultPassword || "",
          defaultPassword: data.defaultPassword || data.password || "",
          assignedSocieties: Array.isArray(data.assignedSocieties) ? data.assignedSocieties : [],
          activeDeliverableSocieties: (() => {
            const assignedList = Array.isArray(data.assignedSocieties) ? data.assignedSocieties : [];
            const rawActive = Array.isArray(data.activeDeliverableSocieties)
              ? data.activeDeliverableSocieties
              : Array.isArray(data.deliverableSocieties)
              ? data.deliverableSocieties.filter((s) => typeof s === "string" && !s.startsWith("soc_"))
              : assignedList;
            // Strict Invariant: Active deliverable societies must be approved by Admin in assignedSocieties
            return rawActive.filter((s) =>
              assignedList.some((as) => (as || "").trim().toLowerCase() === (s || "").trim().toLowerCase())
            );
          })(),
          ordersToday: Number(data.ordersToday || 0),
          rating: Number(data.rating || 5.0),
        };
      });

      // Sort by createdAt descending robustly
      list.sort((a, b) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime() || 0;
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime() || 0;
        return tB - tA;
      });

      callback(list, false);
    },
    (error) => {
      console.warn("Firestore chefs subscription error:", error);
      if (onError) onError(error);
      callback([], true);
    }
  );
}

/**
 * Calculates next sequential ID based on user role:
 * - Chef: CHEF_001, CHEF_002, ...
 * - Seller: SELLER_001, SELLER_002, ...
 */
export async function getNextUserId(role = "chef") {
  const isSeller = role === "seller" || role === "marketplace";
  const prefix = isSeller ? "SELLER" : "CHEF";

  if (!isFirebaseConfigured || !db) {
    return `${prefix}_001`;
  }

  const regex = new RegExp(`^${prefix}_(\\d+)$`, "i");

  try {
    const snap = await getDocs(collection(db, COLLECTION_NAME));
    let maxNum = 0;

    snap.forEach((d) => {
      const match = d.id.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });

    const nextNum = maxNum + 1;
    return `${prefix}_${String(nextNum).padStart(3, "0")}`;
  } catch (err) {
    console.error(`Error generating next ${prefix} ID:`, err);
    return `${prefix}_${Date.now().toString().slice(-4)}`;
  }
}

export async function getNextChefId(role = "chef") {
  return getNextUserId(role);
}

/**
 * Synchronizes user data into societies/{societyId}/users/{userId}
 * and updates totalChefs and totalSellers on society documents concurrently for fast response.
 */
export async function syncChefToSocieties(userId, userData, assignedSocieties, baseSociety) {
  if (!isFirebaseConfigured || !db) return;

  try {
    const societiesSnap = await getDocs(collection(db, "societies"));
    const allAssigned = Array.from(new Set([...(assignedSocieties || []), baseSociety].filter(Boolean)));
    const cleanMobile = (userData.mobileNumber || "").replace(/\D/g, "");
    const role = userData.role === "marketplace" ? "seller" : (userData.role || "chef");

    // Process all societies concurrently using Promise.all
    await Promise.all(
      societiesSnap.docs.map(async (socDoc) => {
        const socData = socDoc.data();
        const socName = socData.name;
        const socId = socDoc.id;

        const isAssigned = allAssigned.some(
          (nameOrId) => nameOrId === socName || nameOrId === socId
        );

        const subColDocRef = doc(db, "societies", socId, "users", userId);

        if (isAssigned) {
          const isDeactivated = Boolean(userData.isDeactivatedByAdmin);
          const isActive = isDeactivated ? false : userData.isActive !== false;

          // Add or update user in this society's users subcollection
          await setDoc(
            subColDocRef,
            {
              userId,
              id: userId,
              role,
              fullName: userData.fullName || userData.name,
              name: userData.fullName || userData.name,
              mobileNumber: userData.mobileNumber || "",
              loginMobile: cleanMobile,
              email: userData.email || "",
              authEmail: userData.authEmail || (cleanMobile ? `${cleanMobile}@motherskitchen.com` : ""),
              photoUrl: userData.photoUrl || "",
              baseSociety: userData.baseSociety || "",
              isActive,
              isDeactivatedByAdmin: isDeactivated,
              status: isDeactivated ? "disabled" : "enabled",
              assignedAt: serverTimestamp(),
            },
            { merge: true }
          );

          // Re-count users in this assigned society's subcollection to update totalChefs and totalSellers
          try {
            const subSnap = await getDocs(collection(db, "societies", socId, "users"));
            const chefsCount = subSnap.docs.filter((d) => (d.data().role || "chef") === "chef").length;
            const sellersCount = subSnap.docs.filter((d) => d.data().role === "seller" || d.data().role === "marketplace").length;
            await updateDoc(doc(db, "societies", socId), {
              totalChefs: chefsCount,
              totalSellers: sellersCount,
              totalUsers: subSnap.size,
              updatedAt: serverTimestamp(),
            });
          } catch (countErr) {
            console.warn("Could not recount users for society:", socId, countErr);
          }
        } else {
          // Remove if previously assigned
          try {
            await deleteDoc(subColDocRef);
          } catch {}
        }
      })
    );
  } catch (err) {
    console.error("Error syncing user to societies subcollections:", err);
  }
}

/**
 * Registers a new Chef / Seller in Firestore in the users collection
 * with sequential CHEF_001 or SELLER_001 format,
 * creates Firebase Auth credentials via secondary instance without signing out Admin,
 * and allocates the user into societies/{societyId}/users subcollections.
 */
export async function createChef(data) {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured.");
  }

  if (data.photoUrl && data.photoUrl.startsWith("data:")) {
    throw new Error("Base64 photos cannot be saved directly to Firestore. Please upload to Cloud Storage.");
  }

  const role = data.role === "marketplace" ? "seller" : (data.role || "chef");
  const userId = data.id || await getNextUserId(role);
  const userRef = doc(db, COLLECTION_NAME, userId);

  const assignedSocieties = data.assignedSocieties || [];
  const baseSociety = data.baseSociety || "";
  const cleanMobile = (data.mobileNumber || "").replace(/\D/g, "");
  const defaultPassword = data.defaultPassword || "123456";
  const userEmail = data.email?.trim().toLowerCase() || "";

  // Provision in Firebase Authentication (Priority: real email -> fallback: <mobile>@motherskitchen.com)
  const authResult = await createChefAuthAccount({
    email: userEmail,
    mobileNumber: cleanMobile,
    password: defaultPassword,
    fullName: data.fullName.trim(),
  });

  const userDocData = {
    userId,
    id: userId,
    chefId: userId,
    role,
    fullName: data.fullName.trim(),
    name: data.fullName.trim(),
    mobileNumber: data.mobileNumber.trim(),
    loginMobile: cleanMobile,
    email: userEmail,
    authEmail: authResult.authEmail,
    authUid: authResult.uid || "",
    password: defaultPassword,
    defaultPassword: defaultPassword,
    address: data.address.trim(),
    baseSociety,
    assignedSocieties,
    activeDeliverableSocieties: assignedSocieties,
    idCardNumber: data.idCardNumber?.trim() || "",
    photoUrl: data.photoUrl || "",
    idCardUrl: data.idCardUrl || "",
    // Two clean status fields — all legacy fields removed
    isActive: true,              // mobile app: user activates/deactivates themselves
    isDeactivatedByAdmin: false, // admin dashboard: blocks user even if isActive is true
    rating: 5.0,
    ordersToday: 0,
    totalOrders: 0,
    totalRevenue: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(userRef, userDocData);

  // Sync into subcollections under matching societies in background (non-blocking for fast UI response)
  syncChefToSocieties(userId, userDocData, assignedSocieties, baseSociety).catch((syncErr) =>
    console.warn("Background syncChefToSocieties warning:", syncErr)
  );

  return { id: userId, ...userDocData };
}

/**
 * Updates an existing Chef in Firestore and updates society subcollections.
 */
export async function updateChef(chefId, data) {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured.");
  }

  if (data.photoUrl && data.photoUrl.startsWith("data:")) {
    throw new Error("Base64 photos cannot be saved directly to Firestore. Please upload to Cloud Storage.");
  }

  const docRef = doc(db, COLLECTION_NAME, chefId);
  const assignedSocieties = data.assignedSocieties || [];
  const baseSociety = data.baseSociety || "";
  const cleanMobile = (data.mobileNumber || "").replace(/\D/g, "");

  // Read existing doc to sanitize activeDeliverableSocieties & societyDeliveryStatus
  let existingActive = [];
  let existingDeliveryStatus = {};
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const existing = snap.data();
      existingActive = Array.isArray(existing.activeDeliverableSocieties)
        ? existing.activeDeliverableSocieties
        : Array.isArray(existing.deliverableSocieties)
        ? existing.deliverableSocieties
        : [];
      existingDeliveryStatus = existing.societyDeliveryStatus || {};
    }
  } catch (err) {
    console.warn("Could not read current activeDeliverableSocieties for reconciliation:", err);
  }

  // Strict Invariant: activeDeliverableSocieties must strictly be a subset of approved assignedSocieties.
  // Any society removed by admin from assignedSocieties is automatically pruned from activeDeliverableSocieties!
  const baseActive = Array.isArray(data.activeDeliverableSocieties)
    ? data.activeDeliverableSocieties
    : (existingActive.length > 0 ? existingActive : assignedSocieties);

  const sanitizedActive = baseActive.filter((s) =>
    assignedSocieties.some((as) => (as || "").trim().toLowerCase() === (s || "").trim().toLowerCase())
  );

  // Also clean up societyDeliveryStatus toggle map
  const sanitizedDeliveryStatus = {};
  if (existingDeliveryStatus && typeof existingDeliveryStatus === "object") {
    Object.entries(existingDeliveryStatus).forEach(([key, val]) => {
      const isApproved = assignedSocieties.some(
        (as) =>
          (as || "").trim().toLowerCase() === (key || "").trim().toLowerCase() ||
          `soc_${as.trim().toLowerCase().replace(/\s+/g, "_")}` === key.toLowerCase()
      );
      if (isApproved) {
        sanitizedDeliveryStatus[key] = val;
      }
    });
  }

  const updatePayload = {
    fullName: data.fullName.trim(),
    name: data.fullName.trim(),
    role: data.role || "chef",
    mobileNumber: data.mobileNumber.trim(),
    loginMobile: cleanMobile,
    email: data.email?.trim().toLowerCase() || "",
    address: data.address.trim(),
    baseSociety,
    assignedSocieties,
    activeDeliverableSocieties: sanitizedActive,
    deliverableSocieties: sanitizedActive,
    societyDeliveryStatus: sanitizedDeliveryStatus,
    idCardNumber: data.idCardNumber?.trim() || "",
    photoUrl: data.photoUrl || "",
    idCardUrl: data.idCardUrl || "",
    updatedAt: serverTimestamp(),
  };

  // If password was edited/reset
  if (data.defaultPassword && data.defaultPassword !== "••••••••") {
    updatePayload.password = data.defaultPassword;
    updatePayload.defaultPassword = data.defaultPassword;
  }

  if (data.isDeactivatedByAdmin !== undefined) {
    const isDeactivated = Boolean(data.isDeactivatedByAdmin);
    updatePayload.isDeactivatedByAdmin = isDeactivated;
    if (isDeactivated) {
      updatePayload.isActive = false;
      updatePayload.status = "disabled";
    } else {
      updatePayload.status = "enabled";
      if (data.isActive !== undefined) {
        updatePayload.isActive = Boolean(data.isActive);
      }
    }
  } else if (data.isActive !== undefined) {
    updatePayload.isActive = Boolean(data.isActive);
  }

  // Double check invariant: if admin deactivated, isActive is ALWAYS false
  if (updatePayload.isDeactivatedByAdmin) {
    updatePayload.isActive = false;
    updatePayload.status = "disabled";
  }
  if (data.flatNumber !== undefined) updatePayload.flatNumber = data.flatNumber;
  if (data.floor !== undefined) updatePayload.floor = data.floor;
  if (data.wing !== undefined) updatePayload.wing = data.wing;
  if (data.street !== undefined) updatePayload.street = data.street;
  if (data.city !== undefined) updatePayload.city = data.city;
  if (data.area !== undefined) updatePayload.area = data.area;
  if (data.aadharNumber !== undefined) updatePayload.aadharNumber = data.aadharNumber;

  await updateDoc(docRef, updatePayload);

  // Sync into subcollections under matching societies in background
  syncChefToSocieties(chefId, updatePayload, assignedSocieties, baseSociety).catch((syncErr) =>
    console.warn("Background syncChefToSocieties update warning:", syncErr)
  );
}

/**
 * Directly updates isDeactivatedByAdmin and/or isActive on a chef document in Firestore.
 * These two fields are the single source of truth for chef account status:
 * - isDeactivatedByAdmin: controlled exclusively by Super Admin.
 * - isActive: chef app availability / daily active status.
 *
 * Invariant:
 * When isDeactivatedByAdmin is true, isActive is strictly forced to false.
 */
export async function updateChefStatus(chefId, { isDeactivatedByAdmin, isActive }) {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured.");
  }

  const docRef = doc(db, COLLECTION_NAME, chefId);
  const updateData = {
    updatedAt: serverTimestamp(),
  };

  if (isDeactivatedByAdmin !== undefined) {
    const deactivated = Boolean(isDeactivatedByAdmin);
    updateData.isDeactivatedByAdmin = deactivated;
    if (deactivated) {
      updateData.isActive = false;
      updateData.status = "disabled";
    } else {
      updateData.status = "enabled";
      if (isActive !== undefined) {
        updateData.isActive = Boolean(isActive);
      }
    }
  } else if (isActive !== undefined) {
    const active = Boolean(isActive);
    updateData.isActive = active;
    if (active) {
      updateData.isDeactivatedByAdmin = false;
      updateData.status = "enabled";
    }
  }

  // Strict invariant: if admin deactivated, isActive is ALWAYS false
  if (updateData.isDeactivatedByAdmin) {
    updateData.isActive = false;
    updateData.status = "disabled";
  }

  await updateDoc(docRef, updateData);

  // Sync into subcollections under matching societies in background
  try {
    const societiesSnap = await getDocs(collection(db, "societies"));
    await Promise.all(
      societiesSnap.docs.map(async (socDoc) => {
        const subRef = doc(db, "societies", socDoc.id, "users", chefId);
        try {
          await updateDoc(subRef, updateData);
        } catch {}
      })
    );
  } catch (err) {
    console.warn("Could not sync user status to subcollections:", err);
  }

  return updateData;
}

/**
 * Toggles isDeactivatedByAdmin on the user document.
 * When true: user login is blocked and isActive becomes false.
 * When false: user is re-enabled.
 */
export async function toggleAdminDeactivation(chefId, deactivate) {
  return updateChefStatus(chefId, { isDeactivatedByAdmin: Boolean(deactivate) });
}

/**
 * Deletes a User from Firestore and removes from all societies subcollections.
 */
export async function deleteChef(chefId) {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured.");
  }

  const docRef = doc(db, COLLECTION_NAME, chefId);
  await deleteDoc(docRef);

  // Delete from all society subcollections
  try {
    const societiesSnap = await getDocs(collection(db, "societies"));
    for (const socDoc of societiesSnap.docs) {
      const subUserRef = doc(db, "societies", socDoc.id, "users", chefId);
      try {
        await deleteDoc(subUserRef);
        const subSnap = await getDocs(collection(db, "societies", socDoc.id, "users"));
        const chefsCount = subSnap.docs.filter((d) => (d.data().role || "chef") === "chef").length;
        const sellersCount = subSnap.docs.filter((d) => d.data().role === "seller" || d.data().role === "marketplace").length;
        await updateDoc(doc(db, "societies", socDoc.id), {
          totalChefs: chefsCount,
          totalSellers: sellersCount,
          totalUsers: subSnap.size,
          updatedAt: serverTimestamp(),
        });
      } catch {}
    }
  } catch (err) {
    console.warn("Could not remove user from society subcollections:", err);
  }
}

/**
 * One-time backfill/synchronizer to audit all existing users in Firestore
 * and ensure they are added into societies/{societyId}/users
 * and that each society's totalChefs/totalSellers counters reflect the correct count.
 */
export async function syncExistingChefsToSocieties() {
  if (!isFirebaseConfigured || !db) return;

  try {
    const usersSnap = await getDocs(collection(db, COLLECTION_NAME));
    const societiesSnap = await getDocs(collection(db, "societies"));

    const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    for (const socDoc of societiesSnap.docs) {
      const socData = socDoc.data();
      const socName = socData.name;
      const socId = socDoc.id;

      // Find users who have this society as their base society or allocated
      const matchingUsers = users.filter((u) => {
        const base = (u.baseSociety || "").trim().toLowerCase();
        const assigned = Array.isArray(u.assignedSocieties)
          ? u.assignedSocieties.map((s) => String(s).toLowerCase())
          : [];
        return (
          (base && (base === (socName || "").toLowerCase() || base === (socId || "").toLowerCase())) ||
          assigned.includes((socName || "").toLowerCase()) ||
          assigned.includes((socId || "").toLowerCase())
        );
      });

      // Write each matching user into subcollection
      for (const u of matchingUsers) {
        const subRef = doc(db, "societies", socId, "users", u.id);
        const role = u.role === "marketplace" ? "seller" : (u.role || "chef");
        await setDoc(
          subRef,
          {
            userId: u.id,
            id: u.id,
            role,
            fullName: u.fullName || u.name || "User",
            name: u.fullName || u.name || "User",
            mobileNumber: u.mobileNumber || "",
            email: u.email || "",
            photoUrl: u.photoUrl || "",
            baseSociety: u.baseSociety || "",
            status: u.status || "enabled",
            isActive: u.isActive !== undefined ? u.isActive : true,
            isDeactivatedByAdmin: Boolean(u.isDeactivatedByAdmin),
            assignedAt: u.createdAt || serverTimestamp(),
          },
          { merge: true }
        );
      }

      // Update counters on society doc
      const chefsCount = matchingUsers.filter((u) => (u.role || "chef") === "chef").length;
      const sellersCount = matchingUsers.filter((u) => u.role === "seller" || u.role === "marketplace").length;
      await updateDoc(doc(db, "societies", socId), {
        totalChefs: chefsCount,
        totalSellers: sellersCount,
        totalUsers: matchingUsers.length,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.error("Error in syncExistingChefsToSocieties:", err);
  }
}

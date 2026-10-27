import {
  collection,
  doc,
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

const COLLECTION_NAME = "chefs";

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
        return {
          id: docSnap.id,
          ...data,
          fullName: data.fullName || data.name || "Chef",
          // Two authoritative fields — all else ignored
          isActive: data.isActive !== false, // mobile app controls this
          isDeactivatedByAdmin: Boolean(data.isDeactivatedByAdmin), // admin controls this
          loginMobile: data.loginMobile || cleanMobile,
          authEmail: data.authEmail || (cleanMobile ? `${cleanMobile}@motherskitchen.com` : ""),
          password: data.password || data.defaultPassword || "",
          defaultPassword: data.defaultPassword || data.password || "",
          assignedSocieties: Array.isArray(data.assignedSocieties) ? data.assignedSocieties : [],
          activeDeliverableSocieties: Array.isArray(data.activeDeliverableSocieties) ? data.activeDeliverableSocieties : [],
          ordersToday: Number(data.ordersToday || 0),
          rating: Number(data.rating || 5.0),
        };
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
 * Calculates next sequential Chef ID (e.g. CHEF_001, CHEF_002, CHEF_003).
 */
export async function getNextChefId() {
  if (!isFirebaseConfigured || !db) {
    return "CHEF_001";
  }

  try {
    const snap = await getDocs(collection(db, COLLECTION_NAME));
    let maxNum = 0;

    snap.forEach((d) => {
      const match = d.id.match(/^CHEF_(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });

    const nextNum = maxNum + 1;
    return `CHEF_${String(nextNum).padStart(3, "0")}`;
  } catch (err) {
    console.error("Error generating next chef ID:", err);
    return `CHEF_${Date.now().toString().slice(-4)}`;
  }
}

/**
 * Synchronizes chef data into societies/{societyId}/chefs/{chefId}
 * and updates totalChefs on society documents concurrently for fast response.
 */
export async function syncChefToSocieties(chefId, chefData, assignedSocieties, baseSociety) {
  if (!isFirebaseConfigured || !db) return;

  try {
    const societiesSnap = await getDocs(collection(db, "societies"));
    const allAssigned = Array.from(new Set([...(assignedSocieties || []), baseSociety].filter(Boolean)));
    const cleanMobile = (chefData.mobileNumber || "").replace(/\D/g, "");

    // Process all societies concurrently using Promise.all
    await Promise.all(
      societiesSnap.docs.map(async (socDoc) => {
        const socData = socDoc.data();
        const socName = socData.name;
        const socId = socDoc.id;

        const isAssigned = allAssigned.some(
          (nameOrId) => nameOrId === socName || nameOrId === socId
        );

        const subColDocRef = doc(db, "societies", socId, "chefs", chefId);

        if (isAssigned) {
          // Add or update chef in this society's chefs subcollection
          await setDoc(
            subColDocRef,
            {
              chefId,
              fullName: chefData.fullName || chefData.name,
              name: chefData.fullName || chefData.name,
              mobileNumber: chefData.mobileNumber || "",
              loginMobile: cleanMobile,
              email: chefData.email || "",
              authEmail: chefData.authEmail || (cleanMobile ? `${cleanMobile}@motherskitchen.com` : ""),
              photoUrl: chefData.photoUrl || "",
              baseSociety: chefData.baseSociety || "",
              isActive: chefData.isActive !== false,
              isDeactivatedByAdmin: Boolean(chefData.isDeactivatedByAdmin),
              assignedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } else {
          // Remove if previously assigned
          try {
            await deleteDoc(subColDocRef);
          } catch {}
        }

        // Re-count chefs in this society's subcollection to update totalChefs accurately
        try {
          const subSnap = await getDocs(collection(db, "societies", socId, "chefs"));
          await updateDoc(doc(db, "societies", socId), {
            totalChefs: subSnap.size,
            updatedAt: serverTimestamp(),
          });
        } catch (countErr) {
          console.warn("Could not recount chefs for society:", socId, countErr);
        }
      })
    );
  } catch (err) {
    console.error("Error syncing chef to societies subcollections:", err);
  }
}

/**
 * Registers a new Chef in Firestore with sequential CHEF_001 format,
 * creates Firebase Auth credentials via secondary instance without signing out Admin,
 * and allocates the chef into societies/{societyId}/chefs subcollections.
 */
export async function createChef(data) {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured.");
  }

  const chefId = await getNextChefId();
  const chefRef = doc(db, COLLECTION_NAME, chefId);

  const assignedSocieties = data.assignedSocieties || [];
  const baseSociety = data.baseSociety || "";
  const cleanMobile = (data.mobileNumber || "").replace(/\D/g, "");
  const defaultPassword = data.defaultPassword || "Chef@1234";
  const userEmail = data.email?.trim().toLowerCase() || "";

  // Provision in Firebase Authentication (Priority: real email -> fallback: <mobile>@motherskitchen.com)
  const authResult = await createChefAuthAccount({
    email: userEmail,
    mobileNumber: cleanMobile,
    password: defaultPassword,
    fullName: data.fullName.trim(),
  });

  const chefDocData = {
    chefId,
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
    isActive: true,              // mobile app: chef activates/deactivates themselves
    isDeactivatedByAdmin: false, // admin dashboard: blocks chef even if isActive is true
    rating: 5.0,
    ordersToday: 0,
    totalOrders: 0,
    totalRevenue: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(chefRef, chefDocData);

  // Sync into subcollections under matching societies
  await syncChefToSocieties(chefId, chefDocData, assignedSocieties, baseSociety);

  return { id: chefId, ...chefDocData };
}

/**
 * Updates an existing Chef in Firestore and updates society subcollections.
 */
export async function updateChef(chefId, data) {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured.");
  }

  const docRef = doc(db, COLLECTION_NAME, chefId);
  const assignedSocieties = data.assignedSocieties || [];
  const baseSociety = data.baseSociety || "";
  const cleanMobile = (data.mobileNumber || "").replace(/\D/g, "");

  const updatePayload = {
    fullName: data.fullName.trim(),
    name: data.fullName.trim(),
    mobileNumber: data.mobileNumber.trim(),
    loginMobile: cleanMobile,
    email: data.email?.trim().toLowerCase() || "",
    address: data.address.trim(),
    baseSociety,
    assignedSocieties,
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

  await updateDoc(docRef, updatePayload);

  // Sync into subcollections under matching societies
  await syncChefToSocieties(chefId, updatePayload, assignedSocieties, baseSociety);
}

/**
 * Toggles isDeactivatedByAdmin on the chef document.
 * When true: chef login is blocked even if chef toggles isActive on the mobile app.
 * When false: chef can self-manage their isActive status again.
 */
export async function toggleAdminDeactivation(chefId, deactivate) {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured.");
  }

  await updateDoc(doc(db, COLLECTION_NAME, chefId), {
    isDeactivatedByAdmin: Boolean(deactivate),
    updatedAt: serverTimestamp(),
  });

  // Sync to society subcollections
  try {
    const societiesSnap = await getDocs(collection(db, "societies"));
    await Promise.all(
      societiesSnap.docs.map(async (socDoc) => {
        const subRef = doc(db, "societies", socDoc.id, "chefs", chefId);
        try {
          await updateDoc(subRef, {
            isDeactivatedByAdmin: Boolean(deactivate),
          });
        } catch {}
      })
    );
  } catch (err) {
    console.warn("Could not sync admin deactivation to subcollections:", err);
  }
}

/**
 * Deletes a Chef from Firestore and removes from all societies subcollections.
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
      const subChefRef = doc(db, "societies", socDoc.id, "chefs", chefId);
      try {
        await deleteDoc(subChefRef);
        const subSnap = await getDocs(collection(db, "societies", socDoc.id, "chefs"));
        await updateDoc(doc(db, "societies", socDoc.id), {
          totalChefs: subSnap.size,
          updatedAt: serverTimestamp(),
        });
      } catch {}
    }
  } catch (err) {
    console.warn("Could not remove chef from society subcollections:", err);
  }
}

/**
 * One-time backfill/synchronizer to audit all existing chefs in Firestore
 * (like CHEF_001, Sam, etc.) and ensure they are added into societies/{societyId}/chefs
 * and that each society's totalChefs counter reflects the correct count.
 */
export async function syncExistingChefsToSocieties() {
  if (!isFirebaseConfigured || !db) return;

  try {
    const chefsSnap = await getDocs(collection(db, COLLECTION_NAME));
    const societiesSnap = await getDocs(collection(db, "societies"));

    const chefs = chefsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    for (const socDoc of societiesSnap.docs) {
      const socData = socDoc.data();
      const socName = socData.name;
      const socId = socDoc.id;

      // Find chefs assigned to this society
      const matchingChefs = chefs.filter((c) => {
        const assigned = Array.isArray(c.assignedSocieties) ? c.assignedSocieties : [];
        return (
          assigned.includes(socName) ||
          assigned.includes(socId) ||
          c.baseSociety === socName ||
          c.baseSociety === socId
        );
      });

      // Write each matching chef into subcollection
      for (const chef of matchingChefs) {
        const subRef = doc(db, "societies", socId, "chefs", chef.id);
        await setDoc(
          subRef,
          {
            chefId: chef.id,
            fullName: chef.fullName || chef.name || "Chef",
            name: chef.fullName || chef.name || "Chef",
            mobileNumber: chef.mobileNumber || "",
            email: chef.email || "",
            photoUrl: chef.photoUrl || "",
            baseSociety: chef.baseSociety || "",
            status: chef.status || "enabled",
            isEnabled: chef.status !== "disabled",
            assignedAt: chef.createdAt || serverTimestamp(),
          },
          { merge: true }
        );
      }

      // Update totalChefs on society doc
      await updateDoc(doc(db, "societies", socId), {
        totalChefs: matchingChefs.length,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.error("Error in syncExistingChefsToSocieties:", err);
  }
}

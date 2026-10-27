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
import { db, isFirebaseConfigured } from "@/lib/firebase";

const COLLECTION_NAME = "societies";

/**
 * Generates a clean slug ID for a society matching existing DB convention:
 * soc_<normalized_name>
 * Examples:
 * - "Yashodeep Society" -> "soc_yashodeep"
 * - "Green Valley Society" -> "soc_green_valley"
 * - "Lakeview Residency" -> "soc_lakeview"
 * - "Silver Oak" -> "soc_silver_oak"
 */
export function generateSocietyId(name) {
  if (!name || typeof name !== "string") {
    return `soc_${Date.now()}`;
  }

  let clean = name.trim().toLowerCase();

  // Strip trailing descriptors like "society", "residency", "apartments", "heights", etc. if preceded by name
  const words = clean.split(/\s+/);
  if (words.length > 1) {
    const lastWord = words[words.length - 1];
    if (
      [
        "society",
        "residency",
        "apartments",
        "apartment",
        "heights",
        "tower",
        "towers",
        "enclave",
        "scheme",
        "complex",
      ].includes(lastWord)
    ) {
      words.pop();
      clean = words.join(" ");
    }
  }

  let slug = clean
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!slug) slug = "society";

  if (slug.startsWith("soc_")) {
    return slug;
  }
  return `soc_${slug}`;
}

/**
 * Ensures the society ID is unique by appending an index if a duplicate slug already exists.
 */
export async function getUniqueSocietyId(name) {
  const baseId = generateSocietyId(name);
  let finalId = baseId;
  let counter = 2;

  try {
    let snap = await getDoc(doc(db, COLLECTION_NAME, finalId));
    while (snap.exists()) {
      finalId = `${baseId}_${counter}`;
      counter++;
      snap = await getDoc(doc(db, COLLECTION_NAME, finalId));
    }
  } catch (err) {
    console.warn("Could not check society ID uniqueness:", err);
  }

  return finalId;
}

/**
 * One-time background migrator that audits societies in Firestore.
 * If any society has a random auto-generated ID (like qNFuNPyGUMEpUcVE0vUA),
 * it seamlessly migrates the document to soc_<name> and cleans up the old doc.
 */
let hasMigratedLegacy = false;
export async function migrateLegacySocietyIds() {
  if (!isFirebaseConfigured || !db || hasMigratedLegacy) return;
  hasMigratedLegacy = true;

  try {
    const snap = await getDocs(collection(db, COLLECTION_NAME));
    for (const d of snap.docs) {
      if (!d.id.startsWith("soc_")) {
        const data = d.data();
        const targetId = generateSocietyId(data.name || d.id);
        console.log(`[Society Migration] Migrating legacy doc ${d.id} to ${targetId}...`);

        const newDocRef = doc(db, COLLECTION_NAME, targetId);
        await setDoc(
          newDocRef,
          {
            ...data,
            societyId: targetId,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        // Copy chefs subcollection if present
        try {
          const chefsSnap = await getDocs(collection(db, COLLECTION_NAME, d.id, "chefs"));
          for (const chefDoc of chefsSnap.docs) {
            await setDoc(
              doc(db, COLLECTION_NAME, targetId, "chefs", chefDoc.id),
              chefDoc.data(),
              { merge: true }
            );
            await deleteDoc(doc(db, COLLECTION_NAME, d.id, "chefs", chefDoc.id));
          }
        } catch (subErr) {
          console.warn("Error migrating chefs subcollection for legacy society:", subErr);
        }

        // Delete old legacy doc
        await deleteDoc(doc(db, COLLECTION_NAME, d.id));
        console.log(`[Society Migration] Completed: ${d.id} is now ${targetId}`);
      }
    }
  } catch (err) {
    console.warn("Error running migrateLegacySocietyIds:", err);
  }
}

/**
 * Subscribes to live real-time updates for Societies.
 * Returns only data present in the database.
 */
export function subscribeToSocieties(callback, onError) {
  if (!isFirebaseConfigured || !db) {
    callback([], true);
    return () => {};
  }

  // Run audit/migration of non-standard IDs in background
  migrateLegacySocietyIds();

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
        return {
          id: docSnap.id,
          ...data,
          status: data.status || (data.isEnabled === false ? "disabled" : "enabled"),
          wings: Array.isArray(data.wings) ? data.wings : [],
          numberOfWings: Array.isArray(data.wings)
            ? data.wings.length
            : Number(data.numberOfWings || 0),
        };
      });

      callback(list, false);
    },
    (error) => {
      console.warn("Firestore societies subscription error:", error);
      if (onError) onError(error);
      callback([], true);
    }
  );
}

/**
 * Creates a new Society document in Firestore with standardized soc_<name> document ID.
 */
export async function createSociety(data) {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured.");
  }

  const societyId = await getUniqueSocietyId(data.name);
  const docRef = doc(db, COLLECTION_NAME, societyId);

  const societyDocData = {
    societyId,
    name: data.name.trim(),
    area: data.area.trim(),
    city: data.city.trim(),
    status: data.status || "enabled",
    isEnabled: data.status !== "disabled",
    numberOfWings: data.wings?.length || Number(data.numberOfWings || 0),
    wings: data.wings || [],
    totalChefs: Number(data.totalChefs || 0),
    totalCustomers: Number(data.totalCustomers || 0),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(docRef, societyDocData);
  return { id: societyId, ...societyDocData };
}

/**
 * Updates an existing Society document in Firestore.
 */
export async function updateSociety(societyId, data) {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured.");
  }

  const docRef = doc(db, COLLECTION_NAME, societyId);
  return await updateDoc(docRef, {
    name: data.name.trim(),
    area: data.area.trim(),
    city: data.city.trim(),
    status: data.status,
    isEnabled: data.status !== "disabled",
    numberOfWings: data.wings?.length || Number(data.numberOfWings || 0),
    wings: data.wings || [],
    updatedAt: serverTimestamp(),
  });
}

/**
 * Toggles Society status (enabled <-> disabled).
 */
export async function toggleSocietyStatus(societyId, newStatus) {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured.");
  }

  const docRef = doc(db, COLLECTION_NAME, societyId);
  const isEnabled = newStatus === "enabled";
  return await updateDoc(docRef, {
    status: newStatus,
    isEnabled,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Deletes a Society document.
 */
export async function deleteSociety(societyId) {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured.");
  }

  const docRef = doc(db, COLLECTION_NAME, societyId);
  return await deleteDoc(docRef);
}

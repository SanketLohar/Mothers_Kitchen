import { collection, collectionGroup, doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";

const COLLECTION_NAME = "app_highlights";

const EMPTY_HIGHLIGHTS = [1, 2, 3, 4].map((slot) => ({
  slotNumber: slot,
  title: "",
  subtitle: "",
  imageUrl: "",
  isActive: false,
}));

/**
 * Subscribes to the 4 customer app highlight slots from Firestore.
 */
export function subscribeToHighlights(callback) {
  if (!isFirebaseConfigured || !db) {
    callback(EMPTY_HIGHLIGHTS);
    return () => {};
  }

  const colRef = collection(db, COLLECTION_NAME);

  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        callback(EMPTY_HIGHLIGHTS);
        return;
      }

      const map = {};
      snapshot.docs.forEach((d) => {
        const data = d.data();
        map[data.slotNumber] = { id: d.id, ...data };
      });

      const result = [1, 2, 3, 4].map((slot) => {
        return (
          map[slot] || {
            slotNumber: slot,
            title: "",
            subtitle: "",
            imageUrl: "",
            isActive: false,
          }
        );
      });

      callback(result);
    },
    (err) => {
      console.warn("Highlights subscription error:", err);
      callback(EMPTY_HIGHLIGHTS);
    }
  );
}

/**
 * Saves a highlight slot into Firestore.
 */
export async function saveHighlightSlot(slotNumber, data) {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured.");
  }

  if (data.imageUrl && data.imageUrl.startsWith("data:")) {
    throw new Error("Base64 images cannot be saved directly to Firestore. Please upload to Cloud Storage.");
  }

  const docRef = doc(db, COLLECTION_NAME, `slot-${slotNumber}`);
  return await setDoc(
    docRef,
    {
      slotNumber,
      title: data.title || "",
      subtitle: data.subtitle || "",
      imageUrl: data.imageUrl || "",
      isActive: Boolean(data.isActive),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Subscribes to the 4 society-specific highlight slots from Firestore:
 * societies/{societyId}/highlights
 */
export function subscribeToSocietyHighlights(societyId, callback) {
  if (!isFirebaseConfigured || !db || !societyId) {
    callback(EMPTY_HIGHLIGHTS);
    return () => {};
  }

  const colRef = collection(db, "societies", societyId, "highlights");

  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        callback(EMPTY_HIGHLIGHTS);
        return;
      }

      const map = {};
      snapshot.docs.forEach((d) => {
        const data = d.data();
        map[data.slotNumber] = { id: d.id, ...data };
      });

      const result = [1, 2, 3, 4].map((slot) => {
        return (
          map[slot] || {
            slotNumber: slot,
            title: "",
            subtitle: "",
            imageUrl: "",
            isActive: false,
          }
        );
      });

      callback(result);
    },
    (err) => {
      console.warn("Society highlights subscription error:", err);
      callback(EMPTY_HIGHLIGHTS);
    }
  );
}

/**
 * Saves a society-specific highlight slot into Firestore:
 * societies/{societyId}/highlights/slot-{slotNumber}
 */
export async function saveSocietyHighlightSlot(societyId, slotNumber, data) {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured.");
  }
  if (!societyId) {
    throw new Error("Society ID is required.");
  }

  if (data.imageUrl && data.imageUrl.startsWith("data:")) {
    throw new Error("Base64 images cannot be saved directly to Firestore. Please upload to Cloud Storage.");
  }

  const docRef = doc(db, "societies", societyId, "highlights", `slot-${slotNumber}`);
  return await setDoc(
    docRef,
    {
      slotNumber,
      societyId,
      title: data.title || "",
      subtitle: data.subtitle || "",
      imageUrl: data.imageUrl || "",
      isActive: Boolean(data.isActive),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Subscribes to all society highlights across all societies using a collectionGroup query.
 * Returns a map of societyId -> array of slot objects.
 */
export function subscribeToAllSocietyHighlights(callback) {
  if (!isFirebaseConfigured || !db) {
    callback({});
    return () => {};
  }

  const groupRef = collectionGroup(db, "highlights");

  return onSnapshot(
    groupRef,
    (snapshot) => {
      if (snapshot.empty) {
        callback({});
        return;
      }

      const map = {};
      snapshot.docs.forEach((d) => {
        const data = d.data();
        const societyId = data.societyId || d.ref.parent.parent?.id;
        if (!societyId) return;

        if (!map[societyId]) {
          map[societyId] = {};
        }
        map[societyId][data.slotNumber] = { id: d.id, societyId, ...data };
      });

      const resultMap = {};
      Object.keys(map).forEach((socId) => {
        resultMap[socId] = [1, 2, 3, 4].map((slot) => {
          return (
            map[socId][slot] || {
              slotNumber: slot,
              societyId: socId,
              title: "",
              subtitle: "",
              imageUrl: "",
              isActive: false,
            }
          );
        });
      });

      callback(resultMap);
    },
    (err) => {
      console.warn("All society highlights subscription error:", err);
      callback({});
    }
  );
}


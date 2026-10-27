import { collection, doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
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

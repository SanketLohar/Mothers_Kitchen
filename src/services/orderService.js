import { collection, onSnapshot } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";

const COLLECTION_NAME = "orders";

/**
 * Subscribes to live real-time updates for Orders.
 * Returns only data present in the Firestore orders collection.
 */
export function subscribeToOrders(callback, onError) {
  if (!isFirebaseConfigured || !db) {
    callback([], true);
    return () => {};
  }

  const colRef = collection(db, COLLECTION_NAME);

  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        callback([], true);
        return;
      }

      const list = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
        };
      });

      callback(list, false);
    },
    (error) => {
      console.warn("Firestore orders subscription error:", error);
      if (onError) onError(error);
      callback([], true);
    }
  );
}

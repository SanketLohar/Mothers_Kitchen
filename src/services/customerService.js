import { collection, onSnapshot, query, limit } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";

const COLLECTION_NAME = "customers";

/**
 * Subscribes to customer records in Firestore.
 * Returns only data present in the database.
 */
export function subscribeToCustomers(callback) {
  if (!isFirebaseConfigured || !db) {
    callback([]);
    return () => {};
  }

  const q = query(collection(db, COLLECTION_NAME), limit(500));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        callback([]);
        return;
      }

      const list = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          ...d,
          fullName: d.fullName || d.name || "Resident",
          mobileNumber: d.mobileNumber || d.mobile || d.phone || "",
          email: d.email || "",
          city: d.city || "",
          area: d.area || "",
          society: d.society || d.societyName || "",
          wing: d.wing || "",
          flatNumber: d.flatNumber || d.flatNo || "",
          totalOrders: Number(d.totalOrders || 0),
          totalSpend: Number(d.totalSpend || d.totalSpent || 0),
          lastOrderDate: d.lastOrderDate || "",
        };
      });

      callback(list);
    },
    (err) => {
      console.warn("Customers subscription error:", err);
      callback([]);
    }
  );
}

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
        const addrObj = typeof d.address === "object" && d.address !== null ? d.address : null;

        const flatNumber = d.flatNumber || d.flatNo || addrObj?.flatNumber || addrObj?.flatNo || "";
        const floor = d.floor || addrObj?.floor || "";
        const wing = d.wing || addrObj?.wing || "";
        const society = d.society || d.societyName || addrObj?.societyName || addrObj?.society || "";
        const area = d.area || addrObj?.area || "";
        const city = d.city || addrObj?.city || "";

        let formattedAddress = "";
        if (typeof d.address === "string" && d.address.trim()) {
          formattedAddress = d.address.trim();
        } else {
          const parts = [
            flatNumber ? `Flat ${flatNumber}` : "",
            floor ? `Floor ${floor}` : "",
            wing ? `Wing ${wing}` : "",
            society,
            area,
            city,
          ].filter(Boolean);
          formattedAddress = parts.join(", ");
        }

        const name = d.fullName || d.name || "Resident";

        return {
          id: docSnap.id,
          ...d,
          name,
          fullName: name,
          mobileNumber: d.mobileNumber || d.mobile || d.phone || "",
          email: d.email || "",
          city,
          area,
          society,
          wing,
          floor,
          flatNumber,
          address: formattedAddress,
          rawAddress: d.address,
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

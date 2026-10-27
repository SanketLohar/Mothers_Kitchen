import { collection, onSnapshot } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";

const EMPTY_STATS = {
  totalSocieties: 0,
  totalChefs: 0,
  totalCustomers: 0,
  totalOrders: 0,
  totalRevenue: 0,
};

/**
 * Subscribes to operational KPI counts across live Firestore collections.
 * Returns only real data present in the database.
 */
export function subscribeToDashboardKpis(callback) {
  if (!isFirebaseConfigured || !db) {
    callback(EMPTY_STATS);
    return () => {};
  }

  const stats = { ...EMPTY_STATS };
  const unsubs = [];

  try {
    // 1. Societies Count
    unsubs.push(
      onSnapshot(collection(db, "societies"), (snap) => {
        stats.totalSocieties = snap.size;
        callback({ ...stats });
      }, () => {})
    );

    // 2. Chefs Count
    unsubs.push(
      onSnapshot(collection(db, "chefs"), (snap) => {
        stats.totalChefs = snap.size;
        callback({ ...stats });
      }, () => {})
    );

    // 3. Customers Count
    unsubs.push(
      onSnapshot(collection(db, "customers"), (snap) => {
        stats.totalCustomers = snap.size;
        callback({ ...stats });
      }, () => {})
    );

    // 4. Orders Count & Revenue
    unsubs.push(
      onSnapshot(collection(db, "orders"), (snap) => {
        stats.totalOrders = snap.size;
        let rev = 0;
        snap.forEach((doc) => {
          const d = doc.data();
          rev += Number(d.amount || d.totalAmount || d.finalPrice || 0);
        });
        stats.totalRevenue = rev;
        callback({ ...stats });
      }, () => {})
    );
  } catch (err) {
    console.warn("KPI snapshot error:", err);
    callback(EMPTY_STATS);
  }

  return () => {
    unsubs.forEach((u) => typeof u === "function" && u());
  };
}

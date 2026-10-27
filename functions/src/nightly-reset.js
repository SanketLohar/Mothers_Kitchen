/**
 * Daily Midnight Chef Deactivation & Food Availability Reset Cron
 * 
 * BRD Requirement (Page 12, Item 6):
 * "At every night 12 AM, the chef status should be marked as Inactive and the 
 *  Item availability should reset so every day chef have to set status to Active 
 *  and update the food item availability again"
 * 
 * Timezone: Asia/Kolkata
 * 
 * @param {import("firebase-admin").firestore.Firestore} firestore
 * @returns {Promise<{ deactivatedChefs: number, resetFoodItems: number }>}
 */
export async function executeNightlyReset(firestore) {
  console.log("Starting scheduled midnight chef deactivation and food availability reset (Asia/Kolkata)...");
  
  let deactivatedChefs = 0;
  let resetFoodItems = 0;

  // 1. Reset all active chefs: set isDailyActive = false
  const activeChefsSnap = await firestore
    .collection("chefs")
    .where("isDailyActive", "==", true)
    .get();

  if (!activeChefsSnap.empty) {
    const batch = firestore.batch();
    activeChefsSnap.docs.forEach((doc) => {
      batch.update(doc.ref, {
        isDailyActive: false,
        lastResetAt: new Date().toISOString(),
      });
      deactivatedChefs++;
    });
    await batch.commit();
  }

  // 2. Reset food item availability flags: set isAvailable = false, availableQuantity = 0
  const availableItemsSnap = await firestore
    .collection("food_items")
    .where("isAvailable", "==", true)
    .get();

  if (!availableItemsSnap.empty) {
    const batch = firestore.batch();
    availableItemsSnap.docs.forEach((doc) => {
      batch.update(doc.ref, {
        isAvailable: false,
        availableQuantity: 0,
        lastResetAt: new Date().toISOString(),
      });
      resetFoodItems++;
    });
    await batch.commit();
  }

  console.log(`Nightly reset complete: ${deactivatedChefs} chefs deactivated, ${resetFoodItems} food items reset.`);
  return { deactivatedChefs, resetFoodItems };
}

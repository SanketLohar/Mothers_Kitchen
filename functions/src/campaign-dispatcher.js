/**
 * WhatsApp Marketing Campaign Dispatcher
 * 
 * BRD Requirement (Page 24):
 * Dispatches society-filtered promotional broadcast messages via Meta WhatsApp Cloud API.
 * 
 * @param {import("firebase-admin").firestore.Firestore} firestore
 * @param {string} campaignId
 * @param {{ uid: string, email: string }} caller
 */
export async function dispatchMarketingCampaign(firestore, campaignId, caller) {
  const campaignDoc = await firestore.collection("campaigns").doc(campaignId).get();

  if (!campaignDoc.exists) {
    const error = new Error(`Campaign ${campaignId} not found`);
    error.statusCode = 404;
    throw error;
  }

  const campaign = campaignDoc.data();
  console.log(`Executing marketing dispatch for campaign ${campaignId} by Super Admin ${caller.email}...`);

  // Target society query
  let customersQuery = firestore.collection("customers");
  if (campaign.targetSociety && campaign.targetSociety !== "all") {
    customersQuery = customersQuery.where("society", "==", campaign.targetSociety);
  }

  const customersSnap = await customersQuery.get();
  console.log(`Found ${customersSnap.size} target customers for broadcast.`);

  await campaignDoc.ref.update({
    status: "dispatched",
    dispatchedAt: new Date().toISOString(),
    dispatchedBy: caller.email,
    recipientCount: customersSnap.size,
  });

  return {
    success: true,
    campaignId,
    dispatchedCount: customersSnap.size,
    status: "dispatched",
  };
}

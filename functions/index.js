import admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

import { authenticateSuperAdmin } from "./src/admin-auth.js";
import { provisionChefAccount } from "./src/chef-provisioning.js";
import { executeNightlyReset } from "./src/nightly-reset.js";
import { sendOrderPlacementWhatsApp } from "./src/order-notifications.js";
import { dispatchMarketingCampaign } from "./src/campaign-dispatcher.js";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();
const auth = admin.auth();

/**
 * 1. Provision Chef Authentication Account (Super Admin only)
 */
export const provisionChef = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const caller = await authenticateSuperAdmin(auth, req);
    console.log(`Chef provisioning requested by authorized Super Admin: ${caller.email}`);
    const result = await provisionChefAccount(auth, firestore, req.body);
    return res.status(200).json(result);
  } catch (err) {
    console.error("provisionChef error:", err);
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
});

/**
 * 2. Scheduled Nightly Reset (BRD p. 12)
 * Runs daily at midnight 12:00 AM Asia/Kolkata
 */
export const nightlyChefResetCron = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "Asia/Kolkata",
  },
  async (event) => {
    const result = await executeNightlyReset(firestore);
    console.log("Nightly reset job completed successfully:", result);
  }
);

/**
 * 3. Order Placement WhatsApp Trigger (BRD p. 7)
 * Triggered automatically on order creation in Firestore
 */
export const onOrderPlacedTrigger = onDocumentCreated(
  "orders/{orderId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    await sendOrderPlacementWhatsApp(firestore, snapshot);
  }
);

/**
 * 4. WhatsApp Marketing Dispatcher (BRD p. 24)
 */
export const dispatchCampaign = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const caller = await authenticateSuperAdmin(auth, req);
    const { campaignId } = req.body;
    if (!campaignId) {
      return res.status(400).json({ error: "Missing required parameter: campaignId" });
    }
    const result = await dispatchMarketingCampaign(firestore, campaignId, caller);
    return res.status(200).json(result);
  } catch (err) {
    console.error("dispatchCampaign error:", err);
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
});

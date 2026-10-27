/**
 * Mother's Kitchen — Authoritative Super Admin Provisioning Script
 * 
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS="./service-account-key.json" node scripts/provision-super-admin.mjs admin@motherskitchen.com
 * 
 * Sets authoritative custom claims { role: "super-admin", admin: true } on the Firebase Auth user.
 */

import admin from "firebase-admin";

const adminEmail = process.argv[2];

if (!adminEmail || !adminEmail.includes("@")) {
  console.error("Usage: node scripts/provision-super-admin.mjs <admin-email>");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp();
}

async function provisionSuperAdmin() {
  try {
    console.log(`Looking up user by email: ${adminEmail}...`);
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(adminEmail);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        console.log(`User does not exist. Creating new Firebase Auth account for ${adminEmail}...`);
        userRecord = await admin.auth().createUser({
          email: adminEmail,
          emailVerified: true,
          displayName: "Super Admin",
        });
        console.log(`Account created with UID: ${userRecord.uid}`);
      } else {
        throw err;
      }
    }

    console.log(`Assigning authoritative Super Admin custom claims to UID: ${userRecord.uid}...`);
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: "super-admin",
      admin: true,
      provisionedAt: new Date().toISOString(),
    });

    console.log(`✅ Success! Super Admin role successfully assigned to ${adminEmail}.`);
    console.log(`User claims set: { role: "super-admin", admin: true }`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error provisioning Super Admin:", error.message);
    process.exit(1);
  }
}

provisionSuperAdmin();

/**
 * Server-Side Chef Account Provisioning Endpoint Handler
 * 
 * Safely creates the cook's Firebase Authentication account without logging out
 * the current Super Admin session, then stores profile metadata in Firestore.
 * 
 * @param {import("firebase-admin").auth.Auth} auth
 * @param {import("firebase-admin").firestore.Firestore} firestore
 * @param {object} payload
 * @returns {Promise<object>}
 */
export async function provisionChefAccount(auth, firestore, payload) {
  const {
    fullName,
    email,
    mobileNumber,
    defaultPassword,
    photoUrl,
    idCardNumber,
    address,
    baseSociety,
    assignedSocieties,
  } = payload;

  if (!fullName || !mobileNumber || !defaultPassword) {
    const error = new Error("Missing required fields: fullName, mobileNumber, and defaultPassword are required.");
    error.statusCode = 400;
    throw error;
  }

  const cleanMobile = String(mobileNumber).replace(/\D/g, "");
  const authEmail = email && email.includes("@")
    ? email.trim().toLowerCase()
    : `chef_${cleanMobile}@motherskitchen.com`;

  // 1. Create or retrieve Firebase Authentication User
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(authEmail);
    // Update existing password if already registered
    await auth.updateUser(userRecord.uid, {
      password: defaultPassword,
      displayName: fullName,
    });
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      userRecord = await auth.createUser({
        email: authEmail,
        password: defaultPassword,
        displayName: fullName,
        phoneNumber: cleanMobile.length === 10 ? `+91${cleanMobile}` : undefined,
      });
    } else {
      throw err;
    }
  }

  // 2. Set role custom claim on the Chef user
  await auth.setCustomUserClaims(userRecord.uid, {
    role: "chef",
    baseSociety: baseSociety || "",
  });

  // 3. Write Chef Profile Document in Firestore
  const chefDocRef = firestore.collection("chefs").doc(userRecord.uid);
  const chefData = {
    id: userRecord.uid,
    fullName: fullName.trim(),
    email: authEmail,
    mobileNumber: mobileNumber.trim(),
    photoUrl: photoUrl || null,
    idCardNumber: idCardNumber || null,
    address: address || "",
    baseSociety: baseSociety || "",
    assignedSocieties: Array.isArray(assignedSocieties) ? assignedSocieties : [baseSociety],
    activeDeliverableSocieties: Array.isArray(assignedSocieties) ? assignedSocieties : [baseSociety],
    status: "enabled",
    isDailyActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await chefDocRef.set(chefData, { merge: true });

  return {
    success: true,
    chefId: userRecord.uid,
    email: authEmail,
    assignedSocietiesCount: chefData.assignedSocieties.length,
  };
}

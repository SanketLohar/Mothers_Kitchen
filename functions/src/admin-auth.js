/**
 * Verifies that the HTTP request caller holds authoritative Super Admin privileges
 * by inspecting the decoded Firebase ID Token custom claims.
 * 
 * @param {import("firebase-admin").auth.Auth} auth
 * @param {import("express").Request} req
 * @returns {Promise<{ uid: string, email: string }>}
 */
export async function authenticateSuperAdmin(auth, req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const error = new Error("Authentication required: Missing Bearer ID token in Authorization header");
    error.statusCode = 401;
    throw error;
  }

  const idToken = authHeader.split("Bearer ")[1].trim();
  let decodedToken;

  try {
    decodedToken = await auth.verifyIdToken(idToken);
  } catch (err) {
    const error = new Error(`Invalid authentication token: ${err.message}`);
    error.statusCode = 401;
    throw error;
  }

  // Authoritative Custom Claim verification
  if (decodedToken.role !== "super-admin" && !decodedToken.admin) {
    const error = new Error("Access forbidden: Caller lacks Super Admin custom claim");
    error.statusCode = 403;
    throw error;
  }

  return {
    uid: decodedToken.uid,
    email: decodedToken.email || "",
  };
}

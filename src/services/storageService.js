import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage, isFirebaseConfigured } from "@/lib/firebase";

/**
 * Compresses an image (File, Blob, or Data URL) to high-efficiency WebP format.
 * Returns a Blob with contentType 'image/webp' (or fallback 'image/jpeg').
 */
export async function compressImageToWebP(input, { maxWidth = 1080, maxHeight = 1080, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    if (!input) return reject(new Error("No image input provided."));

    const processImage = (src) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image for compression."));
      img.onload = () => {
        let w = img.width;
        let h = img.height;

        if (w > maxWidth || h > maxHeight) {
          const ratio = Math.min(maxWidth / w, maxHeight / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");

        // Clear and draw resized image
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              // Fallback to JPEG if WebP encoding is not supported
              canvas.toBlob(
                (jpegBlob) => {
                  if (jpegBlob) resolve(jpegBlob);
                  else reject(new Error("Image compression encoding failed."));
                },
                "image/jpeg",
                quality
              );
            }
          },
          "image/webp",
          quality
        );
      };
      img.src = src;
    };

    if (typeof input === "string") {
      processImage(input);
    } else if (input instanceof Blob || (typeof File !== "undefined" && input instanceof File)) {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.onload = (e) => processImage(e.target.result);
      reader.readAsDataURL(input);
    } else {
      reject(new Error("Unsupported image input type."));
    }
  });
}

/**
 * Uploads a chef/seller profile photo to Firebase Storage under:
 * `profiles/{chefs|sellers}/{userId}/profile_{timestamp}.webp`
 * Returns the permanent HTTPS downloadURL.
 */
export async function uploadChefProfilePhoto(fileOrBlob, userId, isSeller = false) {
  if (!isFirebaseConfigured || !storage) {
    throw new Error("Firebase Storage is not configured. Please check your Firebase configuration.");
  }

  // Compress avatar to 500x500 WebP (crisp avatar ~20-40 KB)
  const webpBlob = await compressImageToWebP(fileOrBlob, {
    maxWidth: 500,
    maxHeight: 500,
    quality: 0.85,
  });

  const roleFolder = isSeller ? "sellers" : "chefs";
  const cleanId = (userId || `user_${Date.now()}`).replace(/[^A-Za-z0-9_-]/g, "");
  const fileName = `profile_${Date.now()}.webp`;
  const storagePath = `profiles/${roleFolder}/${cleanId}/${fileName}`;
  const storageRef = ref(storage, storagePath);

  const metadata = {
    contentType: "image/webp",
    customMetadata: {
      userId: cleanId,
      role: roleFolder,
      uploadedAt: new Date().toISOString(),
    },
  };

  const snapshot = await uploadBytes(storageRef, webpBlob, metadata);
  const downloadUrl = await getDownloadURL(snapshot.ref);
  return downloadUrl;
}

/**
 * Uploads a highlight banner to Firebase Storage in WebP format under:
 * - Global: `highlights/global/slot_{slotNumber}_{timestamp}.webp`
 * - Society: `highlights/societies/{societyId}/slot_{slotNumber}_{timestamp}.webp`
 * Returns the permanent HTTPS downloadURL.
 */
export async function uploadHighlightBanner(fileOrBlob, { scope = "global", societyId = "", slotNumber = 1 } = {}) {
  if (!isFirebaseConfigured || !storage) {
    throw new Error("Firebase Storage is not configured. Please check your Firebase configuration.");
  }

  // Compress banner to 1080x540 WebP (2:1 aspect ratio ~40-70 KB)
  const webpBlob = await compressImageToWebP(fileOrBlob, {
    maxWidth: 1080,
    maxHeight: 540,
    quality: 0.85,
  });

  let storagePath = "";
  if (scope === "society" && societyId) {
    const cleanSocId = societyId.replace(/[^A-Za-z0-9_-]/g, "");
    storagePath = `highlights/societies/${cleanSocId}/slot_${slotNumber}_${Date.now()}.webp`;
  } else {
    storagePath = `highlights/global/slot_${slotNumber}_${Date.now()}.webp`;
  }

  const storageRef = ref(storage, storagePath);
  const metadata = {
    contentType: "image/webp",
    customMetadata: {
      scope,
      societyId: societyId || "global",
      slotNumber: String(slotNumber),
      uploadedAt: new Date().toISOString(),
    },
  };

  const snapshot = await uploadBytes(storageRef, webpBlob, metadata);
  const downloadUrl = await getDownloadURL(snapshot.ref);
  return downloadUrl;
}

/**
 * Safely removes an old file from Firebase Storage given its download URL.
 */
export async function deleteStorageFile(fileUrl) {
  if (!fileUrl || !storage || typeof fileUrl !== "string" || !fileUrl.includes("firebasestorage.googleapis.com")) {
    return;
  }
  try {
    const storageRef = ref(storage, fileUrl);
    await deleteObject(storageRef);
  } catch (err) {
    console.warn("Could not delete old storage file (safe ignore):", err);
  }
}

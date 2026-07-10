const cloudinary = require('cloudinary').v2;

// Configuration comes from the environment. Either set CLOUDINARY_URL
// (cloudinary://<key>:<secret>@<cloud_name>) or the three discrete vars below.
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}
// If only CLOUDINARY_URL is set, the SDK reads it automatically; still force https.
cloudinary.config({ secure: true });

const FOLDER = process.env.CLOUDINARY_FOLDER || 'propertyverse';

// True when the SDK has enough credentials to talk to Cloudinary.
function isConfigured() {
  const c = cloudinary.config();
  return Boolean(c.cloud_name && c.api_key && c.api_secret);
}

// Hosts Cloudinary serves assets from. `res.cloudinary.com` is the standard
// delivery host; a private CDN distribution can be set via CLOUDINARY_CDN_HOST.
const DELIVERY_HOSTS = new Set(
  ['res.cloudinary.com', process.env.CLOUDINARY_CDN_HOST].filter(Boolean)
);

// True when `url` is an https asset we actually hosted, under our own cloud.
//
// Callers persist these URLs and the app renders them, so an unvalidated URL is
// an injection point: a public form submitter could point a listing's photos at
// any server they control. Checking the origin *and* the cloud name means a URL
// on someone else's Cloudinary account is rejected too.
function isDeliveryUrl(url) {
  if (typeof url !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (!DELIVERY_HOSTS.has(parsed.hostname)) return false;

  // Delivery URLs are /<cloud_name>/<resource_type>/<type>/...
  const cloudName = cloudinary.config().cloud_name;
  if (!cloudName) return false;
  return parsed.pathname.startsWith(`/${cloudName}/`);
}

// Upload a raw buffer via an upload stream (nothing touches disk).
//  - resourceType 'image' for photos, 'raw' for documents (pdf/doc/xls…),
//    'auto' to let Cloudinary decide.
// Returns a compact media descriptor we persist on the Property.
function uploadBuffer(buffer, { resourceType = 'image', filename, folder } = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: folder || FOLDER,
        resource_type: resourceType,
        // Keep a sensible public filename; Cloudinary still adds a unique suffix.
        use_filename: Boolean(filename),
        filename_override: filename,
        unique_filename: true,
        overwrite: false,
        // Give slow uplinks room and chunk large files so a single big upload
        // doesn't stall the whole request (the default 60s was being hit).
        timeout: 120000,
        chunk_size: 6_000_000,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
          format: result.format,
          bytes: result.bytes,
          width: result.width,
          height: result.height,
        });
      }
    );
    stream.end(buffer);
  });
}

// Best-effort delete of a stored asset (used when a property is removed).
async function destroy(publicId, resourceType = 'image') {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error('Cloudinary destroy failed for', publicId, err.message);
  }
}

module.exports = { isConfigured, isDeliveryUrl, uploadBuffer, destroy, FOLDER };

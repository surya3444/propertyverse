import { Platform } from 'react-native';

// Local dev fallback: Android emulators reach the host via 10.0.2.2; iOS
// simulators and web use localhost. Used only when no API URL is configured.
const LOCALHOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const LOCAL_API = `http://${LOCALHOST}:5000/api`;

// Hosted default when nothing is configured for the build.
const HOSTED_API = 'https://propertyverse-1.onrender.com/api';

// Build-time override. On web (Vite) this is inlined from process.env via the
// `define` in vite.config.ts; on native it resolves against the RN process.env
// shim. Set API_BASE_URL to point at a different backend (e.g. LOCAL_API for dev).
const CONFIGURED = (process.env.API_BASE_URL || '').trim();

export const API_BASE_URL = CONFIGURED || HOSTED_API;

// Exported so a developer can quickly switch config.ts to the local backend.
export { LOCAL_API, HOSTED_API };

// Base URL of the public Next.js forms app (new/web), used to build shareable
// form links (`${FORMS_WEB_URL}/f/:publicId`). Configure FORMS_WEB_URL for the
// build; falls back to the local Next dev server port.
const CONFIGURED_FORMS_URL = (process.env.FORMS_WEB_URL || '').trim();
export const FORMS_WEB_URL = (CONFIGURED_FORMS_URL || 'https://propertyverse-web.netlify.app').replace(/\/$/, '');

// Build the public URL for a form from its publicId.
export const formShareUrl = (publicId: string) => `${FORMS_WEB_URL}/f/${publicId}`;

// Web push (VAPID) needs no client config beyond the backend's public key, which
// the app fetches at runtime from /api/notifications/vapid-public-key. See
// src/lib/push.web.ts.

// Optional: upload straight from the browser to Cloudinary using an UNSIGNED
// upload preset. When both are set the app skips the backend for uploads — handy
// when the server can't reach Cloudinary (e.g. a local network that filters
// Node's TLS) and it offloads upload bandwidth from the API in production too.
// Both values are public/non-secret. Create the preset in the Cloudinary
// dashboard: Settings → Upload → Add upload preset → Signing mode: Unsigned.
const CLOUDINARY_CLOUD_NAME = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
const CLOUDINARY_UPLOAD_PRESET = (process.env.CLOUDINARY_UPLOAD_PRESET || '').trim();

export const cloudinaryDirect =
  CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET
    ? { cloudName: CLOUDINARY_CLOUD_NAME, uploadPreset: CLOUDINARY_UPLOAD_PRESET }
    : null;

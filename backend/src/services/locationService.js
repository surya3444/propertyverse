// Google Places proxy. The API key stays server-side; the app only ever talks
// to our own endpoints. Uses the **Places API (New)** — Autocomplete + Place
// Details — not the deprecated legacy endpoints.
//
// Required env: GOOGLE_MAPS_API_KEY (enable "Places API (New)" in Google Cloud).
// Optional env: GEO_COUNTRY (ISO-2 code to bias results, default "in" for India).

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const COUNTRY = (process.env.GEO_COUNTRY || 'in').toLowerCase();

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DETAILS_URL = 'https://places.googleapis.com/v1/places';

function assertKey() {
  if (!API_KEY) {
    const err = new Error(
      'Location search is not configured. Set GOOGLE_MAPS_API_KEY in the backend .env.'
    );
    err.status = 503;
    throw err;
  }
}

// Turn a non-2xx Places response into an Error with a useful message.
async function toError(res) {
  let message = `Places request failed (${res.status}).`;
  try {
    const body = await res.json();
    if (body?.error?.message) message = body.error.message;
  } catch {
    /* ignore */
  }
  const err = new Error(message);
  err.status = res.status === 403 ? 502 : res.status;
  return err;
}

/**
 * Suggest places for a partial query (e.g. "gandhi nagar").
 * Returns lightweight predictions the user can choose between.
 */
async function autocomplete(query, sessionToken) {
  assertKey();
  const trimmed = (query || '').trim();
  if (trimmed.length < 2) return [];

  const res = await fetch(AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
    },
    body: JSON.stringify({
      input: trimmed,
      // Bias toward the agent's country and keep results at locality /
      // neighborhood granularity rather than individual businesses.
      includedRegionCodes: [COUNTRY],
      includedPrimaryTypes: ['(regions)'],
      ...(sessionToken ? { sessionToken } : {}),
    }),
  });

  if (!res.ok) throw await toError(res);
  const data = await res.json();

  return (data.suggestions || [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .map((p) => ({
      placeId: p.placeId,
      label: p.text?.text ?? '',
      primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
      secondary: p.structuredFormat?.secondaryText?.text ?? '',
    }));
}

/**
 * Resolve a chosen prediction to a concrete location with coordinates.
 * Returns { placeId, label, lat, lng } ready to persist as a geo point.
 */
async function details(placeId, sessionToken) {
  assertKey();
  if (!placeId) {
    const err = new Error('placeId is required.');
    err.status = 400;
    throw err;
  }

  const params = new URLSearchParams();
  if (sessionToken) params.set('sessionToken', sessionToken);
  const suffix = params.toString() ? `?${params.toString()}` : '';

  const res = await fetch(`${DETAILS_URL}/${encodeURIComponent(placeId)}${suffix}`, {
    headers: {
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
    },
  });

  if (!res.ok) throw await toError(res);
  const data = await res.json();

  const loc = data.location;
  if (!loc || loc.latitude == null || loc.longitude == null) {
    const err = new Error('That place has no coordinates.');
    err.status = 422;
    throw err;
  }

  return {
    placeId,
    label: data.formattedAddress || data.displayName?.text || '',
    lat: loc.latitude,
    lng: loc.longitude,
  };
}

/**
 * Best-effort: turn a free-text location (e.g. from a voice transcript) into a
 * single geo point by taking the top autocomplete prediction and resolving it.
 * Returns null when nothing usable is found or the service is unconfigured.
 */
async function geocodeText(text) {
  try {
    const [top] = await autocomplete(text);
    if (!top) return null;
    return await details(top.placeId);
  } catch {
    return null;
  }
}

module.exports = { autocomplete, details, geocodeText, isConfigured: () => !!API_KEY };

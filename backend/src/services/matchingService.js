// The matching engine.
//
// One scoring function serves both directions — "properties for this lead" and
// "leads for this property" — so a lead/property pair gets the *same* score
// whichever screen you look at it from. The old code scored each direction with
// a different formula, which meant an 82% match one way could read 71% the
// other.
//
// Three ideas do most of the work:
//
//  1. Nothing is scored on a criterion it has no information about. A lead with
//     no stated budget isn't punished for it — the budget weight is dropped and
//     the remaining weights are renormalised. This is why a sparse voice-note
//     lead can still score well on location and type alone.
//
//  2. Only genuine dealbreakers are hard filters. A property 4% over budget is
//     a real option an agent would pitch ("they'll negotiate"), so it survives
//     with a penalty and a warning rather than vanishing. 30% over is noise, so
//     it's dropped.
//
//  3. Every score explains itself. `reasons` is what the agent reads; the
//     number is just a sort key.

const PROPERTY_TYPES = [
  'Apartment', 'Independent House', 'Villa', 'Penthouse', 'Studio', 'Plot',
  'Land', 'Farmhouse', 'Commercial', 'Office', 'Shop', 'Warehouse',
];

// What a lead may ask for. Mirrors PROPERTY_TYPES so a buyer can want exactly
// what a listing is, plus the catch-all.
const REQUIREMENT_TYPES = [...PROPERTY_TYPES, 'Any'];

// How far over a stated budget a listing may sit and still be worth showing.
const BUDGET_STRETCH = 1.10;

// Default search radius when the caller doesn't pass one.
const DEFAULT_RADIUS_KM = 15;

// Relative importance of each criterion. Renormalised over whichever criteria
// actually carry information for a given pair.
const WEIGHTS = {
  location: 35,
  budget: 30,
  propertyType: 25,
  bedrooms: 10,
};

// ---------------------------------------------------------------------------
// Property type affinity
// ---------------------------------------------------------------------------

// Types cluster into families that a buyer would actually cross-shop. Someone
// hunting a Villa will look at an Independent House; nobody hunting a Villa
// wants a Warehouse.
const FAMILY = {
  Apartment: 'residential-unit',
  Studio: 'residential-unit',
  Penthouse: 'residential-unit',
  'Independent House': 'residential-home',
  Villa: 'residential-home',
  Farmhouse: 'residential-home',
  Plot: 'land',
  Land: 'land',
  Commercial: 'commercial',
  Office: 'commercial',
  Shop: 'commercial',
  Warehouse: 'commercial',
};

// Families a buyer will cross-shop, and how strongly.
const CROSS_FAMILY = {
  'residential-unit:residential-home': 0.45,
  'residential-home:residential-unit': 0.45,
};

// How well a listing of type `have` serves a requirement for type `want`.
// Returns null when the requirement carries no type signal ('Any' / unset), and
// 0 when the two are incompatible (a dealbreaker).
function typeAffinity(want, have) {
  if (!want || want === 'Any' || !have) return null;
  if (want === have) return 1;

  const wantFamily = FAMILY[want];
  const haveFamily = FAMILY[have];
  if (!wantFamily || !haveFamily) return null;
  if (wantFamily === haveFamily) return 0.7;

  return CROSS_FAMILY[`${wantFamily}:${haveFamily}`] ?? 0;
}

// Every property type that could plausibly serve this requirement. Used to widen
// the candidate query beyond an exact type match.
function compatibleTypesFor(want) {
  if (!want || want === 'Any') return PROPERTY_TYPES;
  return PROPERTY_TYPES.filter((have) => (typeAffinity(want, have) ?? 1) > 0);
}

// ---------------------------------------------------------------------------
// Budget affinity
// ---------------------------------------------------------------------------

// How well `price` fits a `budgetMax`. Null when either is unknown; 0 when the
// price is beyond the stretch ceiling (a dealbreaker).
//
// Note the shape: the best fit is *near* the budget, not far below it. A ₹40L
// flat shown to a ₹1Cr buyer is usually the wrong tier, not a bargain — so it
// scores well, but below a ₹92L flat that lands in their bracket.
function budgetAffinity(budgetMax, price) {
  if (budgetMax == null || price == null || budgetMax <= 0 || price < 0) return null;

  const ratio = price / budgetMax;
  if (ratio > BUDGET_STRETCH) return 0;

  // Over budget but within stretch: penalised, still shown.
  if (ratio > 1) return 0.5 - ((ratio - 1) / (BUDGET_STRETCH - 1)) * 0.25;
  // The sweet spot — comfortably affordable, right bracket.
  if (ratio >= 0.85) return 1;
  // Below the bracket but still a sensible option.
  if (ratio >= 0.55) return 0.75 + ((ratio - 0.55) / 0.3) * 0.25;
  // Far below: likely a different tier of property entirely.
  return 0.6;
}

// ---------------------------------------------------------------------------
// Bedrooms affinity
// ---------------------------------------------------------------------------

// Never a dealbreaker — a 2 BHK is a reasonable pitch to a 3 BHK hunter — but a
// strong preference signal when both sides state it.
function bedroomAffinity(want, have) {
  if (want == null || have == null) return null;
  const delta = Math.abs(want - have);
  if (delta === 0) return 1;
  if (delta === 1) return 0.55;
  if (delta === 2) return 0.2;
  return 0.05;
}

// ---------------------------------------------------------------------------
// Location affinity
// ---------------------------------------------------------------------------

const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

// Great-circle distance between two [lng, lat] pairs, in kilometres.
function haversineKm([lng1, lat1], [lng2, lat2]) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Words that carry no locality signal, so "Gandhi Nagar, Hyderabad, India" and
// "Gandhi Nagar" compare on what actually distinguishes them.
const LOCATION_STOPWORDS = new Set([
  'india', 'near', 'the', 'road', 'street', 'st', 'rd', 'area', 'city',
  'district', 'state', 'opp', 'opposite', 'behind',
]);

function locationTokens(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1 && !LOCATION_STOPWORDS.has(t))
  );
}

// Symmetric token overlap in [0, 1].
//
// The old code asked `property.location.includes(lead.location)`, which meant a
// lead wanting "Gandhi Nagar, Hyderabad" never matched a property listed as
// "Gandhi Nagar" — the more precisely a client stated their area, the fewer
// matches they got. Dividing by the *smaller* token set makes containment score
// 1.0 in both directions.
function textOverlap(a, b) {
  const setA = locationTokens(a);
  const setB = locationTokens(b);
  if (!setA.size || !setB.size) return null;

  let shared = 0;
  for (const token of setA) if (setB.has(token)) shared += 1;
  return shared / Math.min(setA.size, setB.size);
}

// Distance decay: full marks within ~1 km, tapering to 0 at the radius edge.
// The exponent keeps nearby properties clustered near 1.0 rather than falling
// off linearly from the very first kilometre.
function distanceAffinity(distanceKm, maxKm) {
  if (distanceKm <= 1) return 1;
  if (distanceKm >= maxKm) return 0;
  return Math.max(0, 1 - (distanceKm / maxKm) ** 0.75);
}

const coordsOf = (geo) =>
  Array.isArray(geo?.coordinates) && geo.coordinates.length === 2 ? geo.coordinates : null;

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const QUALITY_BANDS = [
  [85, 'excellent'],
  [70, 'strong'],
  [55, 'fair'],
];

function qualityFor(score) {
  for (const [floor, label] of QUALITY_BANDS) if (score >= floor) return label;
  return 'weak';
}

// Strongest signals first, so a truncated UI shows the ones that matter.
const TONE_ORDER = { positive: 0, neutral: 1, warning: 2 };

const pct = (n) => Math.round(n * 100);

// A buyer wants a Sale listing; a renter wants a Rent listing.
const listingTypeForTransaction = (t) => (t === 'Rent' ? 'Rent' : 'Sale');
const transactionTypeForListing = (t) => (t === 'Rent' ? 'Rent' : 'Buy');

/**
 * Score how well one property serves one lead's requirements.
 *
 * Returns either
 *   { disqualified: true, reason }                       — a dealbreaker
 *   { disqualified: false, score, quality, reasons, distanceKm, breakdown }
 *
 * The result is symmetric: scoreMatch(lead, property) is the same number no
 * matter which side of the app asked for it.
 */
function scoreMatch(lead, property, { maxKm = DEFAULT_RADIUS_KM } = {}) {
  const req = lead.requirements || {};
  const reasons = [];

  // --- Hard filters -------------------------------------------------------
  const wantListing = listingTypeForTransaction(req.transactionType);
  if (property.listingType && property.listingType !== wantListing) {
    return { disqualified: true, reason: `Listed for ${property.listingType}, not ${wantListing}.` };
  }

  const type = typeAffinity(req.propertyType, property.propertyType);
  if (type === 0) {
    return {
      disqualified: true,
      reason: `${property.propertyType} doesn't serve a ${req.propertyType} requirement.`,
    };
  }

  const budget = budgetAffinity(req.budgetMax, property.price);
  if (budget === 0) {
    return { disqualified: true, reason: 'Priced beyond the stated budget.' };
  }

  // --- Location -----------------------------------------------------------
  const leadPoint = coordsOf(req.geo);
  const propertyPoint = coordsOf(property.geo);

  let location = null;
  let distanceKm;

  if (leadPoint && propertyPoint) {
    distanceKm = haversineKm(leadPoint, propertyPoint);
    if (distanceKm > maxKm) {
      return { disqualified: true, reason: `${distanceKm.toFixed(1)} km away — outside the radius.` };
    }
    location = distanceAffinity(distanceKm, maxKm);
    reasons.push({
      code: 'distance',
      label: distanceKm < 1 ? 'Less than 1 km away' : `${distanceKm.toFixed(1)} km away`,
      tone: location >= 0.6 ? 'positive' : 'neutral',
    });
  } else {
    // One or both sides lack coordinates: fall back to comparing the free-text
    // areas. A blank on either side means no signal, not a bad match.
    location = textOverlap(req.location, property.location);
    if (location != null) {
      if (location >= 0.5) {
        reasons.push({ code: 'area', label: `Area matches “${req.location}”`, tone: 'positive' });
      } else if (location > 0) {
        reasons.push({ code: 'area', label: `Partly matches “${req.location}”`, tone: 'neutral' });
      } else {
        // Different areas, but with no coordinates we can't say how far apart.
        location = 0.1;
        reasons.push({ code: 'area', label: 'Different area — no coordinates to compare', tone: 'warning' });
      }
    }
  }

  // --- Budget -------------------------------------------------------------
  if (budget != null) {
    const ratio = property.price / req.budgetMax;
    if (ratio > 1) {
      reasons.push({
        code: 'budget',
        label: `${pct(ratio - 1)}% over budget`,
        tone: 'warning',
      });
    } else if (ratio >= 0.85) {
      reasons.push({ code: 'budget', label: 'Right at the top of budget', tone: 'positive' });
    } else {
      reasons.push({ code: 'budget', label: `${pct(1 - ratio)}% under budget`, tone: 'positive' });
    }
  }

  // --- Type ---------------------------------------------------------------
  if (type != null) {
    if (type === 1) {
      reasons.push({ code: 'type', label: `Exactly the ${property.propertyType} they want`, tone: 'positive' });
    } else {
      reasons.push({
        code: 'type',
        label: `${property.propertyType} — close to the ${req.propertyType} they asked for`,
        tone: 'neutral',
      });
    }
  }

  // --- Bedrooms -----------------------------------------------------------
  const wantBeds = req.bedrooms;
  const haveBeds = property.features?.bedrooms;
  const bedrooms = bedroomAffinity(wantBeds, haveBeds);
  if (bedrooms != null) {
    reasons.push(
      bedrooms === 1
        ? { code: 'bedrooms', label: `${haveBeds} BHK, as asked`, tone: 'positive' }
        : { code: 'bedrooms', label: `${haveBeds} BHK vs ${wantBeds} wanted`, tone: bedrooms >= 0.5 ? 'neutral' : 'warning' }
    );
  }

  // --- Weighted score over the criteria that carry signal ------------------
  const affinities = { location, budget, propertyType: type, bedrooms };

  let weighted = 0;
  let totalWeight = 0;
  for (const [criterion, affinity] of Object.entries(affinities)) {
    if (affinity == null) continue;
    weighted += affinity * WEIGHTS[criterion];
    totalWeight += WEIGHTS[criterion];
  }

  // Nothing to go on at all — a lead with no budget, area, type or bedrooms.
  // Say so rather than inventing a number.
  if (totalWeight === 0) {
    return {
      disqualified: false,
      score: 50,
      quality: 'unknown',
      distanceKm,
      reasons: [{ code: 'nosignal', label: 'Not enough detail to score this match', tone: 'neutral' }],
      breakdown: affinities,
    };
  }

  const score = Math.round((weighted / totalWeight) * 100);

  return {
    disqualified: false,
    score,
    quality: qualityFor(score),
    distanceKm: distanceKm == null ? undefined : Math.round(distanceKm * 10) / 10,
    reasons: reasons.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]),
    breakdown: affinities,
  };
}

module.exports = {
  PROPERTY_TYPES,
  REQUIREMENT_TYPES,
  BUDGET_STRETCH,
  DEFAULT_RADIUS_KM,
  WEIGHTS,
  scoreMatch,
  compatibleTypesFor,
  typeAffinity,
  budgetAffinity,
  bedroomAffinity,
  textOverlap,
  distanceAffinity,
  haversineKm,
  qualityFor,
  listingTypeForTransaction,
  transactionTypeForListing,
};

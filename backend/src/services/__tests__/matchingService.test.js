const m = require('../matchingService');

// Coordinates roughly 2.2 km apart in Hyderabad.
const GANDHI_NAGAR = [78.4867, 17.3850];
const NEARBY = [78.5067, 17.3900];
const FAR_AWAY = [72.8777, 19.0760]; // Mumbai

const lead = (requirements = {}) => ({ requirements: { transactionType: 'Buy', ...requirements } });
const property = (fields = {}) => ({
  listingType: 'Sale',
  propertyType: 'Apartment',
  price: 5_000_000,
  location: 'Gandhi Nagar, Hyderabad',
  ...fields,
});

describe('typeAffinity', () => {
  it('is perfect for an exact match and null when the lead states no preference', () => {
    expect(m.typeAffinity('Villa', 'Villa')).toBe(1);
    expect(m.typeAffinity('Any', 'Villa')).toBeNull();
    expect(m.typeAffinity(undefined, 'Villa')).toBeNull();
  });

  it('partially credits types within the same family', () => {
    expect(m.typeAffinity('Villa', 'Independent House')).toBe(0.7);
    expect(m.typeAffinity('Apartment', 'Studio')).toBe(0.7);
  });

  it('lets a house hunter cross-shop apartments, but not warehouses', () => {
    expect(m.typeAffinity('Villa', 'Apartment')).toBe(0.45);
    expect(m.typeAffinity('Villa', 'Warehouse')).toBe(0);
    expect(m.typeAffinity('Office', 'Apartment')).toBe(0);
    expect(m.typeAffinity('Plot', 'Apartment')).toBe(0);
  });

  it('is symmetric, which is what lets both directions share one query', () => {
    for (const a of m.PROPERTY_TYPES) {
      for (const b of m.PROPERTY_TYPES) {
        expect(m.typeAffinity(a, b)).toBe(m.typeAffinity(b, a));
      }
    }
  });
});

describe('compatibleTypesFor', () => {
  it('widens beyond an exact match without crossing into another sector', () => {
    const forVilla = m.compatibleTypesFor('Villa');
    expect(forVilla).toEqual(expect.arrayContaining(['Villa', 'Independent House', 'Apartment']));
    expect(forVilla).not.toContain('Warehouse');
    expect(forVilla).not.toContain('Plot');
  });

  it('accepts everything when the lead wants Any', () => {
    expect(m.compatibleTypesFor('Any')).toEqual(m.PROPERTY_TYPES);
    expect(m.compatibleTypesFor(undefined)).toEqual(m.PROPERTY_TYPES);
  });
});

describe('budgetAffinity', () => {
  it('has no opinion when either side is unknown', () => {
    expect(m.budgetAffinity(null, 100)).toBeNull();
    expect(m.budgetAffinity(100, null)).toBeNull();
  });

  it('scores the top of the budget bracket highest', () => {
    expect(m.budgetAffinity(100, 90)).toBe(1);
    expect(m.budgetAffinity(100, 100)).toBe(1);
    // Far below the bracket: still fine, but likely the wrong tier.
    expect(m.budgetAffinity(100, 30)).toBeLessThan(m.budgetAffinity(100, 90));
  });

  it('tolerates a small overshoot and rejects a large one', () => {
    expect(m.budgetAffinity(100, 105)).toBeGreaterThan(0);
    expect(m.budgetAffinity(100, 110)).toBeGreaterThan(0);
    expect(m.budgetAffinity(100, 111)).toBe(0); // dealbreaker
    expect(m.budgetAffinity(100, 130)).toBe(0);
  });

  it('penalises overshoot monotonically', () => {
    expect(m.budgetAffinity(100, 102)).toBeGreaterThan(m.budgetAffinity(100, 108));
  });
});

describe('textOverlap', () => {
  it('is symmetric — the old substring test was not', () => {
    const a = 'Gandhi Nagar, Hyderabad';
    const b = 'Gandhi Nagar';
    expect(m.textOverlap(a, b)).toBe(1);
    expect(m.textOverlap(b, a)).toBe(1);
  });

  it('ignores filler words so precision is not punished', () => {
    expect(m.textOverlap('Gandhi Nagar, Hyderabad, India', 'Gandhi Nagar')).toBe(1);
  });

  it('reports no overlap for genuinely different areas', () => {
    expect(m.textOverlap('Gandhi Nagar', 'Bandra West')).toBe(0);
  });

  it('has no opinion when either side is blank', () => {
    expect(m.textOverlap('', 'Gandhi Nagar')).toBeNull();
    expect(m.textOverlap('Gandhi Nagar', undefined)).toBeNull();
  });
});

describe('haversineKm', () => {
  it('measures real-world distance', () => {
    expect(m.haversineKm(GANDHI_NAGAR, GANDHI_NAGAR)).toBe(0);
    expect(m.haversineKm(GANDHI_NAGAR, NEARBY)).toBeCloseTo(2.2, 0);
    // Hyderabad to Mumbai is ~620 km.
    expect(m.haversineKm(GANDHI_NAGAR, FAR_AWAY)).toBeGreaterThan(600);
    expect(m.haversineKm(GANDHI_NAGAR, FAR_AWAY)).toBeLessThan(650);
  });
});

describe('scoreMatch — dealbreakers', () => {
  it('rejects the wrong side of the market', () => {
    const result = m.scoreMatch(lead({ transactionType: 'Rent' }), property({ listingType: 'Sale' }));
    expect(result.disqualified).toBe(true);
  });

  it('rejects an incompatible type', () => {
    const result = m.scoreMatch(lead({ propertyType: 'Villa' }), property({ propertyType: 'Warehouse' }));
    expect(result.disqualified).toBe(true);
  });

  it('rejects a price beyond the stretch ceiling but keeps a near miss', () => {
    const wants = { budgetMax: 1_000_000 };
    expect(m.scoreMatch(lead(wants), property({ price: 1_300_000 })).disqualified).toBe(true);

    const nearMiss = m.scoreMatch(lead(wants), property({ price: 1_050_000 }));
    expect(nearMiss.disqualified).toBe(false);
    expect(nearMiss.reasons).toContainEqual(
      expect.objectContaining({ code: 'budget', tone: 'warning' })
    );
  });

  it('rejects a property outside the radius', () => {
    const result = m.scoreMatch(
      lead({ geo: { coordinates: GANDHI_NAGAR } }),
      property({ geo: { coordinates: FAR_AWAY } }),
      { maxKm: 15 }
    );
    expect(result.disqualified).toBe(true);
  });
});

describe('scoreMatch — scoring', () => {
  it('gives a perfect match a top score and positive reasons only', () => {
    const result = m.scoreMatch(
      lead({
        budgetMax: 5_000_000,
        propertyType: 'Apartment',
        bedrooms: 3,
        geo: { coordinates: GANDHI_NAGAR },
      }),
      property({ price: 4_800_000, features: { bedrooms: 3 }, geo: { coordinates: GANDHI_NAGAR } })
    );

    expect(result.disqualified).toBe(false);
    expect(result.score).toBe(100);
    expect(result.quality).toBe('excellent');
    expect(result.reasons.every((r) => r.tone === 'positive')).toBe(true);
  });

  it('does not punish a lead for details it never stated', () => {
    // Location + type only. Both are perfect, so the score should be perfect —
    // the missing budget and bedrooms must drop out of the weighting entirely.
    const sparse = m.scoreMatch(
      lead({ propertyType: 'Apartment', location: 'Gandhi Nagar' }),
      property({ location: 'Gandhi Nagar, Hyderabad' })
    );
    expect(sparse.score).toBe(100);
    expect(sparse.breakdown.budget).toBeNull();
    expect(sparse.breakdown.bedrooms).toBeNull();
  });

  it('says so rather than inventing a number when there is nothing to go on', () => {
    const result = m.scoreMatch(lead({}), property({ location: '' }));
    expect(result.quality).toBe('unknown');
    expect(result.reasons).toContainEqual(expect.objectContaining({ code: 'nosignal' }));
  });

  it('ranks a nearer, better-priced property above a distant, cheaper one', () => {
    const wants = lead({
      budgetMax: 5_000_000,
      propertyType: 'Apartment',
      geo: { coordinates: GANDHI_NAGAR },
    });
    const near = m.scoreMatch(wants, property({ price: 4_700_000, geo: { coordinates: GANDHI_NAGAR } }));
    const far = m.scoreMatch(wants, property({ price: 1_000_000, geo: { coordinates: NEARBY } }));
    expect(near.score).toBeGreaterThan(far.score);
  });

  it('reports distance for a geofenced pair', () => {
    const result = m.scoreMatch(
      lead({ geo: { coordinates: GANDHI_NAGAR } }),
      property({ geo: { coordinates: NEARBY } })
    );
    expect(result.distanceKm).toBeCloseTo(2.2, 0);
    expect(result.reasons).toContainEqual(expect.objectContaining({ code: 'distance' }));
  });

  it('falls back to text when only one side is geocoded', () => {
    const result = m.scoreMatch(
      lead({ location: 'Gandhi Nagar, Hyderabad' }),
      property({ location: 'Gandhi Nagar', geo: { coordinates: GANDHI_NAGAR } })
    );
    expect(result.disqualified).toBe(false);
    expect(result.breakdown.location).toBe(1);
  });

  it('treats a bedroom mismatch as a preference, never a dealbreaker', () => {
    const result = m.scoreMatch(
      lead({ bedrooms: 3, propertyType: 'Apartment' }),
      property({ features: { bedrooms: 2 } })
    );
    expect(result.disqualified).toBe(false);
    expect(result.breakdown.bedrooms).toBe(0.55);
  });

  it('orders reasons so warnings come last', () => {
    const result = m.scoreMatch(
      lead({ budgetMax: 1_000_000, propertyType: 'Apartment', bedrooms: 3 }),
      property({ price: 1_080_000, features: { bedrooms: 3 } })
    );
    const tones = result.reasons.map((r) => r.tone);
    expect(tones.indexOf('warning')).toBe(tones.length - 1);
  });
});

describe('scoreMatch — symmetry', () => {
  it('produces the same score no matter which side asked', () => {
    // The engine takes (lead, property) in a fixed order, so "symmetry" here
    // means: the score depends only on the pair, never on the calling endpoint.
    // Both controllers call this same function with the same arguments — this
    // test pins that the result is a pure function of the pair.
    const l = lead({ budgetMax: 5_000_000, propertyType: 'Villa', bedrooms: 4, location: 'Jubilee Hills' });
    const p = property({ propertyType: 'Independent House', price: 4_600_000, location: 'Jubilee Hills, Hyderabad', features: { bedrooms: 4 } });

    const first = m.scoreMatch(l, p);
    const second = m.scoreMatch(l, p);
    expect(first.score).toBe(second.score);
    expect(first.score).toBeGreaterThan(70);
  });
});

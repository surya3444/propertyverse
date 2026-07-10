// End-to-end matching against a real MongoDB (in-memory).
//
// The engine's arithmetic is covered by matchingService.test.js. What this file
// pins down is the *query* layer, which is where matching was actually broken:
// an un-cast agentId inside $geoNear.query, and $geoNear silently dropping every
// document that had no coordinates yet.

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// The geocoder is only reached for leads with text but no point; never call out.
jest.mock('../../services/locationService', () => ({
  geocodeText: jest.fn().mockResolvedValue(null),
  autocomplete: jest.fn(),
  details: jest.fn(),
  isConfigured: () => false,
}));

const Lead = require('../../models/Lead');
const Property = require('../../models/Property');
const matchController = require('../matchController');

const GANDHI_NAGAR = [78.4867, 17.385];
const NEARBY = [78.5067, 17.39]; // ~2.2 km away
const MUMBAI = [72.8777, 19.076]; // ~620 km away

let mongod;
const agentId = new mongoose.Types.ObjectId();
const otherAgentId = new mongoose.Types.ObjectId();

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // $geoNear requires the 2dsphere indexes the schemas declare.
  await Promise.all([Lead.syncIndexes(), Property.syncIndexes()]);
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await Promise.all([Lead.deleteMany({}), Property.deleteMany({})]);
});

// Minimal express double: capture whatever the controller sends.
function mockRes() {
  const res = {};
  res.statusCode = null;
  res.body = null;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
}

const asAgent = (params, query = {}) => ({ user: { id: agentId.toString() }, params, query });

const makeProperty = (fields) =>
  Property.create({
    agentId,
    title: 'A listing',
    price: 5_000_000,
    propertyType: 'Apartment',
    listingType: 'Sale',
    location: 'Gandhi Nagar, Hyderabad',
    isAvailable: true,
    ...fields,
  });

const makeLead = (requirements, overrides = {}) =>
  Lead.create({
    agentId,
    phoneNumber: '9999999999',
    clientName: 'Asha',
    requirements: { transactionType: 'Buy', ...requirements },
    ...overrides,
  });

const point = (coordinates) => ({ type: 'Point', coordinates });

describe('findMatchesForLead', () => {
  it('finds geofenced matches — the un-cast agentId used to make this return zero', async () => {
    await makeProperty({ geo: point(NEARBY) });
    const lead = await makeLead({ budgetMax: 6_000_000, propertyType: 'Apartment', geo: point(GANDHI_NAGAR) });

    const res = mockRes();
    await matchController.findMatchesForLead(asAgent({ leadId: lead._id.toString() }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.geofenced).toBe(true);
    expect(res.body.matches).toHaveLength(1);
    expect(res.body.matches[0].distanceKm).toBeCloseTo(2.2, 0);
    expect(res.body.matches[0].matchScore).toBeGreaterThan(0);
  });

  it('still surfaces listings that were never geocoded', async () => {
    await makeProperty({ geo: point(NEARBY), title: 'Geocoded' });
    await makeProperty({ title: 'Never geocoded' }); // no geo field at all
    const lead = await makeLead({ propertyType: 'Apartment', geo: point(GANDHI_NAGAR) });

    const res = mockRes();
    await matchController.findMatchesForLead(asAgent({ leadId: lead._id.toString() }), res);

    const titles = res.body.matches.map((m) => m.title).sort();
    expect(titles).toEqual(['Geocoded', 'Never geocoded']);
  });

  it('excludes another agent\'s inventory', async () => {
    await Property.create({
      agentId: otherAgentId,
      title: 'Not yours',
      price: 1_000_000,
      propertyType: 'Apartment',
      listingType: 'Sale',
      location: 'Gandhi Nagar',
      isAvailable: true,
      geo: point(NEARBY),
    });
    const lead = await makeLead({ geo: point(GANDHI_NAGAR) });

    const res = mockRes();
    await matchController.findMatchesForLead(asAgent({ leadId: lead._id.toString() }), res);
    expect(res.body.matches).toHaveLength(0);
  });

  it('drops listings outside the radius but keeps a slight budget overshoot', async () => {
    await makeProperty({ geo: point(MUMBAI), title: 'Too far' });
    await makeProperty({ geo: point(NEARBY), price: 5_200_000, title: 'Slightly over budget' });
    const lead = await makeLead({ budgetMax: 5_000_000, propertyType: 'Apartment', geo: point(GANDHI_NAGAR) });

    const res = mockRes();
    await matchController.findMatchesForLead(asAgent({ leadId: lead._id.toString() }), res);

    expect(res.body.matches.map((m) => m.title)).toEqual(['Slightly over budget']);
    expect(res.body.matches[0].matchReasons).toContainEqual(
      expect.objectContaining({ code: 'budget', tone: 'warning' })
    );
  });

  it('matches a Villa hunter against an Independent House, not a Warehouse', async () => {
    await makeProperty({ propertyType: 'Independent House', title: 'House' });
    await makeProperty({ propertyType: 'Warehouse', title: 'Warehouse' });
    const lead = await makeLead({ propertyType: 'Villa', location: 'Gandhi Nagar' });

    const res = mockRes();
    await matchController.findMatchesForLead(asAgent({ leadId: lead._id.toString() }), res);
    expect(res.body.matches.map((m) => m.title)).toEqual(['House']);
  });

  it('keeps a buyer away from rentals', async () => {
    await makeProperty({ listingType: 'Rent', monthlyRent: 20000, title: 'Rental' });
    const lead = await makeLead({ transactionType: 'Buy', location: 'Gandhi Nagar' });

    const res = mockRes();
    await matchController.findMatchesForLead(asAgent({ leadId: lead._id.toString() }), res);
    expect(res.body.matches).toHaveLength(0);
  });

  it('ranks best-fit first and paginates without reshuffling', async () => {
    await makeProperty({ price: 4_900_000, geo: point(GANDHI_NAGAR), title: 'Best' });
    await makeProperty({ price: 1_000_000, geo: point(NEARBY), title: 'Cheap and further' });
    const lead = await makeLead({ budgetMax: 5_000_000, propertyType: 'Apartment', geo: point(GANDHI_NAGAR) });

    const res = mockRes();
    await matchController.findMatchesForLead(asAgent({ leadId: lead._id.toString() }, { limit: '1' }), res);

    expect(res.body.total).toBe(2);
    expect(res.body.matches).toHaveLength(1);
    expect(res.body.matches[0].title).toBe('Best');
  });
});

describe('findLeadsForProperty', () => {
  it('finds geofenced leads for a property', async () => {
    await makeLead({ budgetMax: 6_000_000, propertyType: 'Apartment', geo: point(NEARBY) });
    const property = await makeProperty({ geo: point(GANDHI_NAGAR) });

    const res = mockRes();
    await matchController.findLeadsForProperty(asAgent({ propertyId: property._id.toString() }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.geofenced).toBe(true);
    expect(res.body.leads).toHaveLength(1);
  });

  it('includes leads whose area was never geocoded', async () => {
    await makeLead({ propertyType: 'Apartment', geo: point(NEARBY) }, { clientName: 'Geocoded' });
    await makeLead({ propertyType: 'Apartment', location: 'Gandhi Nagar' }, { clientName: 'Text only' });
    const property = await makeProperty({ geo: point(GANDHI_NAGAR) });

    const res = mockRes();
    await matchController.findLeadsForProperty(asAgent({ propertyId: property._id.toString() }), res);

    expect(res.body.leads.map((l) => l.clientName).sort()).toEqual(['Geocoded', 'Text only']);
  });

  it('scores a pair identically from both directions', async () => {
    const lead = await makeLead({
      budgetMax: 5_000_000,
      propertyType: 'Apartment',
      bedrooms: 3,
      geo: point(NEARBY),
    });
    const property = await makeProperty({
      price: 4_800_000,
      features: { bedrooms: 3 },
      geo: point(GANDHI_NAGAR),
    });

    const forward = mockRes();
    await matchController.findMatchesForLead(asAgent({ leadId: lead._id.toString() }), forward);
    const reverse = mockRes();
    await matchController.findLeadsForProperty(asAgent({ propertyId: property._id.toString() }), reverse);

    expect(forward.body.matches[0].matchScore).toBe(reverse.body.leads[0].matchScore);
  });

  it('excludes closed leads', async () => {
    await makeLead({ propertyType: 'Apartment', location: 'Gandhi Nagar' }, { status: 'Closed' });
    const property = await makeProperty({});

    const res = mockRes();
    await matchController.findLeadsForProperty(asAgent({ propertyId: property._id.toString() }), res);
    expect(res.body.leads).toHaveLength(0);
  });

  it('matches a lead that stated a longer area name than the listing', async () => {
    // The old substring test compared property.location.includes(lead.location),
    // so this lead — who was more specific — matched nothing.
    await makeLead({ propertyType: 'Apartment', location: 'Gandhi Nagar, Hyderabad, India' });
    const property = await makeProperty({ location: 'Gandhi Nagar' });

    const res = mockRes();
    await matchController.findLeadsForProperty(asAgent({ propertyId: property._id.toString() }), res);

    expect(res.body.leads).toHaveLength(1);
    expect(res.body.leads[0].matchReasons).toContainEqual(
      expect.objectContaining({ code: 'area', tone: 'positive' })
    );
  });
});

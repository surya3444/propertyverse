const locationService = require('../services/locationService');

// GET /api/locations/autocomplete?q=gandhi%20nagar&sessiontoken=...
exports.autocomplete = async (req, res, next) => {
  try {
    const results = await locationService.autocomplete(req.query.q, req.query.sessiontoken);
    res.status(200).json({ results });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
};

// GET /api/locations/details?placeId=...&sessiontoken=...
exports.details = async (req, res, next) => {
  try {
    const place = await locationService.details(req.query.placeId, req.query.sessiontoken);
    res.status(200).json({ place });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
};

module.exports = exports;

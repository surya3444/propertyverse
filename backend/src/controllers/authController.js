const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Deliberately permissive: enough to catch a typo, not enough to reject a valid
// address. Real verification would be a confirmation email, which we don't send.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD_LENGTH = 8;

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d', algorithm: 'HS256' }
  );
}

exports.register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }
    if (typeof email !== 'string' || !EMAIL.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }

    const normalisedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalisedEmail });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const user = new User({ name, email: normalisedEmail, phone });
    user.password = password; // hashed via the virtual + pre-save hook
    await user.save();

    const token = signToken(user);
    res.status(201).json({ message: 'Account created.', token, user });
  } catch (error) {
    // Two concurrent registrations for the same address race past the findOne
    // above; the unique index catches the loser. That's a conflict, not a 500.
    if (error && error.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to create account.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Reject non-strings before they reach Mongo: a `{"$gt": ""}` email would
    // otherwise throw inside toLowerCase() and surface as an opaque 500.
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user);
    res.status(200).json({ message: 'Logged in.', token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to log in.' });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.status(200).json({ user });
  } catch (error) {
    console.error('Fetch profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
};

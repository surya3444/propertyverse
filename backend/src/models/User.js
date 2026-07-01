const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  phone: {
    type: String,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  }
}, { timestamps: true });

// Hash the password whenever a plain `password` virtual is set on the document.
userSchema.virtual('password').set(function (value) {
  this._plainPassword = value;
});

// Hash on validate (not save) so `passwordHash` is populated before Mongoose
// runs the `required` check — validation runs ahead of `pre('save')` hooks.
userSchema.pre('validate', async function () {
  if (!this._plainPassword) return;
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this._plainPassword, salt);
  this._plainPassword = undefined;
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

// Never leak the password hash in JSON responses.
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);

const User = require('../models/User');

const IFTIKHAR_NAME_HINTS = [
  { firstName: /^muhammad$/i, lastName: /iftikhar/i },
  { firstName: /iftikhar/i },
  { email: /iftikhar/i }
];

let cachedIftikharId = null;

const resolveIftikharAccountsManager = async () => {
  if (cachedIftikharId) {
    const cached = await User.findById(cachedIftikharId).select('_id firstName lastName email');
    if (cached) return cached;
    cachedIftikharId = null;
  }

  const users = await User.find({ isActive: { $ne: false } })
    .select('_id firstName lastName email')
    .lean();

  const match = users.find((user) => {
    const first = String(user.firstName || '').trim();
    const last = String(user.lastName || '').trim();
    const email = String(user.email || '').trim();
    return IFTIKHAR_NAME_HINTS.some((hint) => {
      if (hint.email && hint.email.test(email)) return true;
      if (hint.firstName && hint.lastName) {
        return hint.firstName.test(first) && hint.lastName.test(last);
      }
      if (hint.firstName && hint.firstName.test(first)) return true;
      return false;
    });
  });

  if (!match) {
    throw new Error('Muhammad Iftikhar (Sr Manager Accounts) user was not found. Add the user in User Management.');
  }

  cachedIftikharId = match._id;
  return match;
};

module.exports = {
  resolveIftikharAccountsManager
};

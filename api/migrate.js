const { getSql } = require('../lib/db');

module.exports = async (req, res) => {
  if (req.headers['x-migrate-secret'] !== process.env.SESSION_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const sql = getSql();
  try {
    await sql`ALTER TABLE roteiros ADD COLUMN IF NOT EXISTS token_publico text unique`;
    return res.status(200).json({ ok: true, msg: 'Migration aplicada.' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

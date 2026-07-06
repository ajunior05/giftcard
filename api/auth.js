const { getSql } = require('../lib/db');
const {
  hashPassword, verifyPassword,
  signSession, verifySession,
  parseCookies, setSessionCookie, clearSessionCookie
} = require('../lib/crypto');

// Rate limiting: max 10 tentativas de login por IP a cada 15 minutos
const loginAttempts = new Map();
const LIMIT = 10;
const WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, start: now });
    return true;
  }
  if (entry.count >= LIMIT) return false;
  entry.count++;
  return true;
}

module.exports = async (req, res) => {
  const sql = getSql();
  const action = req.query.action || (req.body && req.body.action);

  try {
    if (req.method === 'POST' && action === 'signup') {
      const { email, password } = req.body;
      if (!email || !password || password.length < 6) {
        return res.status(400).json({ error: 'E-mail e senha (mínimo 6 caracteres) são obrigatórios.' });
      }
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await sql`SELECT id FROM users WHERE email = ${normalizedEmail}`;
      if (existing.length) return res.status(409).json({ error: 'Este e-mail já tem cadastro.' });

      const passwordHash = hashPassword(password);
      const rows = await sql`
        INSERT INTO users (email, password_hash) VALUES (${normalizedEmail}, ${passwordHash})
        RETURNING id`;
      setSessionCookie(res, signSession(rows[0].id));
      return res.status(200).json({ email: normalizedEmail });
    }

    if (req.method === 'POST' && action === 'login') {
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
      if (!checkRateLimit(ip)) {
        return res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos.' });
      }
      const { email, password } = req.body;
      const normalizedEmail = (email || '').toLowerCase().trim();
      const rows = await sql`SELECT id, password_hash FROM users WHERE email = ${normalizedEmail}`;
      if (!rows.length || !verifyPassword(password, rows[0].password_hash)) {
        return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      }
      setSessionCookie(res, signSession(rows[0].id));
      return res.status(200).json({ email: normalizedEmail });
    }

    if (req.method === 'GET' && action === 'me') {
      const userId = verifySession(parseCookies(req.headers.cookie).session);
      if (!userId) return res.status(401).json({ error: 'not logged in' });
      const rows = await sql`SELECT email FROM users WHERE id = ${userId}`;
      if (!rows.length) return res.status(401).json({ error: 'not logged in' });
      return res.status(200).json({ email: rows[0].email });
    }

    if (req.method === 'POST' && action === 'logout') {
      clearSessionCookie(res);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Ação inválida.' });
  } catch (e) {
    console.error('[auth]', e);
    return res.status(500).json({ error: 'Erro no servidor.' });
  }
};

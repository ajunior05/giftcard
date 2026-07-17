const { getSql } = require('../lib/db');
const { verifySession, parseCookies } = require('../lib/crypto');

function getUserId(req) {
  return verifySession(parseCookies(req.headers.cookie).session);
}

module.exports = async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Não autenticado.' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não suportado.' });
  const sql = getSql();

  try {
    const rows = await sql`
      SELECT id, card_name, company, valor_debitado, saldo_anterior, saldo_novo, currency, created_at
      FROM historico_uso_gift_cards
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 200`;
    return res.status(200).json({ historico: rows });
  } catch (e) {
    console.error('[historico]', e);
    return res.status(500).json({ error: 'Erro no servidor.' });
  }
};

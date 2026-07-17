const { getSql } = require('../lib/db');
const { encryptPin, decryptPin, verifySession, parseCookies } = require('../lib/crypto');

function getUserId(req) {
  return verifySession(parseCookies(req.headers.cookie).session);
}

module.exports = async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Não autenticado.' });
  const sql = getSql();

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, company, name, value, currency, code, pin_encrypted
        FROM gift_cards WHERE user_id = ${userId} ORDER BY created_at`;
      const cards = rows.map(r => ({
        id: r.id, company: r.company, name: r.name, value: r.value,
        currency: r.currency, code: r.code, pin: decryptPin(r.pin_encrypted)
      }));
      return res.status(200).json({ cards });
    }

    if (req.method === 'POST') {
      const { company, name, value, currency, code, pin } = req.body;
      if (!name || !code) return res.status(400).json({ error: 'Nome e código são obrigatórios.' });
      const rows = await sql`
        INSERT INTO gift_cards (user_id, company, name, value, currency, code, pin_encrypted)
        VALUES (${userId}, ${company || ''}, ${name}, ${value || 0}, ${currency || 'R$'}, ${code}, ${encryptPin(pin)})
        RETURNING id`;
      return res.status(200).json({ id: rows[0].id });
    }

    if (req.method === 'PATCH') {
      const { id, debit, company, name, value, currency, code, pin } = req.body;
      if (!id) return res.status(400).json({ error: 'id obrigatório.' });

      if (typeof debit === 'number') {
        const rows = await sql`SELECT company, name, value, currency FROM gift_cards WHERE id = ${id} AND user_id = ${userId}`;
        if (!rows.length) return res.status(404).json({ error: 'Não encontrado.' });
        const saldoAnterior = Number(rows[0].value);
        const novoSaldo = Math.max(0, saldoAnterior - debit);
        const valorDebitado = saldoAnterior - novoSaldo;
        await sql`UPDATE gift_cards SET value = ${novoSaldo} WHERE id = ${id} AND user_id = ${userId}`;
        await sql`
          INSERT INTO historico_uso_gift_cards
            (user_id, gift_card_id, card_name, company, valor_debitado, saldo_anterior, saldo_novo, currency)
          VALUES (${userId}, ${id}, ${rows[0].name}, ${rows[0].company || ''}, ${valorDebitado}, ${saldoAnterior}, ${novoSaldo}, ${rows[0].currency || 'US$'})`;
        return res.status(200).json({ value: novoSaldo });
      }

      if (pin !== undefined) {
        await sql`
          UPDATE gift_cards SET
            company = COALESCE(${company ?? null}, company),
            name = COALESCE(${name ?? null}, name),
            value = COALESCE(${value ?? null}, value),
            currency = COALESCE(${currency ?? null}, currency),
            code = COALESCE(${code ?? null}, code),
            pin_encrypted = ${encryptPin(pin)}
          WHERE id = ${id} AND user_id = ${userId}`;
      } else {
        await sql`
          UPDATE gift_cards SET
            company = COALESCE(${company ?? null}, company),
            name = COALESCE(${name ?? null}, name),
            value = COALESCE(${value ?? null}, value),
            currency = COALESCE(${currency ?? null}, currency),
            code = COALESCE(${code ?? null}, code)
          WHERE id = ${id} AND user_id = ${userId}`;
      }
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM gift_cards WHERE id = ${id} AND user_id = ${userId}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método não suportado.' });
  } catch (e) {
    console.error('[cards]', e);
    return res.status(500).json({ error: 'Erro no servidor.' });
  }
};

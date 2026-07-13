const { getSql } = require('../lib/db');
const { verifySession, parseCookies } = require('../lib/crypto');

function getUserId(req) {
  return verifySession(parseCookies(req.headers.cookie).session);
}

module.exports = async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Não autenticado.' });
  const sql = getSql();

  try {
    if (req.method === 'GET') {
      const { id } = req.query;
      if (id) {
        const rows = await sql`SELECT * FROM roteiros WHERE id = ${id} AND user_id = ${userId}`;
        if (!rows.length) return res.status(404).json({ error: 'Não encontrado.' });
        const atividades = await sql`
          SELECT * FROM atividades_roteiro WHERE roteiro_id = ${id}
          ORDER BY dia_numero, ordem`;
        return res.status(200).json({ roteiro: rows[0], atividades });
      }
      const rows = await sql`SELECT * FROM roteiros WHERE user_id = ${userId} ORDER BY data_inicio`;
      return res.status(200).json({ roteiros: rows });
    }

    if (req.method === 'POST') {
      const { action, titulo, destino, dataInicio, dataFim, adultos, atividades,
              roteiroId: rId, diaNumero, dataDia, diaSemana, horarioInicio, horarioFim, endereco } = req.body;

      if (action === 'addAtividade') {
        if (!rId || !titulo || !diaNumero) return res.status(400).json({ error: 'Campos obrigatórios.' });
        const check = await sql`SELECT id FROM roteiros WHERE id = ${rId} AND user_id = ${userId}`;
        if (!check.length) return res.status(403).json({ error: 'Não autorizado.' });
        const maxOrd = await sql`
          SELECT COALESCE(MAX(ordem), 0) AS m FROM atividades_roteiro
          WHERE roteiro_id = ${rId} AND dia_numero = ${diaNumero}`;
        const ordem = Number(maxOrd[0].m) + 1;
        const rows = await sql`
          INSERT INTO atividades_roteiro
            (roteiro_id, dia_numero, data_dia, dia_semana, ordem, titulo, horario_inicio, horario_fim, endereco)
          VALUES
            (${rId}, ${diaNumero}, ${dataDia || null}, ${diaSemana || ''}, ${ordem},
             ${titulo}, ${horarioInicio || ''}, ${horarioFim || ''}, ${endereco || ''})
          RETURNING id`;
        return res.status(200).json({ id: rows[0].id });
      }

      if (!titulo) return res.status(400).json({ error: 'Título obrigatório.' });
      const rows = await sql`
        INSERT INTO roteiros (user_id, titulo, destino, data_inicio, data_fim, adultos)
        VALUES (${userId}, ${titulo}, ${destino || ''}, ${dataInicio || null}, ${dataFim || null}, ${adultos || 1})
        RETURNING id`;
      const roteiroId = rows[0].id;
      if (atividades?.length) {
        for (const a of atividades) {
          await sql`
            INSERT INTO atividades_roteiro
              (roteiro_id, dia_numero, data_dia, dia_semana, ordem, titulo, horario_inicio, horario_fim, endereco)
            VALUES
              (${roteiroId}, ${a.diaNumero}, ${a.dataDia || null}, ${a.diaSemana || ''}, ${a.ordem},
               ${a.titulo}, ${a.horarioInicio || ''}, ${a.horarioFim || ''}, ${a.endereco || ''})`;
        }
      }
      return res.status(200).json({ id: roteiroId });
    }

    if (req.method === 'PATCH') {
      const { id, concluida, notas } = req.body;
      if (!id) return res.status(400).json({ error: 'id obrigatório.' });
      const check = await sql`
        SELECT a.id FROM atividades_roteiro a
        JOIN roteiros r ON r.id = a.roteiro_id
        WHERE a.id = ${id} AND r.user_id = ${userId}`;
      if (!check.length) return res.status(404).json({ error: 'Não encontrado.' });
      await sql`
        UPDATE atividades_roteiro
        SET concluida = ${concluida ?? false}, notas = ${notas ?? ''}
        WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id obrigatório.' });
      await sql`DELETE FROM roteiros WHERE id = ${id} AND user_id = ${userId}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método não suportado.' });
  } catch (e) {
    console.error('[roteiros]', e);
    return res.status(500).json({ error: 'Erro no servidor.' });
  }
};

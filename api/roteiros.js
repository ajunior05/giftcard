const { getSql } = require('../lib/db');
const { verifySession, parseCookies } = require('../lib/crypto');

function getUserId(req) {
  return verifySession(parseCookies(req.headers.cookie).session);
}

module.exports = async (req, res) => {
  const sql = getSql();

  // Public access by token — no auth required
  if (req.method === 'GET' && req.query.token) {
    try {
      const token = req.query.token;
      const rows = await sql`SELECT * FROM roteiros WHERE token_publico = ${token}`;
      if (!rows.length) return res.status(404).json({ error: 'Roteiro não encontrado.' });
      const roteiro = rows[0];
      const atividades = await sql`
        SELECT * FROM atividades_roteiro WHERE roteiro_id = ${roteiro.id}
        ORDER BY dia_numero, ordem`;
      return res.status(200).json({ roteiro, atividades });
    } catch (e) {
      return res.status(500).json({ error: 'Erro no servidor.' });
    }
  }

  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Não autenticado.' });

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

      if (action === 'gerarToken') {
        const { id } = req.body;
        const check = await sql`SELECT id, token_publico FROM roteiros WHERE id = ${id} AND user_id = ${userId}`;
        if (!check.length) return res.status(403).json({ error: 'Não autorizado.' });
        if (check[0].token_publico) return res.status(200).json({ token: check[0].token_publico });
        const token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
        await sql`UPDATE roteiros SET token_publico = ${token} WHERE id = ${id}`;
        return res.status(200).json({ token });
      }

      if (action === 'importarComToken') {
        const { token } = req.body;
        const rows = await sql`SELECT * FROM roteiros WHERE token_publico = ${token}`;
        if (!rows.length) return res.status(404).json({ error: 'Roteiro não encontrado.' });
        const r = rows[0];
        if (r.user_id === userId) return res.status(400).json({ error: 'Este roteiro já é seu.' });
        const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const newRows = await sql`
          INSERT INTO roteiros (user_id, titulo, destino, data_inicio, data_fim, adultos)
          VALUES (${userId}, ${`${r.titulo} (importado ${now})`}, ${r.destino}, ${r.data_inicio}, ${r.data_fim}, ${r.adultos})
          RETURNING id`;
        const newId = newRows[0].id;
        const atividades = await sql`
          SELECT * FROM atividades_roteiro WHERE roteiro_id = ${r.id} ORDER BY dia_numero, ordem`;
        for (const a of atividades) {
          await sql`
            INSERT INTO atividades_roteiro
              (roteiro_id, dia_numero, data_dia, dia_semana, ordem, titulo, horario_inicio, horario_fim, endereco, notas)
            VALUES
              (${newId}, ${a.dia_numero}, ${a.data_dia}, ${a.dia_semana}, ${a.ordem},
               ${a.titulo}, ${a.horario_inicio}, ${a.horario_fim}, ${a.endereco}, ${a.notas})`;
        }
        return res.status(200).json({ id: newId });
      }

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
      const { id, action, concluida, notas, titulo, horarioInicio, horarioFim, endereco,
              destino, dataInicio, dataFim, adultos } = req.body;
      if (!id) return res.status(400).json({ error: 'id obrigatório.' });

      if (action === 'editRoteiro') {
        if (!titulo) return res.status(400).json({ error: 'Título obrigatório.' });
        const check = await sql`SELECT id FROM roteiros WHERE id = ${id} AND user_id = ${userId}`;
        if (!check.length) return res.status(404).json({ error: 'Não encontrado.' });
        await sql`
          UPDATE roteiros
          SET titulo      = ${titulo},
              destino     = ${destino || ''},
              data_inicio = ${dataInicio || null},
              data_fim    = ${dataFim || null},
              adultos     = ${adultos || 1}
          WHERE id = ${id}`;
        return res.status(200).json({ ok: true });
      }

      const check = await sql`
        SELECT a.id FROM atividades_roteiro a
        JOIN roteiros r ON r.id = a.roteiro_id
        WHERE a.id = ${id} AND r.user_id = ${userId}`;
      if (!check.length) return res.status(404).json({ error: 'Não encontrado.' });
      if (action === 'editAtividade') {
        if (!titulo) return res.status(400).json({ error: 'Título obrigatório.' });
        await sql`
          UPDATE atividades_roteiro
          SET titulo = ${titulo},
              horario_inicio = ${horarioInicio || ''},
              horario_fim    = ${horarioFim || ''},
              endereco       = ${endereco || ''}
          WHERE id = ${id}`;
      } else {
        await sql`
          UPDATE atividades_roteiro
          SET concluida = ${concluida ?? false}, notas = ${notas ?? ''}
          WHERE id = ${id}`;
      }
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id, atividadeId, roteiroId, diaNumero } = req.query;
      if (atividadeId) {
        await sql`
          DELETE FROM atividades_roteiro
          WHERE id = ${atividadeId}
            AND roteiro_id IN (SELECT id FROM roteiros WHERE user_id = ${userId})`;
        return res.status(200).json({ ok: true });
      }
      if (diaNumero && roteiroId) {
        const check = await sql`SELECT id FROM roteiros WHERE id = ${roteiroId} AND user_id = ${userId}`;
        if (!check.length) return res.status(403).json({ error: 'Não autorizado.' });
        await sql`DELETE FROM atividades_roteiro WHERE roteiro_id = ${roteiroId} AND dia_numero = ${diaNumero}`;
        return res.status(200).json({ ok: true });
      }
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

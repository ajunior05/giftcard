const SUPPORTED = ['USD', 'BRL', 'EUR', 'GBP', 'CAD', 'AUD'];

module.exports = async (req, res) => {
  const base = ((req.query && req.query.base) || 'USD').toUpperCase();
  if (!SUPPORTED.includes(base)) return res.status(400).json({ error: 'Moeda inválida.' });

  const key = process.env.EXCHANGE_RATE_API_KEY;
  if (!key) return res.status(500).json({ error: 'EXCHANGE_RATE_API_KEY não configurada.' });

  try {
    const r = await fetch(`https://v6.exchangerate-api.com/v6/${key}/latest/${base}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (d.result !== 'success') throw new Error(d['error-type'] || 'Erro na API');

    const rates = {};
    SUPPORTED.filter(c => c !== base).forEach(c => {
      if (d.conversion_rates[c]) rates[c] = d.conversion_rates[c];
    });

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    res.json({ base, rates, updatedAt: d.time_last_update_utc });
  } catch (e) {
    res.status(502).json({ error: 'Não foi possível buscar cotações.' });
  }
};

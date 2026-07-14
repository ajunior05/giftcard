const SUPPORTED = ['USD', 'BRL', 'EUR', 'GBP', 'CAD', 'AUD'];

module.exports = async (req, res) => {
  const base = ((req.query && req.query.base) || 'USD').toUpperCase();
  if (!SUPPORTED.includes(base)) return res.status(400).json({ error: 'Moeda inválida.' });

  const key = process.env.EXCHANGE_RATE_API_KEY;
  if (!key) return res.status(500).json({ error: 'EXCHANGE_RATE_API_KEY não configurada.' });

  try {
    const r = await fetch(`https://openexchangerates.org/api/latest.json?app_id=${key}&symbols=${SUPPORTED.join(',')}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (d.error) throw new Error(d.description || 'Erro na API');

    // free plan always returns USD as base; cross-calculate for other bases
    const usdRates = d.rates;
    const baseInUsd = usdRates[base] || 1;
    const rates = {};
    SUPPORTED.filter(c => c !== base).forEach(c => {
      if (usdRates[c]) rates[c] = usdRates[c] / baseInUsd;
    });

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    res.json({ base, rates, updatedAt: new Date(d.timestamp * 1000).toUTCString() });
  } catch (e) {
    res.status(502).json({ error: 'Não foi possível buscar cotações.' });
  }
};

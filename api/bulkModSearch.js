const { URLSearchParams } = require('url');

function parseLine(line) {
  const value = String(line || '').trim();
  if (!value) return null;
  const parts = value.split(/\s+/);
  const author = parts.pop();
  const name = parts.join(' ');
  if (!name || !author) return null;
  return { input: value, name, author };
}

async function searchNexus(mod) {
  const key = process.env.NEXUS_API_KEY;
  if (!key) return { ...mod, status: 'missing_api_key' };

  const params = new URLSearchParams({ query: `${mod.name} ${mod.author}` });
  const response = await fetch(`https://api.nexusmods.com/v1/games/stardewvalley/search.json?${params}`, {
    headers: { APIKEY: key, 'User-Agent': 'nexus-loader-bulk-search' }
  });

  if (!response.ok) return { ...mod, status: 'search_failed', code: response.status };

  const data = await response.json();
  const exact = (data || []).find(x =>
    String(x.name || '').toLowerCase().includes(mod.name.toLowerCase()) &&
    String(x.author || '').toLowerCase() === mod.author.toLowerCase()
  );

  return {
    ...mod,
    status: exact ? 'found' : 'not_found',
    modId: exact?.mod_id || null,
    nexusName: exact?.name || null,
    nexusAuthor: exact?.author || null
  };
}

module.exports = async function bulkModSearch(req, res) {
  const body = req.body || {};
  const text = body.text || body.mods || '';
  const mods = String(text).split(/\r?\n/).map(parseLine).filter(Boolean);

  const results = [];
  for (const mod of mods) {
    results.push(await searchNexus(mod));
  }

  res.json({
    ok: true,
    total: results.length,
    found: results.filter(x => x.status === 'found').length,
    results
  });
};

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
  if (!key) return { ...mod, status: 'error', error: 'missing_api_key' };

  try {
    const params = new URLSearchParams({ query: `${mod.name} ${mod.author}` });
    const response = await fetch(`https://api.nexusmods.com/v1/games/stardewvalley/search.json?${params}`, {
      headers: { APIKEY: key, 'User-Agent': 'nexus-loader-bulk-search' }
    });

    if (!response.ok) {
      return { ...mod, status: 'error', error: `nexus_${response.status}` };
    }

    const data = Array.isArray(await response.json()) ? await response.json() : [];
    const candidates = data.filter(x =>
      String(x.name || '').toLowerCase().includes(mod.name.toLowerCase())
    );

    const exact = candidates.filter(x =>
      !mod.author || String(x.author || '').toLowerCase() === mod.author.toLowerCase()
    );

    if (exact.length === 1) {
      return {
        ...mod,
        status: 'found',
        modId: exact[0].mod_id,
        nexusName: exact[0].name,
        nexusAuthor: exact[0].author
      };
    }

    if (exact.length > 1 || candidates.length > 1) {
      return {
        ...mod,
        status: 'multiple_matches',
        candidates: candidates.slice(0, 10).map(x => ({
          id: x.mod_id,
          name: x.name,
          author: x.author
        }))
      };
    }

    return { ...mod, status: 'not_found' };
  } catch (error) {
    return { ...mod, status: 'error', error: error.message };
  }
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
    multiple: results.filter(x => x.status === 'multiple_matches').length,
    errors: results.filter(x => x.status === 'error').length,
    results
  });
};

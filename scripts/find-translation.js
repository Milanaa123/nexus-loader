const fetch = global.fetch;

async function findTranslation({game='stardewvalley', modName, author}) {
  const key = process.env.NEXUS_API_KEY;
  if (!key) throw new Error('NEXUS_API_KEY missing');

  const query = `query($filter: ModsFilter!){mods(filter:$filter,first:20){nodes{id name author{name}}}}`;
  const r = await fetch('https://api.nexusmods.com/v2/graphql', {
    method:'POST',
    headers:{apikey:key,'content-type':'application/json','User-Agent':'nexus-loader'},
    body: JSON.stringify({query, variables:{filter:{name:modName}}})
  });

  const data = await r.json();
  const mods = data.data?.mods?.nodes || [];

  const candidates = mods.filter(m => {
    const sameName = (m.name || '').toLowerCase().includes('russian') || (m.name || '').toLowerCase().includes('рус');
    return sameName || (author && m.author?.name === author);
  });

  return candidates[0] ? String(candidates[0].id) : null;
}

module.exports = { findTranslation };

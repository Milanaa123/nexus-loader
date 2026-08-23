const fetch = global.fetch;

async function findTranslation({game='stardewvalley', modName, author, modId}) {
  const key = process.env.NEXUS_API_KEY;
  if (!key) throw new Error('NEXUS_API_KEY missing');

  const query = `query($filter: ModsFilter!){mods(filter:$filter,first:50){nodes{id name author{name}}}}`;
  const r = await fetch('https://api.nexusmods.com/v2/graphql', {
    method:'POST',
    headers:{apikey:key,'content-type':'application/json','User-Agent':'nexus-loader'},
    body: JSON.stringify({query, variables:{filter:{name:modName}}})
  });

  const data = await r.json();
  const mods = data.data?.mods?.nodes || [];

  const translation = mods.find(m => {
    const name = (m.name || '').toLowerCase();
    const russian = name.includes('russian') || name.includes('рус');
    const authorMatch = author && m.author?.name && m.author.name.toLowerCase() === author.toLowerCase();
    const translationNameMatch = name.includes((modName || '').toLowerCase());
    return russian && translationNameMatch || (russian && authorMatch);
  });

  if (!translation) return null;

  return {
    originalModId: modId || null,
    translationId: String(translation.id),
    translationName: translation.name,
    translationAuthor: translation.author?.name || null
  };
}

module.exports = { findTranslation };

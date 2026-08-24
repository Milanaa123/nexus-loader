const fetch = global.fetch;

async function findTranslation({game='stardewvalley', modName, author, modId}) {
  const key = process.env.NEXUS_API_KEY;
  if (!key) throw new Error('NEXUS_API_KEY missing');

  const query = `query($filter: ModsFilter!){mods(filter:$filter,first:50){nodes{id name author{name summary}}}}`;

  const r = await fetch('https://api.nexusmods.com/v2/graphql', {
    method:'POST',
    headers:{apikey:key,'content-type':'application/json','User-Agent':'nexus-loader'},
    body: JSON.stringify({query, variables:{filter:{name:modName}}})
  });

  const data = await r.json();
  const mods = data.data?.mods?.nodes || [];
  const base = (modName || '').toLowerCase();

  const translation = mods.find(m => {
    const name = (m.name || '').toLowerCase();
    const authorName = (m.author?.name || '').toLowerCase();
    const hasRussian = name.includes('russian') || name.includes('рус') || name.includes('translation') || name.includes('перевод');
    const nameMatch = name.includes(base) || base.includes(name);
    const authorMatch = author && authorName === author.toLowerCase();
    return hasRussian && (nameMatch || authorMatch);
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

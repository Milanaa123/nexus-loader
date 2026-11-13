const { createProvider } = require('./base-provider');
const { registerProvider } = require('./provider-registry');
const client = require('./nexus-client');
const nexusDownloader = require('../scripts/nexus-downloader');

function normalize(value = '') {
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

function scoreCandidate(query, candidate) {
  const wantedName = normalize(query.name);
  const wantedAuthor = normalize(query.author);
  const actualName = normalize(candidate.name);
  const actualAuthor = normalize(candidate.author);
  let score = 0;
  if (wantedName && actualName === wantedName) score += 100;
  else if (wantedName && actualName.includes(wantedName)) score += 60;
  if (wantedAuthor && actualAuthor === wantedAuthor) score += 80;
  else if (wantedAuthor && actualAuthor.includes(wantedAuthor)) score += 40;
  return score;
}

const provider = createProvider({
  id: 'nexus',
  async search(query = {}) {
    const candidates = await client.searchMods(query);
    return Object.assign(candidates.map(candidate => ({ ...candidate, score: scoreCandidate(query, candidate) })).sort((a, b) => b.score - a.score), { search: candidates.search });
  },
  async getMod(options = {}) {
    return client.getMod(options);
  },
  async download(options = {}) {
    return nexusDownloader.downloadMod(options);
  },
  async validate(file) {
    const target = typeof file === 'string' ? file : file?.path;
    return nexusDownloader.validCachedFile(target, { expectedSha256: file?.sha256 });
  }
});

module.exports = registerProvider(provider);

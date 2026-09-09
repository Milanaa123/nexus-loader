const API_V1 = process.env.NEXUS_API_V1 || 'https://api.nexusmods.com/v1';
const GRAPHQL = process.env.NEXUS_GRAPHQL || 'https://api.nexusmods.com/v2/graphql';

function apiKey() {
  const key = process.env.NEXUS_API_KEY;
  if (!key) throw new Error('NEXUS_API_KEY missing');
  return key;
}

function headers(extra = {}) {
  return {
    APIKEY: apiKey(),
    'User-Agent': 'nexus-loader/2.0',
    'Application-Name': 'nexus-loader',
    'Application-Version': '2.0',
    ...extra
  };
}

async function request(url, options = {}, retries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      const body = await response.text().catch(() => '');
      const error = new Error(`Nexus HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
      error.statusCode = response.status;
      lastError = error;
      if (![429, 500, 502, 503, 504].includes(response.status)) break;
    } catch (error) {
      lastError = error;
    }
    if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 750 * attempt));
  }
  throw lastError || new Error('Nexus request failed');
}

async function json(url, options = {}, retries = 3) {
  const response = await request(url, options, retries);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error(`Nexus returned invalid JSON: ${text.slice(0, 200)}`);
  }
}

async function graphql(query, variables) {
  const payload = await json(GRAPHQL, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ query, variables })
  });
  if (Array.isArray(payload.errors) && payload.errors.length) {
    throw new Error(`Nexus GraphQL: ${payload.errors.map(error => error.message).join(' | ')}`);
  }
  return payload.data || {};
}

async function searchMods({ game, name, limit = 40 }) {
  if (!game) throw new Error('Nexus game domain is required for search');
  if (!name) return [];
  const query = `query NexusLoaderSearch($filter: ModsFilter, $count: Int) {
    mods(filter: $filter, count: $count) {
      totalCount
      nodes {
        modId
        name
        author
        version
        status
        uploader { name memberId }
        game { id domainName name }
      }
    }
  }`;
  const variables = {
    filter: {
      gameDomainName: { value: String(game), op: 'EQUALS' },
      name: { value: String(name), op: 'WILDCARD' }
    },
    count: Math.max(1, Math.min(Number(limit) || 40, 100))
  };
  const data = await graphql(query, variables);
  const nodes = data.mods?.nodes || [];
  return nodes.map(node => ({
    modId: String(node.modId),
    name: node.name || '',
    author: node.author || node.uploader?.name || '',
    version: node.version || null,
    status: node.status || null,
    game: node.game?.domainName || game,
    gameName: node.game?.name || null
  }));
}

async function getMod({ game, modId }) {
  if (!game) throw new Error('Nexus game domain is required');
  if (!modId) throw new Error('Nexus modId is required');
  return json(`${API_V1}/games/${encodeURIComponent(game)}/mods/${encodeURIComponent(modId)}.json`, { headers: headers() });
}

async function getFiles({ game, modId }) {
  if (!game) throw new Error('Nexus game domain is required');
  if (!modId) throw new Error('Nexus modId is required');
  const data = await json(`${API_V1}/games/${encodeURIComponent(game)}/mods/${encodeURIComponent(modId)}/files.json`, { headers: headers() });
  return Array.isArray(data) ? data : (data.files || []);
}

async function getDownloadLinks({ game, modId, fileId }) {
  if (!game) throw new Error('Nexus game domain is required');
  if (!modId || !fileId) throw new Error('Nexus modId and fileId are required');
  const data = await json(`${API_V1}/games/${encodeURIComponent(game)}/mods/${encodeURIComponent(modId)}/files/${encodeURIComponent(fileId)}/download_link.json`, { headers: headers() });
  return Array.isArray(data) ? data : [];
}

module.exports = { headers, request, searchMods, getMod, getFiles, getDownloadLinks };

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseNexusUrl(value) {
  const match = String(value || '').match(/https?:\/\/(?:www\.)?nexusmods\.com\/([^/?#]+)\/mods\/(\d+)/i);
  if (!match) return null;
  return { game: match[1].toLowerCase(), nexusModId: match[2], sourceUrl: match[0] };
}

function csvFields(line) {
  const fields = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) {
      current += '"';
      i += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { fields.push(clean(current)); current = ''; }
    else current += char;
  }
  fields.push(clean(current));
  return fields;
}

function fromHeader(fields, header, defaultGame) {
  const item = {};
  header.forEach((name, index) => { item[name] = fields[index] || ''; });
  const parsedUrl = parseNexusUrl(item.url || item.sourceurl || '');
  return {
    name: clean(item.name || item.mod || ''),
    author: clean(item.author || item.uploader || ''),
    game: clean(item.game || item.gamedomain || parsedUrl?.game || defaultGame || '') || null,
    nexusModId: clean(item.modid || item.nexusmodid || parsedUrl?.nexusModId || '') || null,
    sourceUrl: item.url || item.sourceurl || parsedUrl?.sourceUrl || null
  };
}

function parsePlainLine(line, defaultGame) {
  const value = clean(line);
  if (!value) return null;
  const parsedUrl = parseNexusUrl(value);
  if (parsedUrl) return { name: '', author: '', ...parsedUrl };
  if (value.includes(',')) {
    const [name, author, game] = csvFields(value);
    return { name, author: author || '', game: game || defaultGame || null, nexusModId: null, sourceUrl: null };
  }
  const parts = value.split(' ');
  if (parts.length === 1) return { name: parts[0], author: '', game: defaultGame || null, nexusModId: null, sourceUrl: null };
  return { name: parts.slice(0, -1).join(' '), author: parts[parts.length - 1] || '', game: defaultGame || null, nexusModId: null, sourceUrl: null };
}

function parseInput(text, options = {}) {
  const defaultGame = clean(options.defaultGame || '') || null;
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  let header = null;
  let start = 0;
  const first = csvFields(lines[0]).map(field => field.toLowerCase().replace(/[^a-z]/g, ''));
  if (first.includes('name') && (first.includes('author') || first.includes('game') || first.includes('url'))) {
    header = first;
    start = 1;
  }
  const seen = new Set();
  const result = [];
  for (let index = start; index < lines.length; index += 1) {
    const item = header ? fromHeader(csvFields(lines[index]), header, defaultGame) : parsePlainLine(lines[index], defaultGame);
    if (!item || (!item.name && !item.nexusModId)) continue;
    const key = item.nexusModId ? `${item.game || ''}|id:${item.nexusModId}`.toLowerCase() : `${item.game || ''}|${item.name}|${item.author}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

module.exports = { clean, csvFields, parseNexusUrl, parseInput };

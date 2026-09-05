const { createModJob } = require('./modJobSchema');

function normalize(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeMod(mod) {
  if (!mod) return null;

  const name = normalize(mod.name);
  const author = normalize(mod.author);

  if (!name || !author) return null;

  return {
    name,
    author
  };
}

function parseLine(line) {
  const value = normalize(line);
  if (!value) return null;

  const parts = value.split(/\s+/);
  const author = parts.pop();
  const name = parts.join(' ');

  return normalizeMod({ name, author });
}

function parseCsvLine(line) {
  const value = normalize(line);
  if (!value) return null;

  const parts = value.split(',').map(normalize);
  if (parts.length < 2) return null;

  return normalizeMod({
    name: parts[0],
    author: parts[1]
  });
}

function getKey(mod) {
  return `${mod.name.toLowerCase()}::${mod.author.toLowerCase()}`;
}

function removeDuplicates(mods) {
  const seen = new Set();

  return mods.filter(mod => {
    const key = getKey(mod);
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function parse(text, options = {}) {
  const parser = options.csv ? parseCsvLine : parseLine;

  const mods = String(text || '')
    .split(/\r?\n/)
    .map(parser)
    .filter(Boolean);

  return removeDuplicates(mods);
}

function createJobsFromText(text, options = {}) {
  return parse(text, options).map(createModJob);
}

function importBatch(text, options = {}) {
  const mods = parse(text, options);

  return {
    total: mods.length,
    mods,
    jobs: mods.map(createModJob)
  };
}

module.exports = {
  normalizeMod,
  parseLine,
  parseCsvLine,
  removeDuplicates,
  parse,
  createJobsFromText,
  importBatch
};

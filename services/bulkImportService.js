const { createModJob } = require('./modJobSchema');

function normalize(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function parseLine(line) {
  const value = normalize(line);
  if (!value) return null;

  const parts = value.split(/\s+/);
  const author = parts.pop();
  const name = parts.join(' ');

  if (!name || !author) return null;

  return { name, author };
}

function parseCsvLine(line) {
  const value = normalize(line);
  if (!value) return null;

  const parts = value.split(',').map(normalize);
  if (parts.length < 2) return null;

  return {
    name: parts[0],
    author: parts[1]
  };
}

function parse(text, options = {}) {
  const parser = options.csv ? parseCsvLine : parseLine;
  const seen = new Set();

  return String(text || '')
    .split(/\r?\n/)
    .map(parser)
    .filter(Boolean)
    .filter(mod => {
      const key = `${mod.name.toLowerCase()}::${mod.author.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function createJobsFromText(text, options = {}) {
  return parse(text, options).map(createModJob);
}

module.exports = {
  parseLine,
  parseCsvLine,
  parse,
  createJobsFromText
};

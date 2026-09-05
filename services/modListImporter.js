// Parses bulk input in format:
// Mod Name Author
// Example:
// Alpaca aboba24

function parseModLine(line) {
  const value = String(line || '').trim();
  if (!value) return null;

  const parts = value.split(/\s+/);
  if (parts.length < 2) {
    return {
      name: value,
      author: null
    };
  }

  const author = parts.pop();

  return {
    name: parts.join(' '),
    author
  };
}

function importModList(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(parseModLine)
    .filter(Boolean);
}

module.exports = {
  parseModLine,
  importModList
};

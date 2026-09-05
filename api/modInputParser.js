function normalizeLine(line) {
  return String(line || '')
    .replace(/^\s*[-*]\s*/, '')
    .trim();
}

function parseInput(text = '') {
  const lines = String(text)
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);

  return lines.map((line) => {
    const parts = line.split(/\s+/);

    if (parts.length < 2) {
      return {
        name: line,
        author: null
      };
    }

    return {
      name: parts.slice(0, -1).join(' '),
      author: parts[parts.length - 1]
    };
  });
}

module.exports = { parseInput };

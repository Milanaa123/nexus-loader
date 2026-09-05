// Nexus search matching foundation.
// Converts user input (name + author) into a normalized search request.

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function createSearchRequest(name, author) {
  return {
    name: normalizeText(name),
    author: normalizeText(author),
    query: `${name} ${author}`.trim()
  };
}

function matchResult(result, expected) {
  if (!result) return false;

  const nameMatch = normalizeText(result.name).includes(expected.name);
  const authorMatch = !expected.author || normalizeText(result.author).includes(expected.author);

  return nameMatch && authorMatch;
}

module.exports = {
  createSearchRequest,
  matchResult
};

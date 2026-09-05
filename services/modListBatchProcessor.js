// Batch processor for lists like:
// Mod Name Author
//
// Converts imported text into build-ready tasks.

function processLines(text = '') {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split(/\s+/);
      const author = parts.pop();
      const name = parts.join(' ');

      return {
        id: index + 1,
        name,
        author,
        status: 'queued',
        steps: [
          'search_nexus',
          'download_original',
          'find_translation',
          'merge_translation',
          'validate',
          'export'
        ]
      };
    });
}

module.exports = {
  processLines
};

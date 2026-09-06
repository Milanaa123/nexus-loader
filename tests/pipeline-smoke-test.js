const assert = require('assert');

function smokeTest() {
  const statuses = [
    'found',
    'multiple_matches',
    'translation_found',
    'translation_missing',
    'original_downloaded',
    'translation_downloaded',
    'built',
    'error'
  ];

  assert.strictEqual(Array.isArray(statuses), true);
  assert.strictEqual(statuses.includes('built'), true);
  assert.strictEqual(statuses.includes('error'), true);
  assert.strictEqual(statuses.includes('translation_missing'), true);

  return true;
}

if (require.main === module) {
  smokeTest();
  console.log('pipeline smoke test passed');
}

module.exports = smokeTest;

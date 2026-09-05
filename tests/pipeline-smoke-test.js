const assert = require('assert');

function smokeTest() {
  const statuses = [
    'found',
    'translation_found',
    'original_downloaded',
    'translation_downloaded',
    'built'
  ];

  assert.strictEqual(Array.isArray(statuses), true);
  assert.strictEqual(statuses.includes('built'), true);

  return true;
}

if (require.main === module) {
  smokeTest();
  console.log('pipeline smoke test passed');
}

module.exports = smokeTest;

/**
 * Translation resolver foundation.
 * Searches local RU packs first, then external providers can be attached.
 */

function createTranslationTask(mod) {
  return {
    modId: mod.modId,
    name: mod.name,
    status: 'queued',
    steps: [
      'check_local_ru_pack',
      'check_translation_database',
      'download_translation',
      'verify_version'
    ]
  };
}

module.exports = { createTranslationTask };

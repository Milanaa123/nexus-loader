/**
 * Merge pipeline foundation for original mod + RU patch.
 * Actual archive operations will use existing 7zip helpers.
 */

function createMergeTask(original, translation) {
  return {
    original,
    translation,
    status: 'queued',
    steps: [
      'extract_original',
      'extract_translation',
      'overlay_translation_files',
      'validate_structure',
      'create_output_archive'
    ]
  };
}

module.exports = { createMergeTask };

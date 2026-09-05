const STATUSES = Object.freeze({
  IMPORTED: 'imported',
  NOT_FOUND: 'not_found',
  FOUND: 'found',
  MULTIPLE_MATCHES: 'multiple_matches',
  ERROR: 'error',
  TRANSLATION_FOUND: 'translation_found',
  TRANSLATION_MISSING: 'translation_missing',
  NEEDS_REVIEW: 'needs_review',
  ORIGINAL_DOWNLOADED: 'original_downloaded',
  TRANSLATION_DOWNLOADED: 'translation_downloaded',
  BUILT: 'built'
});

function createModRecord(input = {}) {
  return {
    name: String(input.name || '').trim(),
    author: String(input.author || '').trim(),
    nexusModId: input.nexusModId || null,
    translationId: input.translationId || null,
    originalFile: input.originalFile || null,
    translationFile: input.translationFile || null,
    outputFile: input.outputFile || null,
    status: input.status || STATUSES.IMPORTED,
    error: input.error || null,
    candidates: Array.isArray(input.candidates) ? input.candidates : [],
    history: Array.isArray(input.history) ? input.history : []
  };
}

function setStatus(record, status, details = {}) {
  const next = {
    ...record,
    ...details,
    status,
    history: [
      ...(record.history || []),
      { status, at: new Date().toISOString() }
    ]
  };
  return next;
}

module.exports = {
  STATUSES,
  createModRecord,
  setStatus
};

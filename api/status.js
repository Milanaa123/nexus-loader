const path = require('path');
const state = require('../lib/state-store');
const queue = require('../lib/job-queue');
const { listProviders } = require('../providers/provider-registry');
const { listGames } = require('../lib/game-registry');
const pkg = require('../package.json');
const { configurationStatus } = require('../config/storage');
require('../providers/nexus-provider');

function readResults() {
  return state.getResults();
}

module.exports = function status(req, res) {
  const results = readResults();
  const queued = queue.load();
  const progress = state.getProgress();
  const counts = {};
  for (const result of results) counts[result.status || 'unknown'] = (counts[result.status || 'unknown'] || 0) + 1;
  const ready = results
    .filter(result => result.status === 'built' && result.outputFile)
    .map(result => ({
      key: result.key,
      name: result.name,
      game: result.game,
      file: path.basename(result.outputFile),
      sha256: result.sha256 || null
    }));

  return res.json({
    ok: true,
    version: pkg.version,
    progress,
    queue: { total: queued.length },
    summary: {
      totalResults: results.length,
      built: counts.built || 0,
      notFound: counts.not_found || 0,
      multipleMatches: counts.multiple_matches || 0,
      translationMissing: counts.translation_missing || 0,
      needsReview: (counts.needs_review || 0) + (counts.multiple_matches || 0) + (counts.retry_exhausted || 0),
      errors: (counts.error || 0) + (counts.retry_exhausted || 0),
      statuses: counts
    },
    ready,
    providers: listProviders(),
    games: listGames(),
    nexusApiKeyConfigured: Boolean(process.env.NEXUS_API_KEY),
    storage: { workspace: 'local-filesystem', googleDrive: configurationStatus() }
  });
};

const https = require('https');

/**
 * Service placeholder for Nexus archive download pipeline.
 * Receives resolved Nexus mod metadata and prepares a download task.
 */

function createDownloadTask(mod) {
  return {
    modId: mod.modId || mod.nexusModId,
    name: mod.name,
    author: mod.author,
    status: 'queued',
    steps: [
      'request_nexus_files',
      'select_latest_archive',
      'download_archive',
      'extract_archive'
    ]
  };
}

module.exports = { createDownloadTask };

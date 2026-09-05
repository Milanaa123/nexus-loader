function createImportResult(mods = [], jobs = []) {
  return {
    total: mods.length,
    createdJobs: jobs.length,
    duplicateCount: Math.max(0, mods.length - jobs.length),
    mods,
    jobs,
    createdAt: new Date().toISOString()
  };
}

function summarizeImport(result) {
  return {
    total: result.total,
    createdJobs: result.createdJobs,
    duplicateCount: result.duplicateCount
  };
}

module.exports = {
  createImportResult,
  summarizeImport
};

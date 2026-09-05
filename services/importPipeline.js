function runImportPipeline(records, services = {}) {
  const normalized = services.normalize
    ? records.map(services.normalize)
    : records;

  const validated = services.validate
    ? normalized.map(services.validate).filter(Boolean)
    : normalized;

  const unique = [];
  const keys = new Set();

  for (const item of validated) {
    const key = `${item.name || ''}:${item.author || ''}`.toLowerCase();
    if (!keys.has(key)) {
      keys.add(key);
      unique.push(item);
    }
  }

  const jobs = services.createJobs
    ? services.createJobs(unique)
    : unique;

  return {
    total: records.length,
    accepted: jobs.length,
    jobs,
    duplicates: records.length - unique.length
  };
}

module.exports = { runImportPipeline };

function formatImportReport(result) {
  return {
    summary: {
      total: result.total || 0,
      valid: result.valid || 0,
      invalid: result.invalid || 0,
      duplicates: result.duplicates || 0,
      batches: result.batches || 0
    },
    errors: result.errors || [],
    createdJobs: result.createdJobs || []
  };
}

module.exports = { formatImportReport };

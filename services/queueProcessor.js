/**
 * Queue processor foundation for Nexus Loader.
 *
 * This module prepares the execution flow for bulk mod builds.
 * Each job moves through defined stages and can later be connected
 * to Nexus downloading, translation resolving and archive building.
 */

const DEFAULT_STAGES = [
  "search",
  "download_original",
  "find_translation",
  "merge_translation",
  "validate",
  "export"
];

function createJob(mod) {
  return {
    id: `${Date.now()}-${mod.name}`,
    mod,
    status: "queued",
    currentStage: null,
    stages: DEFAULT_STAGES.map((stage) => ({
      name: stage,
      status: "pending"
    }))
  };
}

function nextStage(job) {
  const stage = job.stages.find((item) => item.status === "pending");
  if (!stage) {
    job.status = "completed";
    return null;
  }

  stage.status = "running";
  job.currentStage = stage.name;
  return stage.name;
}

module.exports = {
  createJob,
  nextStage,
  DEFAULT_STAGES
};

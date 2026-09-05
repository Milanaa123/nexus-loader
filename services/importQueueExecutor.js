class ImportQueueExecutor {
  constructor(queuePlanner, pipeline) {
    this.queuePlanner = queuePlanner;
    this.pipeline = pipeline;
  }

  async execute(batchInput) {
    const plan = this.queuePlanner.createPlan(batchInput);
    const results = [];

    for (const batch of plan.batches) {
      results.push(await this.pipeline.process(batch));
    }

    return {
      batches: plan.batches.length,
      results
    };
  }
}

module.exports = ImportQueueExecutor;

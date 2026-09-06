async function runPipeline(context, steps = []) {
  let current = context;

  for (const step of steps) {
    if (typeof step !== 'function') continue;

    try {
      current = await step(current) || current;
    } catch (error) {
      current.error = error.message;
      current.status = 'error';
      throw error;
    }
  }

  return current;
}

function createStep(name, handler) {
  return async (context) => {
    context.steps = context.steps || [];
    context.steps.push({ name, startedAt: new Date().toISOString() });
    const result = await handler(context);
    context.steps[context.steps.length - 1].finishedAt = new Date().toISOString();
    return result || context;
  };
}

module.exports = {
  runPipeline,
  createStep
};

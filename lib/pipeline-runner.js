function recordFailure(context, error) {
  if (context && typeof context.fail === 'function') context.fail(error);
  else if (context) {
    context.status = 'error';
    context.error = error.message || String(error);
  }
}

async function runPipeline(context, steps = []) {
  let current = context;
  for (const step of steps) {
    if (current?.halted) break;
    if (typeof step !== 'function') continue;
    try {
      current = await step(current) || current;
    } catch (error) {
      recordFailure(current, error);
      throw error;
    }
  }
  return current;
}

function createStep(name, handler) {
  if (typeof handler !== 'function') throw new Error(`Pipeline step ${name} requires a handler`);
  return async context => {
    context.steps = Array.isArray(context.steps) ? context.steps : [];
    const entry = { name, status: 'running', startedAt: new Date().toISOString() };
    context.steps.push(entry);
    try {
      const result = await handler(context);
      entry.status = context.halted ? 'halted' : 'completed';
      return result || context;
    } catch (error) {
      entry.status = 'error';
      entry.error = error.message || String(error);
      throw error;
    } finally {
      entry.finishedAt = new Date().toISOString();
    }
  };
}

module.exports = { runPipeline, createStep };

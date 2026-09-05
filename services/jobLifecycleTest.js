// Lightweight lifecycle verification for ModJob architecture.

const validator = require('./jobValidator');
const schema = require('./modJobSchema');

function runLifecycleCheck(mod = { name: 'Test Mod', author: 'Test Author' }) {
  const job = schema.createModJob(mod);
  const validation = validator.validateJob(job);

  return {
    passed: validation.valid,
    job,
    errors: validation.errors
  };
}

module.exports = {
  runLifecycleCheck
};

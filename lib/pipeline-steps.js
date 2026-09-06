const { createStep } = require('./pipeline-runner');

function createAnalyzerStep(analyzer) {
  return createStep('analyze', async (context) => {
    if (!analyzer || typeof analyzer.analyze !== 'function') {
      return context;
    }

    const result = await analyzer.analyze(context);
    context.analysis = result || {};
    context.status = 'analyzed';
    return context;
  });
}

function createValidatorStep(validator) {
  return createStep('validate', async (context) => {
    if (!validator || typeof validator.validate !== 'function') {
      return context;
    }

    const result = await validator.validate(context);
    context.validation = result;

    if (result && result.valid === false) {
      context.fail('Validation failed');
    }

    return context;
  });
}

module.exports = {
  createAnalyzerStep,
  createValidatorStep
};

const { createStep } = require('./pipeline-runner');

function createAnalyzerStep(analyzer) {
  return createStep('analyze', async context => {
    const analyze = typeof analyzer === 'function' ? analyzer : analyzer?.analyze;
    if (typeof analyze !== 'function') return context;
    context.analysis = await analyze(context) || {};
    context.status = 'analyzed';
    return context;
  });
}

function createValidatorStep(validator) {
  return createStep('validate', async context => {
    const validate = typeof validator === 'function' ? validator : validator?.validate;
    if (typeof validate !== 'function') return context;
    const result = await validate(context);
    context.validation = result;
    if (result && result.valid === false) {
      const error = new Error(result.error || 'Validation failed');
      error.code = 'VALIDATION_FAILED';
      throw error;
    }
    return context;
  });
}

function createProviderDownloadStep(provider, role, optionsFactory) {
  return createStep(`download:${role}`, async context => {
    if (!provider || typeof provider.download !== 'function') throw new Error(`Provider cannot download ${role}`);
    const options = typeof optionsFactory === 'function' ? optionsFactory(context) : (optionsFactory || {});
    const downloaded = await provider.download(options);
    if (!downloaded?.path) throw new Error(`Provider returned no path for ${role}`);
    context.files = Array.isArray(context.files) ? context.files : [];
    context.files.push({ role, ...downloaded });
    return context;
  });
}

module.exports = { createAnalyzerStep, createValidatorStep, createProviderDownloadStep };

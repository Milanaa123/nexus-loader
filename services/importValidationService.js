function validateModEntry(mod) {
  const errors = [];

  if (!mod || typeof mod !== 'object') {
    return ['invalid_entry'];
  }

  if (!String(mod.name || '').trim()) {
    errors.push('missing_name');
  }

  if (!String(mod.author || '').trim()) {
    errors.push('missing_author');
  }

  return errors;
}

function validateImport(mods) {
  const valid = [];
  const invalid = [];

  for (const mod of mods || []) {
    const errors = validateModEntry(mod);

    if (errors.length) {
      invalid.push({ mod, errors });
    } else {
      valid.push(mod);
    }
  }

  return {
    valid,
    invalid,
    total: (mods || []).length
  };
}

module.exports = {
  validateModEntry,
  validateImport
};

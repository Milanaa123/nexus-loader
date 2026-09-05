const fs = require('fs');

function loadTranslationIndex(file = 'data/translations.json') {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function findTranslation(mod, index = loadTranslationIndex()) {
  if (!mod) return null;

  const name = String(mod.name || '').toLowerCase();
  const author = String(mod.author || '').toLowerCase();

  return index.find(item => {
    const itemName = String(item.name || '').toLowerCase();
    const itemAuthor = String(item.author || '').toLowerCase();

    return itemName === name && (!author || !itemAuthor || itemAuthor === author);
  }) || null;
}

module.exports = { loadTranslationIndex, findTranslation };

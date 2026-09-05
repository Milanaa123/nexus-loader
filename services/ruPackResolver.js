// Resolver for Russian localization packs.
// This layer will connect local RU pack indexes and external sources.

function findCandidates(mod, packs = []) {
  const name = String(mod.name || '').toLowerCase();
  const author = String(mod.author || '').toLowerCase();

  return packs.filter((pack) => {
    const packName = String(pack.name || '').toLowerCase();
    const packAuthor = String(pack.author || '').toLowerCase();

    return (
      packName.includes(name) ||
      name.includes(packName) ||
      (author && packAuthor === author)
    );
  });
}

module.exports = {
  findCandidates
};

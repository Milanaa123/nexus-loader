module.exports = async function buildPlan(req, res) {
  const body = req.body || {};
  const mods = Array.isArray(body.mods) ? body.mods : [];

  const plan = mods.map((mod) => ({
    name: mod.name || null,
    author: mod.author || null,
    modId: mod.modId || null,
    steps: [
      'download_original',
      'find_translation',
      'merge_files',
      'validate_localization',
      'create_archive'
    ],
    status: 'queued'
  }));

  res.json({
    ok: true,
    total: plan.length,
    ready: plan.filter(x => x.modId).length,
    plan
  });
};

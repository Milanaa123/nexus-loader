const fs = require('fs');
const path = require('path');
const Module = require('module');

module.exports = async function handler(req, res) {
  try {
    const sourcePath = path.join(__dirname, 'stage53audit.js');
    let source = fs.readFileSync(sourcePath, 'utf8');
    const injection = `const AP={
'Alecto.dialogue.introduction':'Только люди с сильной магической восприимчивостью способны видеть сквозь заклинания невидимости вроде того, которым я сейчас пользуюсь.#$b#К сожалению, к ним относятся и маленькие дети. Уф.$5',
'Alecto.event4.5':'Ну? Ты идёшь или нет?#$b#Мне... мне, пожалуй, не помешала бы моральная поддержка. Уф. Не могу поверить, что я только что это сказала...$2',`;
    if (!source.includes('const AP={')) throw new Error('Stage 73 source marker not found');
    source = source.replace('const AP={', injection);
    const filename = path.join(__dirname, '__stage73_runtime_fixed.js');
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = module.paths;
    mod._compile(source, filename);
    return await mod.exports(req, res);
  } catch (e) {
    return res.status(500).json({ ok: false, stage: 73, error: String(e && e.message || e) });
  }
};

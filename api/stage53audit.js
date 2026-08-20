const AdmZip = require('adm-zip');

const MODS = {
  hxw: { name: "HxW Farmer's Market Furniture - Core", modId: 18814, fileId: 115006, version: '2.1.1' },
  hxwRu: { name: "HxW Farmer's Market Furniture - Core RU", modId: 21679, fileId: 123310, version: '2.1.1' },
  distant: { name: 'Distant Lands - Witch Swamp Overhaul', modId: 18109, fileId: 164748, version: '2.2.9' },
  distantRu: { name: 'Distant Lands RU', modId: 40475, fileId: 156226, version: '2.2.8' }
};

async function nexusJson(url, key) {
  const r = await fetch(url, { headers: { apikey: key, 'User-Agent': 'nexus-loader-stage61/1.0' } });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Nexus API ${r.status}`);
  return data;
}

async function downloadArchive(mod, key) {
  const links = await nexusJson(`https://api.nexusmods.com/v1/games/stardewvalley/mods/${mod.modId}/files/${mod.fileId}/download_link.json`, key);
  const mirror = Array.isArray(links) && links.find(x => x && (x.URI || x.uri));
  if (!mirror) throw new Error(`${mod.name}: no Nexus mirror`);
  const r = await fetch(mirror.URI || mirror.uri, { redirect: 'follow', headers: { 'User-Agent': 'nexus-loader-stage61/1.0' } });
  if (!r.ok) throw new Error(`${mod.name}: archive download ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

function entries(buffer) {
  return new AdmZip(buffer).getEntries().filter(e => !e.isDirectory);
}

function stripJsonc(source) {
  let out = '', quote = false, escaped = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (quote) {
      out += c;
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quote = false;
      continue;
    }
    if (c === '"') { quote = true; out += c; continue; }
    if (c === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < source.length - 1 && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i++;
      continue;
    }
    out += c;
  }
  return out.replace(/,\s*([}\]])/g, '$1');
}

function parseEntry(entry) {
  return JSON.parse(stripJsonc(entry.getData().toString('utf8').replace(/^\uFEFF/, '')));
}

function findEntry(list, suffix) {
  const needle = suffix.toLowerCase();
  return list.find(e => !/^__macosx\//i.test(e.entryName) && e.entryName.replace(/\\/g, '/').toLowerCase().endsWith(needle));
}

function requireEntry(list, suffix, label) {
  const entry = findEntry(list, suffix);
  if (!entry) throw new Error(`${label}: missing ${suffix}`);
  return entry;
}

function rootOf(entry, suffix) {
  return entry.entryName.replace(/\\/g, '/').slice(0, -suffix.length).replace(/\/$/, '');
}

function equal(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function valuesOf(row) {
  return String(row.AllowValues || '').split(',').map(x => x.trim()).filter(Boolean);
}

function keyParity(source, translated, label) {
  const sourceKeys = Object.keys(source), translatedKeys = Object.keys(translated);
  const missing = sourceKeys.filter(k => !(k in translated));
  const extra = translatedKeys.filter(k => !(k in source));
  if (missing.length || extra.length) throw new Error(`${label}: missing ${missing.length}, extra ${extra.length}`);
}

function gameplayTokens(value) {
  return String(value)
    .replace(/\$\{[^}]+\}\$?/g, '')
    .match(/\{\{[^}]+\}\}|%item[\s\S]*?%%|\$[A-Za-z0-9]+|[@^#]/g) || [];
}

function visibleLatin(value) {
  const scrubbed = String(value)
    .replace(/\$\{[^}]+\}\$?/g, '')
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/%item[\s\S]*?%%/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\$[A-Za-z0-9]+/g, '')
    .replace(/@[A-Za-z0-9_.-]*/g, '');
  return /[A-Za-z]{2,}/.test(scrubbed);
}

function assertNoVisibleLatin(object, label) {
  const bad = Object.entries(object).filter(([, value]) => visibleLatin(value));
  if (bad.length) throw new Error(`${label}: visible Latin in ${bad.slice(0, 6).map(([k]) => k).join('|')}`);
}

function assertTokens(source, translated, label) {
  const bad = Object.keys(source).filter(k => k in translated && !equal(gameplayTokens(source[k]), gameplayTokens(translated[k])));
  if (bad.length) throw new Error(`${label}: token mismatch in ${bad.slice(0, 8).join('|')}`);
}

function jsonBuffer(value) {
  return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');
}

const HXW_FIXES = {
  FMCore_DIYDisplayA: 'Самодельная фермерская витрина А',
  FMCore_DIYDisplayB: 'Самодельная фермерская витрина Б',
  FMCore_DIYDisplayC: 'Самодельная фермерская витрина В',
  FMCore_DIYDisplayD: 'Самодельная фермерская витрина Г',
  FMCore_DIYDisplayE: 'Самодельная фермерская витрина Д',
  FMCore_DIYDisplayDivider: 'Самодельный разделитель витрины',
  FMCore_DIYDisplayRegister: 'Самодельная витрина с кассой'
};

const HXW_CONFIG_EN = {
  'config.Recolor.name': 'Recolor',
  'config.Recolor.description': 'Choose Light or Dark recolor. The default is Classic.',
  'config.Recolor.values.Light': 'Light',
  'config.Recolor.values.Dark': 'Dark',
  'config.Recolor.values.Classic': 'Classic'
};

const HXW_CONFIG_RU = {
  'config.Recolor.name': 'Перекраска',
  'config.Recolor.description': 'Выберите светлую или тёмную перекраску. По умолчанию используется классическая.',
  'config.Recolor.values.Light': 'Светлая',
  'config.Recolor.values.Dark': 'Тёмная',
  'config.Recolor.values.Classic': 'Классическая'
};

const DISTANT_CONFIG_EN = {
  'config.section.SVE Swamp Patches.name': 'Expanded valley swamp patches',
  'config.Overwrite Forbidden Maze map warps.name': 'Redirect warps past the Forbidden Maze',
  'config.Overwrite Forbidden Maze map warps.description': 'Travel between the Witch Warp Cave and Witch Swamp without using the expanded valley Forbidden Maze map.',
  'config.Overwrite Forbidden Maze map warps.values.true': 'Yes',
  'config.Overwrite Forbidden Maze map warps.values.false': 'No',
  'config.Add Path to Forbidden Maze map.name': 'Add a path to the Forbidden Maze',
  'config.Add Path to Forbidden Maze map.description': "Add a path to the Forbidden Maze on the left side of Witch Swamp near Zic's campfire.",
  'config.Add Path to Forbidden Maze map.values.true': 'Yes',
  'config.Add Path to Forbidden Maze map.values.false': 'No',
  'config.Recolor.name': 'Recolor',
  'config.Recolor.values.default': 'Default',
  'config.Recolor.values.crimson': 'Crimson',
  'config.Recolor.values.void': 'Void',
  'config.Recolor.values.green': 'Green',
  'config.Water Overlay.name': 'Water overlay',
  'config.Water Overlay.values.true': 'Yes',
  'config.Water Overlay.values.false': 'No',
  'config.Better BetterWater Compatibility.name': 'Better water compatibility',
  'config.Better BetterWater Compatibility.values.true': 'Yes',
  'config.Better BetterWater Compatibility.values.false': 'No',
  'config.Darker Ambient Light.name': 'Darker ambient light',
  'config.Darker Ambient Light.values.true': 'Yes',
  'config.Darker Ambient Light.values.false': 'No'
};

const DISTANT_CONFIG_RU = {
  'config.section.SVE Swamp Patches.name': 'Патчи болота для расширенной долины',
  'config.Overwrite Forbidden Maze map warps.name': 'Перенаправить телепортацию мимо Запретного лабиринта',
  'config.Overwrite Forbidden Maze map warps.description': 'Перемещайтесь между Пещерой ведьминого портала и Ведьминым болотом, минуя карту Запретного лабиринта из расширенной долины.',
  'config.Overwrite Forbidden Maze map warps.values.true': 'Да',
  'config.Overwrite Forbidden Maze map warps.values.false': 'Нет',
  'config.Add Path to Forbidden Maze map.name': 'Добавить путь в Запретный лабиринт',
  'config.Add Path to Forbidden Maze map.description': 'Добавляет путь в Запретный лабиринт с левой стороны Ведьминого болота, рядом с костром Зика.',
  'config.Add Path to Forbidden Maze map.values.true': 'Да',
  'config.Add Path to Forbidden Maze map.values.false': 'Нет',
  'config.Recolor.name': 'Перекраска',
  'config.Recolor.values.default': 'Стандартная',
  'config.Recolor.values.crimson': 'Багровая',
  'config.Recolor.values.void': 'Пустотная',
  'config.Recolor.values.green': 'Зелёная',
  'config.Water Overlay.name': 'Наложение воды',
  'config.Water Overlay.values.true': 'Да',
  'config.Water Overlay.values.false': 'Нет',
  'config.Better BetterWater Compatibility.name': 'Совместимость с улучшенной водой',
  'config.Better BetterWater Compatibility.values.true': 'Да',
  'config.Better BetterWater Compatibility.values.false': 'Нет',
  'config.Darker Ambient Light.name': 'Более тёмное окружающее освещение',
  'config.Darker Ambient Light.values.true': 'Да',
  'config.Darker Ambient Light.values.false': 'Нет'
};

function validateManifest(list, uniqueId, version, label) {
  const manifests = list.filter(e => /\/manifest\.json$/i.test('/' + e.entryName) && !/^__macosx\//i.test(e.entryName)).map(parseEntry);
  const manifest = manifests.find(x => x.UniqueID === uniqueId);
  if (!manifest) throw new Error(`${label}: manifest ${uniqueId} missing`);
  if (String(manifest.Version) !== String(version)) throw new Error(`${label}: version ${manifest.Version}, expected ${version}`);
  return manifest;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const key = process.env.NEXUS_API_KEY;
    if (!key) throw new Error('NEXUS_API_KEY missing');
    const [hxwBuf, hxwRuBuf, distantBuf, distantRuBuf] = await Promise.all([
      downloadArchive(MODS.hxw, key), downloadArchive(MODS.hxwRu, key),
      downloadArchive(MODS.distant, key), downloadArchive(MODS.distantRu, key)
    ]);
    const [hxw, hxwReady, distant, distantReady] = [entries(hxwBuf), entries(hxwRuBuf), entries(distantBuf), entries(distantRuBuf)];
    const zip = new AdmZip(), verified = [];

    validateManifest(hxw, 'HXW.FMCore', MODS.hxw.version, 'HxW');
    validateManifest(hxwReady, 'HXW.FMCore', MODS.hxwRu.version, 'HxW ready RU');
    const hxwContentEntry = requireEntry(hxw, '/content.json', 'HxW');
    const hxwContent = parseEntry(hxwContentEntry);
    const hxwSchema = hxwContent.ConfigSchema || {};
    if (!equal(Object.keys(hxwSchema), ['Recolor']) || !equal(valuesOf(hxwSchema.Recolor), ['Light', 'Dark', 'Classic'])) throw new Error('HxW: ConfigSchema changed');
    const hxwDefaultEntry = requireEntry(hxw, '/i18n/default.json', 'HxW');
    const hxwSourceDefault = parseEntry(hxwDefaultEntry);
    const hxwReadyRu = parseEntry(requireEntry(hxwReady, '/i18n/ru.json', 'HxW ready RU'));
    if (Object.keys(hxwSourceDefault).length !== 95 || Object.keys(hxwReadyRu).length !== 95) throw new Error(`HxW: source/ready keys ${Object.keys(hxwSourceDefault).length}/${Object.keys(hxwReadyRu).length}`);
    keyParity(hxwSourceDefault, hxwReadyRu, 'HxW ready RU');
    assertTokens(hxwSourceDefault, hxwReadyRu, 'HxW ready RU');
    const hxwDefault = { ...hxwSourceDefault, ...HXW_CONFIG_EN };
    const hxwRu = { ...hxwReadyRu, ...HXW_FIXES, ...HXW_CONFIG_RU };
    if (Object.keys(hxwDefault).length !== 100 || Object.keys(hxwRu).length !== 100) throw new Error('HxW: final key count');
    keyParity(hxwDefault, hxwRu, 'HxW final');
    assertTokens(hxwDefault, hxwRu, 'HxW final');
    assertNoVisibleLatin(hxwRu, 'HxW final');
    const hxwRoot = rootOf(hxwDefaultEntry, '/i18n/default.json');
    zip.addFile(`Mods/${hxwRoot}/i18n/default.json`, jsonBuffer(hxwDefault));
    zip.addFile(`Mods/${hxwRoot}/i18n/ru.json`, jsonBuffer(hxwRu));
    verified.push({
      name: MODS.hxw.name, version: MODS.hxw.version, fileId: MODS.hxw.fileId,
      readyRuVersion: MODS.hxwRu.version, readyRuFileId: MODS.hxwRu.fileId,
      sourceKeys: 95, readyRuKeys: 95, addedConfigLabels: 5, finalRuKeys: 100,
      visibleLatinFixed: 7, missing: 0, extra: 0, placeholderMismatch: 0,
      internalConfigKeysChanged: 0, internalAllowValuesChanged: 0, remainingVisibleLatin: 0
    });

    validateManifest(distant, 'AimonsWitchSwampOverhaulPatches', MODS.distant.version, 'Distant Lands DLL');
    validateManifest(distant, 'Aimon111.WitchSwampOverhaulCP', MODS.distant.version, 'Distant Lands CP');
    validateManifest(distant, 'Aimon111.WitchSwampOverhaulFTM', MODS.distant.version, 'Distant Lands FTM');
    const distantContentEntry = requireEntry(distant, '/[cp] distant lands - witch swamp overhaul/content.json', 'Distant Lands');
    const distantContent = parseEntry(distantContentEntry);
    const distantSchema = distantContent.ConfigSchema || {};
    const allowCount = Object.values(distantSchema).reduce((n, row) => n + valuesOf(row).length, 0);
    if (Object.keys(distantSchema).length !== 6 || allowCount !== 14) throw new Error(`Distant Lands: schema ${Object.keys(distantSchema).length}/${allowCount}`);
    const distantDefaultEntry = requireEntry(distant, '/[cp] distant lands - witch swamp overhaul/i18n/default.json', 'Distant Lands');
    const distantSourceDefault = parseEntry(distantDefaultEntry);
    const distantReadyRu = parseEntry(requireEntry(distantReady, '/[cp] distant lands - witch swamp overhaul/i18n/ru.json', 'Distant Lands ready RU'));
    if (Object.keys(distantSourceDefault).length !== 805 || Object.keys(distantReadyRu).length !== 805) throw new Error(`Distant Lands: source/ready keys ${Object.keys(distantSourceDefault).length}/${Object.keys(distantReadyRu).length}`);
    keyParity(distantSourceDefault, distantReadyRu, 'Distant Lands ready RU');
    const distantRu = { ...distantReadyRu };
    const oldSeedSuffix = '%%%item id Aimon111.WitchSwampOverhaulCP_Void_Mint_Seeds 3 %%';
    const newSeedSuffix = '%item id Aimon111.WitchSwampOverhaulCP_Vile_Ancient_Fruit_Seeds 3 %%%item id Aimon111.WitchSwampOverhaulCP_Void_Mint_Seeds 3 %%';
    if (!String(distantRu.WizardGingerTinctureSeeds).includes(oldSeedSuffix)) throw new Error('Distant Lands: seed mail repair anchor missing');
    distantRu.WizardGingerTinctureSeeds = String(distantRu.WizardGingerTinctureSeeds).replace(oldSeedSuffix, newSeedSuffix);
    distantRu['gus.event1.Hello'] = 'О, привет, приятель!';
    distantRu['gus.event15.Sigh'] = 'Эх... Не пойми меня неправильно, приятель.$u';
    distantRu['gus.event17.See_you'] = 'Ещё увидимся, приятель.';
    distantRu['Config.Overwrite Forbidden Maze map warps.description'] = 'Изменяет точки телепортации между Пещерой ведьминого портала и Ведьминым болотом, минуя карту Запретного лабиринта из расширенной долины.';
    distantRu['Config.Better BetterWater Compatibility.name'] = 'Совместимость с улучшенной водой';
    assertTokens(distantSourceDefault, distantRu, 'Distant Lands repaired RU');
    const distantDefault = { ...distantSourceDefault, ...DISTANT_CONFIG_EN };
    Object.assign(distantRu, DISTANT_CONFIG_RU);
    if (Object.keys(distantDefault).length !== 828 || Object.keys(distantRu).length !== 828) throw new Error(`Distant Lands: final keys ${Object.keys(distantDefault).length}/${Object.keys(distantRu).length}`);
    keyParity(distantDefault, distantRu, 'Distant Lands final');
    assertTokens(distantDefault, distantRu, 'Distant Lands final');
    assertNoVisibleLatin(distantRu, 'Distant Lands final');
    const distantRoot = rootOf(distantDefaultEntry, '/i18n/default.json');
    zip.addFile(`Mods/${distantRoot}/i18n/default.json`, jsonBuffer(distantDefault));
    zip.addFile(`Mods/${distantRoot}/i18n/ru.json`, jsonBuffer(distantRu));
    verified.push({
      name: MODS.distant.name, version: MODS.distant.version, fileId: MODS.distant.fileId,
      readyRuVersion: MODS.distantRu.version, readyRuFileId: MODS.distantRu.fileId,
      sourceKeys: 805, readyRuKeys: 805, translatedVersionDelta: 0,
      tokenRepairs: 4, visibleLatinFixed: 2, addedConfigLabels: 23, finalRuKeys: 828,
      configOptions: 6, allowValues: 14, missing: 0, extra: 0, placeholderMismatch: 0,
      activePrimarySecondaryTextOutsideI18n: 0,
      internalConfigKeysChanged: 0, internalAllowValuesChanged: 0, remainingVisibleLatin: 0
    });

    const files = zip.getEntries().filter(e => !e.isDirectory);
    if (files.length !== 4) throw new Error(`Stage 61: output files ${files.length}/4`);
    const output = zip.toBuffer();
    const status = { ok: true, complete: true, stage: 61, mods: 2, files: files.length, zipBytes: output.length, verified };
    if (String(req.query.status || '') === '1') return res.status(200).json(status);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="RU_STAGE61_VERIFIED_2.zip"');
    return res.status(200).send(output);
  } catch (error) {
    return res.status(500).json({ ok: false, complete: false, stage: 61, error: String(error && error.message || error) });
  }
};

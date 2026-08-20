const AdmZip = require('adm-zip');

const MODS = {
  source308: { name: 'East Scarp Remastered', modId: 5787, fileId: 164864, version: '3.0.8' },
  source309: { name: 'East Scarp Remastered', modId: 5787, fileId: 169442, version: '3.0.9' },
  readyRu: { name: 'East Scarp Russian translation', modId: 8163, fileId: 167305, version: '3.0.8' }
};

const ROOT = 'East Scarp REMASTERED';
const NPC_I18N = ['Dialogue', 'Dispositions', 'Events', 'Festivals', 'GiftTastes', 'Mail', 'Movies', 'Quests', 'SpecialOrders', 'Strings', 'config'];
const I18N = [
  { source: 'ESBarberShop/i18n/default.json', ru: 'ESBarberShop/i18n/ru.json' },
  { source: 'East Scarp C#/i18n/default.json', ru: 'East Scarp C#/i18n/ru.json' },
  { source: 'East Scarp Core/i18n/default.json', ru: 'East Scarp Core/i18n/ru.json', addDefault: true },
  ...NPC_I18N.map(name => ({
    source: `East Scarp NPCs/i18n/Default/${name}.json`,
    ru: `East Scarp NPCs/i18n/Ru/${name}.json`,
    addDefault: name === 'config'
  }))
];

const MANIFESTS = [
  ['ES.BarberShop', 'East Scarp: Barber Shop'],
  ['atravita.EastScarp', 'East Scarp: C#'],
  ['Lemurkat.EastScarp', 'East Scarp: Locations'],
  ['Lemurkat.EastScarpe.FTM', 'East Scarp: Forage Settings'],
  ['Lemurkat.EastScarpNPCs', 'East Scarp: NPCs']
];

async function nexusJson(url, key) {
  const r = await fetch(url, { headers: { apikey: key, 'User-Agent': 'nexus-loader-stage62/1.0' } });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Nexus API ${r.status}`);
  return data;
}

async function downloadArchive(mod, key) {
  const links = await nexusJson(`https://api.nexusmods.com/v1/games/stardewvalley/mods/${mod.modId}/files/${mod.fileId}/download_link.json`, key);
  const mirror = Array.isArray(links) && links.find(x => x && (x.URI || x.uri));
  if (!mirror) throw new Error(`${mod.name}: no Nexus mirror`);
  const r = await fetch(mirror.URI || mirror.uri, { redirect: 'follow', headers: { 'User-Agent': 'nexus-loader-stage62/1.0' } });
  if (!r.ok) throw new Error(`${mod.name}: archive download ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

function entries(buffer) {
  return new AdmZip(buffer).getEntries().filter(e => !e.isDirectory && !/^__macosx\//i.test(e.entryName));
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

function parseText(text, label) {
  try { return JSON.parse(stripJsonc(String(text).replace(/^\uFEFF/, ''))); }
  catch (error) { throw new Error(`${label}: invalid JSON/JSONC: ${error.message}`); }
}

function parseEntry(entry, label) {
  return parseText(entry.getData().toString('utf8'), label || entry.entryName);
}

function findEntry(list, suffix) {
  const needle = `${ROOT}/${suffix}`.replace(/\\/g, '/').toLowerCase();
  return list.find(e => e.entryName.replace(/\\/g, '/').toLowerCase().endsWith(needle));
}

function requireEntry(list, suffix, label) {
  const entry = findEntry(list, suffix);
  if (!entry) throw new Error(`${label}: missing ${suffix}`);
  return entry;
}

function readObject(list, suffix, label) {
  return parseEntry(requireEntry(list, suffix, label), label);
}

function readText(list, suffix, label) {
  return requireEntry(list, suffix, label).getData().toString('utf8').replace(/^\uFEFF/, '');
}

function equal(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function sorted(values) { return [...values].sort(); }

function diffKeys(oldObject, newObject) {
  return {
    added: Object.keys(newObject).filter(k => !(k in oldObject)),
    removed: Object.keys(oldObject).filter(k => !(k in newObject)),
    changed: Object.keys(newObject).filter(k => k in oldObject && !equal(oldObject[k], newObject[k]))
  };
}

function keyParity(source, translated, label) {
  const missing = Object.keys(source).filter(k => !(k in translated));
  const extra = Object.keys(translated).filter(k => !(k in source));
  if (missing.length || extra.length) throw new Error(`${label}: missing ${missing.length} (${missing.slice(0, 4).join('|')}), extra ${extra.length} (${extra.slice(0, 4).join('|')})`);
}

function jsonBuffer(value) {
  const data = Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');
  parseText(data.toString('utf8'), 'generated JSON');
  return data;
}

function valuesOf(row) {
  return String(row && row.AllowValues || '').split(',').map(x => x.trim()).filter(Boolean);
}

function validateManifest(list, uniqueId, version, label) {
  const manifests = list.filter(e => /(^|\/)manifest\.json$/i.test(e.entryName)).map(e => parseEntry(e, e.entryName));
  const manifest = manifests.find(x => x.UniqueID === uniqueId);
  if (!manifest) throw new Error(`${label}: manifest ${uniqueId} missing`);
  if (String(manifest.Version) !== String(version)) throw new Error(`${label}: ${uniqueId} version ${manifest.Version}, expected ${version}`);
  return manifest;
}

function canonicalSource(value) {
  return String(value)
    .replace(/\$!/g, '$1')
    .replace(/#([135])(?=$|[\s".,!?])/g, (_, n) => `$${n}`)
    .replace(/#b#/g, '#$b#');
}

const OTHER_TOKEN_RE = /\$(?:query|q|r|d|c|p)\s+[^#]*#|\$[0-9]+\s+[A-Za-z0-9_.-]+#|#r\s+[^#]*#|\$\{[^}]+\}\$?|\{\{[^}]+\}\}/g;
const SIMPLE_DOLLAR_RE = /#\$[be]#|#\$(?:[ahksu]|[0-9]+)|\$(?:[0-9]+|[ahksu])|\$[be]#?/g;
const GENDER_BRANCH_COLLAPSES = new Set([
  'Aideen_103', 'Beatrice_Mon10', 'Eyvinder_summer_Fri8', 'Jasper_Rekindle_Yes',
  'Jasper_WS_AcceptGift_Chessboard.true', 'Jasper_RivalHearts_Jasper_Manipulate',
  'Jasper_RivalHearts_Jasper_Extrovert', 'Jasper_Marriage_Good_9',
  '57877002.Eyvinder_HelpLitter.04.false', '57877002.Eyvinder_HelpLitter.09.false',
  '57877002.Eyvind_drinkMead.02', '57877003.03.false',
  '57877003.Eyvinder_GoatStoryTime.03.false', '57877007.11.false',
  '50709921.12', '5295003.3.false', '57871209.5.false', '57871209.7.false'
]);

function isBreakToken(token) { return /^(?:#\$[be]#|\$[be]#)$/.test(token); }

function protect(value) {
  const saved = [];
  const text = String(value).replace(OTHER_TOKEN_RE, token => {
    const marker = `\uE000${saved.length}\uE001`;
    saved.push(token);
    return marker;
  });
  return { text, restore(input) { return input.replace(/\uE000(\d+)\uE001/g, (_, n) => saved[Number(n)]); } };
}

function simpleDollarParts(value) {
  const normalized = canonicalSource(value).replace(/(#\$[be]#)#(?!\$)/g, '$1');
  const p = protect(normalized);
  const tokens = [];
  let body = '', cursor = 0, match;
  SIMPLE_DOLLAR_RE.lastIndex = 0;
  while ((match = SIMPLE_DOLLAR_RE.exec(p.text))) {
    body += p.text.slice(cursor, match.index);
    const token = match[0], position = body.length;
    tokens.push({ position, token });
    if (isBreakToken(token) && body && !/\s$/.test(body) && p.text[match.index + token.length] && !/\s/.test(p.text[match.index + token.length])) body += ' ';
    cursor = match.index + token.length;
  }
  body += p.text.slice(cursor);
  for (const item of tokens) item.ratio = body.length ? item.position / body.length : 1;
  return { body, tokens, restore: p.restore };
}

function sentenceBoundaries(text) {
  const points = new Set([0, text.length]);
  for (let i = 0; i < text.length; i++) {
    if (/[!?…]/.test(text[i])) points.add(i + 1);
    else if (text[i] === '.' && text[i + 1] !== '.') points.add(i + 1);
    else if (text[i] === '\n') points.add(i + 1);
  }
  return [...points].sort((a, b) => a - b);
}

function tokenSimilarity(a, b) {
  const positionCost = Math.abs(a.ratio - b.ratio) * 0.8;
  if (a.token === b.token) return positionCost;
  if (isBreakToken(a.token) && isBreakToken(b.token)) return 0.2 + positionCost;
  if (!isBreakToken(a.token) && !isBreakToken(b.token)) return 0.65 + positionCost;
  return 1.6;
}

function alignTokens(source, translated) {
  const n = source.length, m = translated.length;
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  const op = Array.from({ length: n + 1 }, () => Array(m + 1).fill(null));
  for (let i = 1; i <= n; i++) { dp[i][0] = i; op[i][0] = 'source'; }
  for (let j = 1; j <= m; j++) { dp[0][j] = j; op[0][j] = 'translated'; }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const choices = [
        [dp[i - 1][j - 1] + tokenSimilarity(source[i - 1], translated[j - 1]), 'pair'],
        [dp[i - 1][j] + 1, 'source'], [dp[i][j - 1] + 1, 'translated']
      ].sort((a, b) => a[0] - b[0]);
      [dp[i][j], op[i][j]] = choices[0];
    }
  }
  const mapped = Array(n).fill(null);
  let i = n, j = m;
  while (i || j) {
    const step = op[i][j];
    if (step === 'pair') { mapped[i - 1] = j - 1; i--; j--; }
    else if (step === 'source') i--; else j--;
  }
  return mapped;
}

function nearestBoundary(text, target, min, max) {
  const candidates = sentenceBoundaries(text).filter(x => x >= min && x <= max);
  if (!candidates.length) return Math.max(min, Math.min(max, Math.round(target)));
  return candidates.reduce((best, x) => Math.abs(x - target) < Math.abs(best - target) ? x : best);
}

function placeSourceTokens(sourceParts, ruParts) {
  if (!sourceParts.tokens.length) return ruParts.body;
  const mapped = alignTokens(sourceParts.tokens, ruParts.tokens);
  const positions = Array(sourceParts.tokens.length).fill(null);
  for (let i = 0; i < mapped.length; i++) if (mapped[i] !== null) positions[i] = ruParts.tokens[mapped[i]].position;
  for (let i = 0; i < positions.length; i++) {
    if (positions[i] !== null) continue;
    let left = i - 1, right = i + 1;
    while (left >= 0 && positions[left] === null) left--;
    while (right < positions.length && positions[right] === null) right++;
    const min = left >= 0 ? positions[left] : 0, max = right < positions.length ? positions[right] : ruParts.body.length;
    const target = left >= 0 && right < positions.length
      ? min + (max - min) * ((i - left) / (right - left))
      : (sourceParts.body.length ? sourceParts.tokens[i].position / sourceParts.body.length : 1) * ruParts.body.length;
    positions[i] = nearestBoundary(ruParts.body, target, min, max);
  }
  let out = ruParts.body;
  const insertions = positions.map((position, i) => ({ position, i, token: sourceParts.tokens[i].token }));
  for (const item of insertions.sort((a, b) => b.position - a.position || b.i - a.i)) out = out.slice(0, item.position) + item.token + out.slice(item.position);
  return out.replace(/[ \t]*(#\$[be]#?)[ \t]*/g, '$1').replace(/[ \t]+(\$[A-Za-z0-9!]+)(?=[#$\s.,!?]|$)/g, '$1');
}

function repairDollars(source, translated, key) {
  translated = String(translated).replace(/(#\$[be]#)#(?!\$)/g, '$1');
  const sourceParts = simpleDollarParts(source), ruParts = simpleDollarParts(translated);
  const sourceTokens = sourceParts.tokens.map(x => x.token), ruTokens = ruParts.tokens.map(x => x.token);
  if (equal(sourceTokens, ruTokens)) return translated;
  if (GENDER_BRANCH_COLLAPSES.has(key)) {
    const sourceSet = sorted(new Set(sourceTokens)), ruSet = sorted(new Set(ruTokens));
    const sourceBreaks = sourceTokens.filter(isBreakToken), ruBreaks = ruTokens.filter(isBreakToken);
    if (equal(sourceSet, ruSet) && equal(sourceBreaks, ruBreaks)) return translated;
  }
  return ruParts.restore(placeSourceTokens(sourceParts, ruParts));
}

function atCount(value) { return (String(value).match(/@/g) || []).length; }

function addAt(source, value, occurrence) {
  const text = String(value), sourceIndexes = [...String(source).matchAll(/@/g)].map(x => x.index);
  const sourceIndex = sourceIndexes[Math.min(occurrence, sourceIndexes.length - 1)] ?? String(source).length;
  const sourceRatio = String(source).length ? sourceIndex / String(source).length : 1;
  if (sourceRatio < 0.08) return `@ ${text}`;
  const candidates = [...text.matchAll(/[!?]|\.{3}|\.(?!\.)/g)].map(x => x.index), target = sourceRatio * text.length;
  const at = candidates.length ? candidates.reduce((best, x) => Math.abs(x - target) < Math.abs(best - target) ? x : best) : text.length;
  const before = text.slice(0, at).replace(/\s+$/, ''), after = text.slice(at);
  return before + (/[,;:]$/.test(before) ? ' @' : ', @') + after;
}

function repairAt(source, translated, key) {
  const wanted = atCount(source), have = atCount(translated);
  const collapsedAlternative = wanted === 2 && have === 1 && String(source).includes('^');
  if (wanted <= have || collapsedAlternative || GENDER_BRANCH_COLLAPSES.has(key) && have > 0) return translated;
  let out = translated;
  const sourceRatios = [...String(source).matchAll(/@/g)].map(x => x.index / Math.max(1, String(source).length));
  while (atCount(out) < wanted) {
    const outRatios = [...String(out).matchAll(/@/g)].map(x => x.index / Math.max(1, String(out).length));
    let missing = 0, distance = -1;
    for (let i = 0; i < sourceRatios.length; i++) {
      const nearest = outRatios.length ? Math.min(...outRatios.map(x => Math.abs(x - sourceRatios[i]))) : 1;
      if (nearest > distance) { distance = nearest; missing = i; }
    }
    out = addAt(source, out, missing);
  }
  return out;
}

const CORE_CONFIG_EN = {
  'config.PlayCustomMusic.name': 'Play custom music', 'config.PlayCustomMusic.description': "Play East Scarp's custom music.",
  'config.ExcludeObjects.name': 'Exclude objects', 'config.ExcludeObjects.description': 'Exclude all fish and crops from Perfection requirements.',
  'config.GoatSkin.values.original': 'Original', 'config.GoatSkin.values.revised': 'Revised',
  'config.EnableMeadowFarm.values.true': 'Yes', 'config.EnableMeadowFarm.values.false': 'No',
  'config.WalkTidePools.values.true': 'Yes', 'config.WalkTidePools.values.false': 'No',
  'config.ObeliskOptions.values.vanilla': 'Vanilla', 'config.ObeliskOptions.values.glass': 'Glass',
  'config.ObeliskOptions.values.garden': 'Garden', 'config.ObeliskOptions.values.Yri': 'Yri',
  'config.ObeliskOptions.values.Juffuffles': 'Juffuffles',
  'config.PlayCustomMusic.values.true': 'Yes', 'config.PlayCustomMusic.values.false': 'No',
  'config.TownMap.values.default': 'Automatic', 'config.TownMap.values.karmylla': 'Karmylla', 'config.TownMap.values.vanilla': 'Vanilla',
  'config.ExcludeObjects.values.true': 'Yes', 'config.ExcludeObjects.values.false': 'No',
  'config.EnableAdditionalCrops.values.true': 'Yes', 'config.EnableAdditionalCrops.values.false': 'No',
  'config.AllowGiantChocoFruit.values.true': 'Yes', 'config.AllowGiantChocoFruit.values.false': 'No'
};

const CORE_CONFIG_RU = {
  'config.PlayCustomMusic.name': 'Авторская музыка', 'config.PlayCustomMusic.description': 'Воспроизводить авторскую музыку Восточного Скарпа.',
  'config.ExcludeObjects.name': 'Исключить объекты', 'config.ExcludeObjects.description': 'Исключить всю рыбу и все культуры из требований к Совершенству.',
  'config.GoatSkin.values.original': 'Исходная', 'config.GoatSkin.values.revised': 'Обновлённая',
  'config.EnableMeadowFarm.values.true': 'Да', 'config.EnableMeadowFarm.values.false': 'Нет',
  'config.WalkTidePools.values.true': 'Да', 'config.WalkTidePools.values.false': 'Нет',
  'config.ObeliskOptions.values.vanilla': 'Ванильный', 'config.ObeliskOptions.values.glass': 'Стеклянный',
  'config.ObeliskOptions.values.garden': 'Садовый', 'config.ObeliskOptions.values.Yri': 'Вариант Yri',
  'config.ObeliskOptions.values.Juffuffles': 'Мини-тотемы Juffuffles',
  'config.PlayCustomMusic.values.true': 'Да', 'config.PlayCustomMusic.values.false': 'Нет',
  'config.TownMap.values.default': 'Автоматически', 'config.TownMap.values.karmylla': 'Карта Karmylla',
  'config.TownMap.values.vanilla': 'Ванильная карта',
  'config.ExcludeObjects.values.true': 'Да', 'config.ExcludeObjects.values.false': 'Нет',
  'config.EnableAdditionalCrops.values.true': 'Да', 'config.EnableAdditionalCrops.values.false': 'Нет',
  'config.AllowGiantChocoFruit.values.true': 'Да', 'config.AllowGiantChocoFruit.values.false': 'Нет'
};

const NPC_CONFIG_EN = {
  'config.FriendableZuzuNPCs.name': 'Friendable Zuzu NPCs', 'config.FriendableZuzuNPCs.description': 'Select the Zuzu NPCs you want to befriend.',
  'config.NyapuPortraits.name': 'Nyapu portraits', 'config.NyapuPortraits.description': 'Choose which Nyapu portraits to use.',
  'config.FestivalOutfits.name': 'Festival outfits', 'config.FestivalOutfits.description': "Allow festival outfits for Spirit's Eve and the Flower Dance.",
  'config.NoSirMemeDuck.name': 'Duck address and memes', 'config.NoSirMemeDuck.description': "Disable the duck's 'sir' address and grape-related meme reference.",
  'config.EnableSpecialOrders.values.true': 'Yes', 'config.EnableSpecialOrders.values.false': 'No',
  'config.TrentonFamilyDrama.values.true': 'Yes', 'config.TrentonFamilyDrama.values.false': 'No',
  'config.FriendableAnimals.values.EmperorDuck': 'Emperor Duck', 'config.FriendableAnimals.values.EmpressDuck': 'Empress Duck',
  'config.FriendableAnimals.values.LadyShebaCat': 'Lady Sheba Cat', 'config.FriendableAnimals.values.LittleGruff': 'Little Gruff',
  'config.FriendableAnimals.values.HappySlime': 'Happy Slime',
  'config.FriendableZuzuNPCs.values.Stella': 'Stella', 'config.FriendableZuzuNPCs.values.Kennedy': 'Kennedy',
  'config.RivalHearts.values.RosaJuliet': 'Rosa and Juliet', 'config.RivalHearts.values.AideenMateo': 'Aideen and Mateo',
  'config.RivalHearts.values.TristanShane': 'Tristan and Shane',
  'config.GenderNeutral.values.true': 'Yes', 'config.GenderNeutral.values.false': 'No',
  'config.KeepNonDatable.values.Jasper': 'Jasper', 'config.KeepNonDatable.values.Juliet': 'Juliet',
  'config.KeepNonDatable.values.Kataryna': 'Kataryna', 'config.KeepNonDatable.values.Aideen': 'Aideen',
  'config.KeepNonDatable.values.Jade': 'Jade', 'config.KeepNonDatable.values.Tristan': 'Tristan',
  'config.NyapuPortraits.values.true': 'All', 'config.NyapuPortraits.values.false': 'Disabled',
  'config.NyapuPortraits.values.animals': 'Animals only',
  'config.FestivalOutfits.values.true': 'Yes', 'config.FestivalOutfits.values.false': 'No',
  'config.NoSirMemeDuck.values.true': 'Yes', 'config.NoSirMemeDuck.values.false': 'No'
};

const NPC_CONFIG_RU = {
  'config.FriendableZuzuNPCs.name': 'Дружба с персонажами Зузу', 'config.FriendableZuzuNPCs.description': 'Выберите персонажей из Зузу, с которыми можно подружиться.',
  'config.NyapuPortraits.name': 'Портреты от Nyapu', 'config.NyapuPortraits.description': 'Выберите, для кого использовать портреты от Nyapu.',
  'config.FestivalOutfits.name': 'Праздничные наряды', 'config.FestivalOutfits.description': 'Включить праздничные наряды для Дня всех духов и Цветочного танца.',
  'config.NoSirMemeDuck.name': 'Обращение утки и мемы', 'config.NoSirMemeDuck.description': 'Отключить обращение утки «сэр» и отсылку к мему про виноград.',
  'config.EnableSpecialOrders.values.true': 'Да', 'config.EnableSpecialOrders.values.false': 'Нет',
  'config.TrentonFamilyDrama.values.true': 'Да', 'config.TrentonFamilyDrama.values.false': 'Нет',
  'config.FriendableAnimals.values.EmperorDuck': 'Императорская утка', 'config.FriendableAnimals.values.EmpressDuck': 'Императрица-утка',
  'config.FriendableAnimals.values.LadyShebaCat': 'Кошка леди Шеба', 'config.FriendableAnimals.values.LittleGruff': 'Малыш Груфф',
  'config.FriendableAnimals.values.HappySlime': 'Слайм Хэппи',
  'config.FriendableZuzuNPCs.values.Stella': 'Стелла', 'config.FriendableZuzuNPCs.values.Kennedy': 'Кеннеди',
  'config.RivalHearts.values.RosaJuliet': 'Роса и Джульетта', 'config.RivalHearts.values.AideenMateo': 'Эйдин и Матео',
  'config.RivalHearts.values.TristanShane': 'Тристан и Шейн',
  'config.GenderNeutral.values.true': 'Да', 'config.GenderNeutral.values.false': 'Нет',
  'config.KeepNonDatable.values.Jasper': 'Джаспер', 'config.KeepNonDatable.values.Juliet': 'Джульетта',
  'config.KeepNonDatable.values.Kataryna': 'Катарина', 'config.KeepNonDatable.values.Aideen': 'Эйдин',
  'config.KeepNonDatable.values.Jade': 'Джейд', 'config.KeepNonDatable.values.Tristan': 'Тристан',
  'config.NyapuPortraits.values.true': 'Все', 'config.NyapuPortraits.values.false': 'Отключены',
  'config.NyapuPortraits.values.animals': 'Только животные',
  'config.FestivalOutfits.values.true': 'Да', 'config.FestivalOutfits.values.false': 'Нет',
  'config.NoSirMemeDuck.values.true': 'Да', 'config.NoSirMemeDuck.values.false': 'Нет'
};

const CORE_FIXES = {
  'config.AllowGiantChocoFruit.name': 'Разрешить гигантские шокофрукты',
  'config.AllowGiantChocoFruit.description': 'Шокофрукты — возобновляемая культура, способная вырасти до гигантского размера. Если это мешает, гигантские плоды можно отключить.',
  'object.Golden_Apple_Tree_Name': 'Золотая яблоня',
  'object.Golden_Apple_Tree_Description': 'Вырастает в зрелую золотую яблоню за 28 дней. Растёт, только если все восемь соседних клеток свободны.',
  'config.GoatSkin.description': '«Исходная» — для коз пустоты в ванильном стиле; «Обновлённая» — вариант оформления от Saurianne.',
  'config.WalkTidePools.description': 'Позволяет вам и другим персонажам ходить по приливным бассейнам. В них по-прежнему можно ловить рыбу!',
  'config.farmcave_trapdoorx.name': 'Горизонтальная координата люка в пещере',
  'config.farmcave_trapdoory.name': 'Вертикальная координата люка в пещере',
  'config.farmcave_exitx.name': 'Горизонтальная координата выхода из люка',
  'config.farmcave_exity.name': 'Вертикальная координата выхода из люка',
  'config.farmcave_trapdoorx.description': 'Горизонтальная клетка, на которой будет размещён люк в пещере на ферме.',
  'config.farmcave_trapdoory.description': 'Вертикальная клетка, на которой будет размещён люк в пещере на ферме.',
  'config.farmcave_exitx.description': 'Горизонтальная клетка выхода из люка в пещере на ферме; рекомендуется выбрать ту же, что и для люка.',
  'config.farmcave_exity.description': 'Вертикальная клетка выхода из люка в пещере на ферме; рекомендуется выбрать клетку на одну ниже люка.',
  'Strings.HartResidence.02': '«Расширенное руководство по дизайну — Перона Джи»',
  'ES.ForLore': 'Поверх аппарата наклеена надпись: «Не работает (Да здравствует Король)», но экран всё же светится. Рекорд принадлежит: 1. Искатель Знаний.',
  'strings.lodginghouse.15': 'Похоже, устройство воспроизводит только детские видеодиски. Это фильмы о семье и дружбе — очень полезные и добрые.'
};

const PERCENT_FIXES = {
  'Aideen_Marriage_OneKid_3': 'Бедный барон Манчингтон, %kid1 совсем взъерошил ему шёрстку!#$b#Он ещё не привык к тому, что приходится делиться моей лаской.$3',
  'Eloise_marriedB': 'Красота. Это для %spouse?',
  'Jade_marriage_OneKid_2': 'Не волнуйся, я сегодня присмотрю за %kid1. А ты просто сосредоточься на своей работе!$h',
  'Jasper_Marriage_OneKid_0': '%kid1 сегодня подарил мне самую яркую улыбку. Ах, моё сердце растаяло.$4',
  'Jasper_Marriage_OneKid_1': 'Малыш %kid1 — просто чудо. Мне кажется, мы изобретаем свой собственный тайный язык.',
  'Jasper_Marriage_OneKid_2': 'Доброе утро, любовь моя! Я уже накормил %kid1 питательным тёплым завтраком, и мы готовы к целому дню домашних приключений!$1',
  'Jasper_Marriage_OneKid_3': 'Я сочинил несколько рассказов для %kid1. Может быть, когда-нибудь я их даже опубликую.',
  'Jasper_Marriage_summer_TwoKids_0': '$1 TwoKids_Jasper#Не беспокойся о нас, @, мы с детьми прекрасно проведём время!$k#$e#Может, сводить их на пляж? Возможно, пришло время научить %kid1 тонкому искусству строительства замков из песка.',
  'Jasper_Marriage_summer_TwoKids_1': 'Дать %kid1 мороженое было не лучшей идеей...#$b#Но не волнуйся, я вымыл все стены!$3#$b#%kid1 — настоящий художник.',
  'Jasper_Marriage_fall_TwoKids_0': '%kid1 сегодня нашёл в листьях червяка и сказал %kid2, что это «пиц-гетти».$2#$b#Не волнуйся: червяк был конфискован и благополучно отпущен. Ни черви, ни маленькие дети не пострадали.$3',
  'Juliet_Marriage_TwoKids_3': '%kid1 сегодня нарисовал нас. Рисунок висит на холодильнике.#$b#Да, твоё сходство передано идеально, правда?',
  'Kataryna_Marriage_OneKid_3': 'Уф, что за день... Я почти уверена, что в %kid1 вселилось что-то потустороннее.#$b#Не ${мог^могла}$ бы ты сегодня приготовить ужин, ${дорогой^дорогая}$? Я так вымотана.$2',
  'Kataryna_Marriage_OneKid_5': 'Не забудь попрощаться с %kid1, прежде чем уйти сегодня.',
  'Tori_Marriage_OneKid_2': 'Мне кажется, Хэппи ревнует к %kid1... А я-то надеялась, что они станут лучшими друзьями.$2',
  'MarriageDialogue.Tristan.OneKid_1': 'Небольшое признание, ${любимый^любимая}$... Я дал %kid1 кусочек сыра. Это дало... непредвиденный... эффект.$2#$b#Откуда мне было знать, что детям такое нельзя? К ним ведь инструкция не прилагается!#$b#Да-да, я уже привёл %kid1 в порядок.',
  'Corwin_Marriage_OneKid_1': 'Я тут думаю смастерить для %kid1 маленький кораблик...#$b#Что скажешь, детка?',
  'Corwin_Marriage_OneKid_2': 'Не волнуйся, ${сладкий мой^сладкая моя}$, я сегодня сам накормлю %kid1.',
  'Corwin_Marriage_TwoKids_3': 'Эй, детка... я сегодня побуду с %kid1 и %kid2, так что не переживай. Обещаю, не буду учить их своим дьявольским штучкам.$1',
  'Dale_Marriage_OneKid_1': 'Ты ${видел^видела}$ %kid1 сегодня утром? Всё было перепачкано вареньем — очень милое зрелище.$1',
  'Dale_Marriage_OneKid_2': 'Валькирия — отличная собачья нянька: она очень нежна с %kid1.',
  'Dale_Marriage_OneKid_3': 'Быть отцом — это потрясающе! У %kid1 уже проявляется характер. Мне не терпится узнать, каким человеком вырастет наш ребёнок.'
};

const NPC_FIXES = {
  Dialogue: {
    ...PERCENT_FIXES,
    'Dwarf_Dialogue_JasperSpouse_summer_Fri_inlaw_Jasper2.a': 'Что значит «абсурдный»?',
    'Dale_ESIntroduction': '$1 DaleWaede_Introduction#Привет, я Дейл. А эта красавица рядом — Валькирия.$1#Привет. Хороший день?',
    'Keanu_ESIntroduction': '$1 KeanuAvis_Introduction#О, я раньше тебя здесь не видел. Я Киану, сам недавно вернулся в город.#$e#Думаю, ещё увидимся.',
    'juliet.marriage.fall_juliet': 'С добрым утром, ${красавчик^красотка}$! Ладно, я по делам! Увидимся!$1#$b#О, держи, чтобы силы не иссякли до вечера. У меня на тебя кое-какие планы.$4',
    'Josephine_reject_EastScarp_Vintage_Ruby_Ring': 'О, какая прелесть! Я хорошо разбираюсь в драгоценностях, @, и это великолепный камень. Кто-то наверняка его потерял.#$b#Может, стоит пройтись по городу и примерить его всем на палец — прямо как в современной сказке о Золушке!$1',
    'Dale_fall_Fri10': 'Сегодня довольно прохладно... Если мёрзнешь, могу одолжить тебе пальто, @?$2#$b#Всё хорошо? Тогда без проблем, но скажи, если передумаешь.',
    'dialogue.festivals.summer28': 'Романтично? Наверное, было бы романтично, если бы весь город не пришёл на них смотреть.#$b#Ладно, признаю: они довольно красивые.#$b#Может, улизнём куда-нибудь вдвоём?',
    'Cameron_summer_Wed': 'Эх... Мисс Катарина всё подсовывает листовки в мой почтовый ящик...#$b#Вот такие радости жизни по соседству с любительницей криптидов.$a',
    'Michael_summer_Fri': 'Ты ${встречал^встречала}$ моих дружелюбных соседей-фазанов? Иногда они оставляют мне яйцо-другое.#$b#Получается приятное разнообразие к завтраку. Вот, попробуй ${сам^сама}$!$1'
  },
  Events: {
    '57873014.07.true': '@ многое сделал для этого города.#$b#{{GenderNeutralPossessive}} свежие продукты действительно помогли укрепить нашу экономику.',
    '57876034.08.true': 'И прощайте, {{GenderNeutralTitle}} @',
    '5295006.4.true': 'Конечно, {{GenderNeutralSubjectiveHave}}, Рас.',
    '57871300.0': 'Фермер {{playername}}!',
    '57873000.04': 'Они приедут завтра и поселятся в гостинице «Скарп» на холодное время года.#$b#Я рассчитываю на тебя, @: помоги им почувствовать себя желанными гостями.#$b#Что скажешь?',
    '57870003.19': 'Эти девочки ещё не совсем одичали... их выпустили недавно.#$b#Важно поймать их сейчас, пока их не съели лисы и они не утратили доверие к людям.',
    '55990003.04': 'Хочешь знать, что именно я хотел выяснить?#$b#Я родился глубоко в Каскадных горах и вырос на сказаниях о родине, полной звёзд и чудовищ из глубин. Раскол разорвал всё на части.',
    '57876009.14': 'Ага! Прибыл с юБай сегодня утром. Надеемся, что это сработает.$1'
  },
  SpecialOrders: {
    'EastScarp.SpecialOrders.JadeNudibranch_Objective_1_Text': 'Собрать 6 нудибранхов из приливных луж',
    'EastScarp.SpecialOrders.JadeNudibranch_Objective_2_Text': 'Доставить 6 нудибранхов в ящик Джесси.',
    'EastScarp.SpecialOrders.EloiseJasJayMail.text': 'Спасибо, ${дядя^тётя}$ @!^Мы идём в лес в следующий солнечный день (НЕ в учебный...), чтобы покормить Джереми! Может, он приведёт свою семью. Ты тоже можешь прийти, если хочешь.^^С любовью, Элоиза и Джас',
    'EastScarp.SpecialOrders.EloiseRealMacawMail.text': 'Спасибо, ${дядя^тётя}$ @!^Ричи ОБОЖАЕТ лесные орехи! Он даже выучил новые слова и хочет поблагодарить тебя сам! Так что заходи и скажи ПРИВЕТ!^^С благодарностью, Элоиза.'
  },
  Mail: {
    MEEPLetter: '^^^   Лилит Шеридан      ^   дом 1, Вишнёвые высоты      ^   Восточный Скарп      ^   Город Пеликан      ^   Долина Стардью 5787      ^^',
    JacobDinnerDate: 'Привет, @!^Я просто хотел написать, что ты мне очень нравишься, и пригласить тебя на ужин завтра вечером! Что скажешь? Ужин в шесть!^Очень-очень надеюсь, что ты придёшь!^С любовью,^Джейкоб. Обнимаю и целую.'
  },
  Strings: {
    'rain.ethan': '$c 0.5#Я сегодня ничего не хочу делать.$2$k#$e#М-м-м, почему ты ${так промок^так промокла}$?$3',
    'EastScarp.Locations.TNPCWaitingRoom': 'Зал ожидания персонажей'
  },
  config: {
    'config.RivalHearts.name': 'Пары персонажей',
    'config.RivalHearts.description': 'Включить или выключить романтические пары между персонажами. Для некоторых пар могут потребоваться дополнительные моды.',
    'config.GenderNeutral.description': 'Персонажи будут обращаться к фермеру в нейтральном роде. Для собственных местоимений установите мод GMNT.',
    'config.NoSirMemeDuck': 'Включите этот параметр, если не хотите, чтобы утка называла вас «сэр» или использовала отсылку к мему.'
  }
};

function globalVisibleRepairs(value) {
  return String(value)
    .replace(/Итанy/g, 'Итану').replace(/\bMMO\b/g, 'ММО')
    .replace(/P\.P\.S\.:/g, 'П. П. С.:').replace(/P\.S\.:/g, 'П. С.:')
    .replace(/(^|[^A-Za-zА-Яа-яЁё\[])O(?=[А-Яа-яЁёХх!,.…-])/g, '$1О');
}

function applyReadyKeyRepairs(path, ru) {
  if (path.endsWith('/Events.json')) { ru['50706131.1'] = ru['50706131.1.HMfalse']; delete ru['50706131.1.HMfalse']; }
  if (path.endsWith('/Strings.json')) { ru['Dialogue.Jas.ScarfAroundLampPost.true.'] = ru['Dialogue.Jas.ScarfAroundLampPost.true']; delete ru['Dialogue.Jas.ScarfAroundLampPost.true']; }
}

function npcFileName(path) {
  const match = path.match(/\/Default\/([^/]+)\.json$/);
  return match && match[1];
}

function buildFinalI18n(source, ready, path) {
  const ru = { ...ready };
  applyReadyKeyRepairs(path, ru);
  if (path === 'East Scarp Core/i18n/default.json') Object.assign(ru, CORE_FIXES);
  const npcName = npcFileName(path);
  if (npcName && NPC_FIXES[npcName]) Object.assign(ru, NPC_FIXES[npcName]);
  for (const key of Object.keys(source)) {
    if (!(key in ru)) continue;
    let value = globalVisibleRepairs(ru[key]);
    value = repairDollars(source[key], value, key);
    value = repairAt(source[key], value, key);
    ru[key] = value;
  }
  if (path === 'East Scarp Core/i18n/default.json') Object.assign(ru, CORE_CONFIG_RU);
  if (path === 'East Scarp NPCs/i18n/Default/config.json') Object.assign(ru, NPC_CONFIG_RU);
  return ru;
}

function buildFinalDefault(source, path) {
  if (path === 'East Scarp Core/i18n/default.json') return { ...source, ...CORE_CONFIG_EN };
  if (path === 'East Scarp NPCs/i18n/Default/config.json') return { ...source, ...NPC_CONFIG_EN };
  return source;
}

function simpleTokens(value) { return simpleDollarParts(value).tokens.map(x => x.token); }
function arrayTokens(value, regex) { return String(value).match(regex) || []; }

function technicalTokenAudit(source, translated, key) {
  const sourceSimple = simpleTokens(source), translatedSimple = simpleTokens(translated);
  let branchCollapse = false;
  if (!equal(sourceSimple, translatedSimple) && GENDER_BRANCH_COLLAPSES.has(key)) {
    branchCollapse = equal(sorted(new Set(sourceSimple)), sorted(new Set(translatedSimple))) && equal(sourceSimple.filter(isBreakToken), translatedSimple.filter(isBreakToken));
  }
  if (!equal(sourceSimple, translatedSimple) && !branchCollapse) return { ok: false, type: 'simple' };
  const checks = [
    ['percent', /%(?:kid[12]|spouse)\b/g], ['cp', /\{\{[^}]+\}\}/g], ['bracket', /\[[^\]]+\]/g],
    ['qrd', /\$(?:query|q|r|d|c|p)\s+[^#]*#|\$[0-9]+\s+[A-Za-z0-9_.-]+#|#r\s+[^#]*#/g]
  ];
  for (const [type, regex] of checks) if (!equal(arrayTokens(source, regex), arrayTokens(translated, regex))) return { ok: false, type };
  const sourceAt = atCount(source), translatedAt = atCount(translated), collapsedAt = sourceAt === 2 && translatedAt === 1 && String(source).includes('^');
  if (translatedAt < sourceAt && !collapsedAt) return { ok: false, type: 'at' };
  return { ok: true, branchCollapse };
}

function assertI18n(source, translated, label) {
  keyParity(source, translated, label);
  const empty = Object.keys(source).filter(k => String(source[k]).trim() && !String(translated[k]).trim());
  if (empty.length) throw new Error(`${label}: untranslated empty values ${empty.slice(0, 6).join('|')}`);
  const malformed = Object.keys(translated).filter(k => /#\$[be]##(?!\$)|,\s*@\s*,\s*@|@\s+@|\$\$|\$\{[^}]*$/.test(String(translated[k])));
  if (malformed.length) throw new Error(`${label}: malformed controls ${malformed.slice(0, 6).join('|')}`);
  const bad = [], collapse = [];
  for (const key of Object.keys(source)) {
    const audit = technicalTokenAudit(source[key], translated[key], key);
    if (!audit.ok) bad.push(`${key}:${audit.type}`);
    if (audit.branchCollapse) collapse.push(key);
  }
  if (bad.length) throw new Error(`${label}: token mismatch ${bad.slice(0, 8).join('|')}`);
  return collapse.length;
}

function slashCommands(value) {
  return [...String(value).matchAll(/(?:^|\/)(pause\s+\d+|shake\s+\S+\s+\d+|faceDirection\s+\S+\s+\d+|speak\s+\S+|message)(?=\s|\/|$)/g)].map(x => x[1]);
}

function assertSlashCommands(source, translated, label) {
  const bad = Object.keys(source).filter(k => !equal(slashCommands(source[k]), slashCommands(translated[k])));
  if (bad.length) throw new Error(`${label}: slash commands changed ${bad.slice(0, 6).join('|')}`);
}

function scrubTechnicalLatin(value) {
  return String(value)
    .replace(/\$\{[^}]+\}\$?/g, '').replace(/\{\{[^}]+\}\}/g, '')
    .replace(/\$(?:query|q|r|d|c|p)\s+[^#]*#|\$[0-9]+\s+[A-Za-z0-9_.-]+#|#r\s+[^#]*#/g, '')
    .replace(/\[[^\]]+\]/g, '').replace(/\{[A-Za-z0-9_.:-]+\}/g, '')
    .replace(/%[A-Za-z0-9_.:-]+/g, '')
    .replace(/(?:^|\/)(?:pause\s+\d+|shake\s+\S+\s+\d+|faceDirection\s+\S+\s+\d+|speak\s+\S+|message)/g, '')
    .replace(/\$[A-Za-z0-9!]+/g, '').replace(/X{2,}/g, '')
    .replace(/\b(?:Saurianne|Gwen's|Juffuffles|Yri|Karmylla|Passerby Cemetary|GMNT|Mr\. Ginger|Nyapu|MisterGinger|Jasper|Aideen|Juliet|ToriLK|Jade|KatarynaLK)\b/g, '');
}

function assertNoVisibleLatin(object, label, allowedKeys = new Set()) {
  const bad = Object.entries(object).filter(([key, value]) => !allowedKeys.has(key) && /[A-Za-z]{2,}/.test(scrubTechnicalLatin(value)));
  if (bad.length) throw new Error(`${label}: visible Latin ${bad.slice(0, 8).map(([k, v]) => `${k}=${String(v).match(/[A-Za-z]{2,}/)?.[0]}`).join('|')}`);
}

function validateSchemas(coreContent, npcContent) {
  const core = coreContent.ConfigSchema || {}, npc = npcContent.ConfigSchema || {};
  if (Object.keys(core).length !== 13 || Object.keys(npc).length !== 12) throw new Error(`ConfigSchema options ${Object.keys(core).length}/13 ${Object.keys(npc).length}/12`);
  const coreValues = Object.values(core).reduce((n, row) => n + valuesOf(row).length, 0), npcValues = Object.values(npc).reduce((n, row) => n + valuesOf(row).length, 0);
  if (coreValues !== 118 || npcValues !== 29) throw new Error(`Config AllowValues ${coreValues}/118, ${npcValues}/29`);
  return { coreOptions: 13, coreAllowValues: 118, coreDisplayValueLabels: 22, npcOptions: 12, npcAllowValues: 29 };
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function setContentFallbacks(content) {
  const out = clone(content);
  out.ConfigSchema.KeepNonDatable.Description = 'Укажите имена персонажей, с которыми не хотите начинать роман. Их события на 14 сердцах откроются как дружеские.';
  out.ConfigSchema.NoSirMemeDuck.Description = 'Включите этот параметр, если не хотите шуток про виноград с вашей уткой или обращения «сэр».';
  const bus = out.Changes[67].Entries;
  bus.ESBusNetwork.Destinations[0].DisplayName = 'Автобусная остановка';
  bus.ESBusNetwork.Destinations[1].DisplayName = 'Автобусная остановка Скарпа';
  bus.ESBusNetwork.Destinations[2].DisplayName = 'Пригород Зузу (университетский район)';
  out.Changes[76].Entries.EastScarp_BusNetwork_CentralLink.DisplayName = 'Центральный вокзал';
  return out;
}

const ANIMAL_NAMES = {
  albinoRabbit: 'Белый кролик', Alpaca: 'Альпака', BabyChick: 'Цыплёнок', Baron_Reginald: 'Барон Реджинальд',
  BrownChicken: 'Коричневая курица', Emperor_Duckling: 'Императорский утёнок', Emperor_Duckling_Swim: 'Императорский утёнок',
  Fairy_Penguin: 'Волшебный пингвин', Fairy_Penguin_Chick: 'Птенец волшебного пингвина', FriendGull: 'Друг Гулл',
  VoidBilly: 'Козёл пустоты', VoidChick: 'Цыплёнок пустоты', VoidGoat: 'Коза пустоты', VoidKid: 'Козлёнок пустоты',
  WhiteChicken: 'Белая курица', 'Cock Pheasant': 'Фазан', 'Hen Pheasant': 'Фазанка'
};

function translateAnimalDisplayNames(value) {
  let changed = 0;
  function walk(node) {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      if (key === 'DisplayName' && Object.prototype.hasOwnProperty.call(ANIMAL_NAMES, child)) { node[key] = ANIMAL_NAMES[child]; changed++; }
      else walk(child);
    }
  }
  const out = clone(value); walk(out); return { out, changed };
}

function assertSchemaInternalsUnchanged(before, after) {
  const clean = input => { const result = clone(input.ConfigSchema); for (const row of Object.values(result)) delete row.Description; return result; };
  if (!equal(clean(before), clean(after))) throw new Error('NPC content: ConfigSchema internals changed');
}

function outputPath(suffix) { return `Mods/${ROOT}/${suffix}`; }

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const key = process.env.NEXUS_API_KEY;
    if (!key) throw new Error('NEXUS_API_KEY missing');
    const [source308Buffer, source309Buffer, readyBuffer] = await Promise.all([
      downloadArchive(MODS.source308, key), downloadArchive(MODS.source309, key), downloadArchive(MODS.readyRu, key)
    ]);
    const source308 = entries(source308Buffer), source309 = entries(source309Buffer), ready = entries(readyBuffer);
    for (const [uniqueId, name] of MANIFESTS) {
      validateManifest(source308, uniqueId, MODS.source308.version, `${name} source 3.0.8`);
      validateManifest(source309, uniqueId, MODS.source309.version, `${name} source 3.0.9`);
    }

    const source308Objects = {}, source309Objects = {}, readyObjects = {};
    let source308Keys = 0, source309Keys = 0, readyKeys = 0;
    for (const pair of I18N) {
      source308Objects[pair.source] = readObject(source308, pair.source, `source 3.0.8 ${pair.source}`);
      source309Objects[pair.source] = readObject(source309, pair.source, `source 3.0.9 ${pair.source}`);
      readyObjects[pair.source] = readObject(ready, pair.ru, `ready RU ${pair.ru}`);
      source308Keys += Object.keys(source308Objects[pair.source]).length;
      source309Keys += Object.keys(source309Objects[pair.source]).length;
      readyKeys += Object.keys(readyObjects[pair.source]).length;
    }
    if (source308Keys !== 11749 || source309Keys !== 11753 || readyKeys !== 11749) throw new Error(`i18n totals ${source308Keys}/11749 ${source309Keys}/11753 ${readyKeys}/11749`);

    const corePath = 'East Scarp Core/i18n/default.json', specialPath = 'East Scarp NPCs/i18n/Default/SpecialOrders.json';
    const expectedAdded = ['config.AllowGiantChocoFruit.description', 'config.AllowGiantChocoFruit.name', 'object.Golden_Apple_Tree_Description', 'object.Golden_Apple_Tree_Name'];
    const expectedChanged = ['EastScarp.SpecialOrders.JadeNudibranch_Objective_1_Text', 'EastScarp.SpecialOrders.JadeNudibranch_Objective_2_Text', 'EastScarp.SpecialOrders.VictoriaEnrichment_Objective_2_Text', 'EastScarp.SpecialOrders.VictoriaEnrichment_Text'];
    for (const pair of I18N) {
      const delta = diffKeys(source308Objects[pair.source], source309Objects[pair.source]);
      if (pair.source === corePath) {
        if (!equal(sorted(delta.added), expectedAdded) || delta.removed.length || delta.changed.length) throw new Error('3.0.9 Core delta changed');
      } else if (pair.source === specialPath) {
        if (delta.added.length || delta.removed.length || !equal(sorted(delta.changed), expectedChanged)) throw new Error('3.0.9 SpecialOrders delta changed');
      } else if (delta.added.length || delta.removed.length || delta.changed.length) throw new Error(`unexpected 3.0.9 i18n delta in ${pair.source}`);
    }

    const rawReadyMissing = [], rawReadyExtra = [];
    for (const pair of I18N) {
      const source = source308Objects[pair.source], ru = readyObjects[pair.source];
      rawReadyMissing.push(...Object.keys(source).filter(k => !(k in ru)).map(k => `${pair.source}:${k}`));
      rawReadyExtra.push(...Object.keys(ru).filter(k => !(k in source)).map(k => `${pair.source}:${k}`));
    }
    if (!equal(sorted(rawReadyMissing.map(x => x.split(':').slice(-1)[0])), ['50706131.1', 'Dialogue.Jas.ScarfAroundLampPost.true.']) ||
        !equal(sorted(rawReadyExtra.map(x => x.split(':').slice(-1)[0])), ['50706131.1.HMfalse', 'Dialogue.Jas.ScarfAroundLampPost.true'])) throw new Error('ready RU key typo set changed');

    const coreContent = readObject(source309, 'East Scarp Core/content.json', 'Core content');
    const npcContent = readObject(source309, 'East Scarp NPCs/content.json', 'NPC content');
    const schema = validateSchemas(coreContent, npcContent);

    const zip = new AdmZip();
    let finalKeys = 0, genderBranchCollapses = 0;
    const allowedConstructed = new Set(['55990004.05']);
    for (const pair of I18N) {
      const source = source309Objects[pair.source], readyRu = readyObjects[pair.source];
      const finalDefault = buildFinalDefault(source, pair.source), finalRu = buildFinalI18n(source, readyRu, pair.source);
      genderBranchCollapses += assertI18n(finalDefault, finalRu, pair.source);
      assertSlashCommands(finalDefault, finalRu, pair.source);
      assertNoVisibleLatin(finalRu, pair.source, pair.source.endsWith('/Events.json') ? allowedConstructed : new Set());
      finalKeys += Object.keys(finalRu).length;
      zip.addFile(outputPath(pair.ru), jsonBuffer(finalRu));
      if (pair.addDefault) zip.addFile(outputPath(pair.source), jsonBuffer(finalDefault));
    }
    if (finalKeys !== 11816) throw new Error(`final RU keys ${finalKeys}/11816`);
    if (genderBranchCollapses !== 18) throw new Error(`gender branch token collapses ${genderBranchCollapses}/18`);

    zip.addFile(outputPath('ESBarberShop/assets/text.json'), jsonBuffer({ Title: 'Парикмахерская', Question: 'Какую причёску вы хотите сегодня?' }));

    const patchedContent = setContentFallbacks(npcContent);
    assertSchemaInternalsUnchanged(npcContent, patchedContent); validateSchemas(coreContent, patchedContent);
    zip.addFile(outputPath('East Scarp NPCs/content.json'), jsonBuffer(patchedContent));

    const animals = readObject(source309, 'East Scarp NPCs/assets/Data/MEEP_Animals.json', 'MEEP animals');
    const animalResult = translateAnimalDisplayNames(animals);
    if (animalResult.changed !== 59) throw new Error(`MEEP DisplayName translations ${animalResult.changed}/59`);
    zip.addFile(outputPath('East Scarp NPCs/assets/Data/MEEP_Animals.json'), jsonBuffer(animalResult.out));

    const tmxPath = 'East Scarp Core/assets/Locations/Interiors/TheaterBreakroom.tmx';
    const tmxSource = readText(source309, tmxPath, 'Theater breakroom'), anchor = 'value="Dialogue Staff Only"';
    if ((tmxSource.match(/Dialogue Staff Only/g) || []).length !== 1) throw new Error('TMX Staff Only anchor changed');
    const tmxRu = tmxSource.replace(anchor, 'value="Dialogue Только для персонала"');
    if ((tmxRu.match(/Dialogue Только для персонала/g) || []).length !== 1 || tmxRu.replace('Только для персонала', 'Staff Only') !== tmxSource) throw new Error('TMX technical command changed');
    zip.addFile(outputPath(tmxPath), Buffer.from(tmxRu, 'utf8'));

    const files = zip.getEntries().filter(e => !e.isDirectory);
    if (files.length !== 20) throw new Error(`Stage 62 output files ${files.length}/20`);
    const output = zip.toBuffer();
    const status = {
      ok: true, complete: true, stage: 62, mods: 1, files: files.length, zipBytes: output.length,
      verified: [{
        name: 'East Scarp Remastered', version: MODS.source309.version, fileId: MODS.source309.fileId,
        logicalModCount: 1, components: MANIFESTS.map(([, name]) => name), componentManifests: 5,
        readyRuVersion: MODS.readyRu.version, readyRuFileId: MODS.readyRu.fileId,
        source308Keys, source309Keys, readyRuKeys: readyKeys, finalRuKeys: finalKeys,
        versionDeltaAdded: 4, versionDeltaChanged: 4, renamedReadyKeys: 2,
        translatedEmptyValues: 1, dynamicPlaceholderRepairs: 21, contentPatcherTokenRepairs: 5,
        behaviorChangingReadyTokensRemoved: 5, genderBranchTokenCollapses: genderBranchCollapses,
        addedConfigLabels: 63, config: schema,
        activeRawFilesLocalized: 4, rawFallbackLabels: 6, rawAnimalDisplayNames: animalResult.changed, rawTmxActions: 1,
        missing: 0, extra: 0, emptyVisibleTranslations: 0, tokenMismatch: 0,
        internalConfigKeysChanged: 0, internalAllowValuesChanged: 0, technicalCommandsChanged: 0,
        remainingVisibleLatin: 0
      }]
    };
    if (String(req.query.status || '') === '1') return res.status(200).json(status);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="RU_STAGE62_EAST_SCARP_3.0.9_VERIFIED.zip"');
    return res.status(200).send(output);
  } catch (error) {
    return res.status(500).json({ ok: false, complete: false, stage: 62, error: String(error && error.message || error) });
  }
};

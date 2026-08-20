const AdmZip = require('adm-zip');

const MODS = [
  { key: 'emRandom', name: "Em's SVE Animals CP", modId: 39719, fileId: 173371, version: '1.2', uniqueId: 'Ems.SVEanimalsCP' },
  { key: 'emConfig', name: "Em's SVE Animals CP Config", modId: 39719, fileId: 173372, version: '1.2', uniqueId: 'Ems.SVEanimalsCP' },
  { key: 'hxw', name: 'HxW Tilesheets', modId: 20139, fileId: 137494, version: '2.0.0', uniqueId: 'hxw.tilesheets' },
  { key: 'ichor', name: "Ichor's Cat", modId: 20557, fileId: 110717, version: '1.2.0', uniqueId: 'ichortower.IchorsCat' },
  { key: 'sheltie', name: "Izabelleanne's Sheltie Collie dog", modId: 31335, fileId: 124310, version: '1.1.0', uniqueId: 'Izabelleanne.DogSheltie' },
  { key: 'largeQuail', name: 'Large Quail Mayonnaise', modId: 36021, fileId: 141016, version: '1.1.0', uniqueId: 'ZoeyHoshi.LargeQuailMayonnaise' },
  { key: 'guardianDogs', name: 'Livestock Guardian Dogs', modId: 29989, fileId: 137191, version: '2.0.0', uniqueId: 'CC.LGD' },
  { key: 'luan', name: 'Luan Indoor Tilesheets', modId: 16168, fileId: 171068, version: '2.8.1', uniqueId: 'Luan125gui.Indoor' },
  { key: 'lumiIndoor', name: 'Lumisteria Tilesheets - Indoor', modId: 9599, fileId: 83792, version: '1.4.0', uniqueId: 'Lumisteria.LumiTilesheetsIndoor' },
  { key: 'lumiOutdoor', name: 'Lumisteria Tilesheets - Outdoor', modId: 10448, fileId: 83413, version: '1.4.0', uniqueId: 'Lumisteria.TtilesheetsOutdoor' }
];

const EM_CONFIG = {
  Bear: {
    name: ['Bear', 'Медведь'],
    description: ['Choose the bear skin.', 'Выберите внешний вид медведя.'],
    values: {
      Black: ['Black', 'Чёрный'],
      Brown: ['Brown', 'Коричневый'],
      Grizzly: ['Grizzly', 'Гризли'],
      Polar: ['Polar', 'Белый'],
      Panda: ['Panda', 'Панда'],
      Owl: ['Owl', 'Сова']
    }
  },
  'Honey Jar': {
    name: ['Honey container', 'Ёмкость для мёда'],
    description: ['Choose the honey container texture.', 'Выберите внешний вид ёмкости для мёда.'],
    values: {
      Jar: ['Jar', 'Банка'],
      Pot: ['Pot', 'Горшочек']
    }
  },
  Honey: {
    name: ['Honey texture', 'Текстура мёда'],
    description: ['Replace the honey texture.', 'Заменять текстуру мёда.'],
    values: {
      true: ['Enabled', 'Включено'],
      false: ['Disabled', 'Выключено']
    }
  },
  'Wool and Yarn color': {
    name: ['Wool and yarn color', 'Цвет шерсти и пряжи'],
    description: ['Choose the wool and yarn color.', 'Выберите цвет шерсти и пряжи.'],
    values: {
      Bactrian: ['Bactrian', 'Двугорбый'],
      Mongolian: ['Mongolian', 'Монгольский'],
      Wild: ['Wild', 'Дикий'],
      Dromedary: ['Dromedary', 'Одногорбый'],
      LamaBrown: ['Brown llama', 'Коричневая лама'],
      LamaBlack: ['Black llama', 'Чёрная лама']
    }
  },
  Camel: {
    name: ['Camel', 'Верблюд'],
    description: ['Choose the camel skin.', 'Выберите внешний вид верблюда.'],
    values: {
      Bactrian: ['Bactrian', 'Двугорбый'],
      Mongolian: ['Mongolian', 'Монгольский'],
      Wild: ['Wild', 'Дикий'],
      Dromedary: ['Dromedary', 'Одногорбый'],
      LamaBrown: ['Brown llama', 'Коричневая лама'],
      LamaBlack: ['Black llama', 'Чёрная лама']
    }
  },
  'Wool and Yarn': {
    name: ['Wool and yarn textures', 'Текстуры шерсти и пряжи'],
    description: ['Replace the wool and yarn textures.', 'Заменять текстуры шерсти и пряжи.'],
    values: {
      true: ['Enabled', 'Включено'],
      false: ['Disabled', 'Выключено']
    }
  },
  Goose: {
    name: ['Goose', 'Гусь'],
    description: ['Choose the goose skin.', 'Выберите внешний вид гуся.'],
    values: {
      Embden: ['Embden', 'Эмденский'],
      Greylag: ['Greylag', 'Серый'],
      Canada: ['Canada goose', 'Канадская казарка'],
      Scania: ['Scanian', 'Сканский']
    }
  },
  'Goose Egg': {
    name: ['Goose egg textures', 'Текстуры гусиных яиц'],
    description: ['Replace the goose egg textures.', 'Заменять текстуры гусиных яиц.'],
    values: {
      true: ['Enabled', 'Включено'],
      false: ['Disabled', 'Выключено']
    }
  },
  'Goose Mayo': {
    name: ['Goose mayonnaise texture', 'Текстура гусиного майонеза'],
    description: ['Replace the goose mayonnaise texture.', 'Заменять текстуру гусиного майонеза.'],
    values: {
      true: ['Enabled', 'Включено'],
      false: ['Disabled', 'Выключено']
    }
  }
};

const SHELTIE_CONFIG = {
  dogReplaced: {
    name: ['Dog to replace', 'Заменяемая собака'],
    description: ['Choose which original dog texture to replace.', 'Выберите, какую стандартную собаку заменить.'],
    values: {
      dog: ['Dog 1', 'Собака 1'],
      dog1: ['Dog 2', 'Собака 2'],
      dog2: ['Dog 3', 'Собака 3'],
      dog3: ['Dog 4', 'Собака 4'],
      dog4: ['Dog 5', 'Собака 5'],
      dog5: ['Dog 6', 'Собака 6']
    }
  },
  sheltieColor: {
    name: ['Sheltie color', 'Окрас шелти'],
    description: ['Choose the Sheltie or Collie color.', 'Выберите окрас шелти или колли.'],
    values: {
      sable: ['Sable', 'Соболиный'],
      tricolor: ['Tricolor', 'Трёхцветный']
    }
  }
};

const LUAN_CONFIG = {
  'Choose Recolor Manually': {
    name: ['Choose recolor manually', 'Выбор перекраски вручную'],
    description: ['Override automatic recolor selection.', 'Переопределяет автоматический выбор цветовой схемы.'],
    values: {
      Off: ['Automatic', 'Автовыбор'],
      Vanilla: ['Vanilla', 'Оригинальная'],
      Earthy: ['Earthy', 'Землистая'],
      Starblue: ['Starblue', 'Звёздно-синяя'],
      RusticCountry: ['Rustic Country', 'Деревенская']
    }
  }
};

const LUMI_INDOOR_CONFIG = {
  InteriorOption: {
    name: ['Interior color scheme', 'Цветовая схема интерьера'],
    description: ['Choose a compatible interior recolor.', 'Выберите совместимую перекраску интерьера.'],
    values: {
      auto: ['Automatic', 'Автовыбор'],
      vanilla: ['Vanilla', 'Оригинальная'],
      ATDSV: ['Toned down', 'Приглушённая'],
      grapeponta: ['Vibrant pastoral', 'Яркая пасторальная'],
      starblue: ['Starblue', 'Звёздно-синяя']
    }
  }
};

const GUARDIAN_ANIMALS = [
  ['data/bernese.json', 'LGD_Bernese', 'Bernese', 'Бернский зенненхунд'],
  ['data/blackaussie.json', 'LGD_BlackAussie', 'Black Aussie', 'Чёрная австралийская овчарка'],
  ['data/blackcollie.json', 'LGD_BlackCollie', 'Black Border Collie', 'Чёрный бордер-колли'],
  ['data/blondeaussie.json', 'LGD_BlondeAussie', 'Blonde Aussie', 'Светлая австралийская овчарка'],
  ['data/blondecollie.json', 'LGD_BlondeCollie', 'Blonde Border Collie', 'Светлый бордер-колли'],
  ['data/blondeheeler.json', 'LGD_BlondeHeel', 'Blonde Heeler', 'Светлый хилер'],
  ['data/blondemutt.json', 'LGD_BlondeMutt', 'Blonde Mutt', 'Светлая дворняга'],
  ['data/blueaussie.json', 'LGD_BlueAussie', 'Blue Aussie', 'Голубая австралийская овчарка'],
  ['data/bluecollie.json', 'LGD_BlueCollie', 'Blue Border Collie', 'Голубой бордер-колли'],
  ['data/blueheeler.json', 'LGD_BlueHeel', 'Blue Heeler', 'Голубой хилер'],
  ['data/brownmutt.json', 'LGD_BrownMutt', 'Brown Mutt', 'Коричневая дворняга'],
  ['data/brownshep.json', 'LGD_BrownShep', 'Brown Shepherd', 'Коричневая овчарка'],
  ['data/pyrenes.json', 'LGD_Pyrenes', 'Pyrenes', 'Пиренейская горная собака'],
  ['data/whiteshep.json', 'LGD_WhiteShep', 'White Shepherd', 'Белая овчарка']
];

const GUARDIAN_CONFIG = Object.fromEntries([
  ['Great Pyrenes', 'Пиренейская горная собака'],
  ['Bernese Mountain Dog', 'Бернский зенненхунд'],
  ['Blue Heeler', 'Голубой хилер'],
  ['Blonde Heeler', 'Светлый хилер'],
  ['Blonde Mutt', 'Светлая дворняга'],
  ['Brown Mutt', 'Коричневая дворняга'],
  ['Brown Shepherd', 'Коричневая овчарка'],
  ['White Shepherd', 'Белая овчарка'],
  ['Blonde Aussie', 'Светлая австралийская овчарка'],
  ['Blue Aussie', 'Голубая австралийская овчарка'],
  ['Black Aussie', 'Чёрная австралийская овчарка'],
  ['Blue Border Collie', 'Голубой бордер-колли'],
  ['Blonde Border Collie', 'Светлый бордер-колли'],
  ['Black Border Collie', 'Чёрный бордер-колли']
].map(function (row) {
  return [row[0], {
    name: [row[0], row[1]],
    description: ['Show this breed in Marnie\'s shop.', 'Показывать эту породу в магазине Марни.'],
    values: {
      True: ['Enabled', 'Включено'],
      False: ['Disabled', 'Выключено']
    }
  }];
}));

const LARGE_QUAIL_RU = {
  'config.EnableLQM.name': 'Стиль ремесленных товаров',
  'config.EnableLQM.description': 'Использовать для большого перепелиного майонеза текстуру в стиле ремесленных товаров.',
  'config.LQMTexture.name': 'Текстура большого перепелиного майонеза',
  'config.LQMTexture.description': 'Выберите обычный или крупный размер текстуры большого перепелиного майонеза.',
  'config.LQMTexture.values.Standard': 'Обычный размер',
  'config.LQMTexture.values.Large': 'Крупный размер',
  'config.LQMLabel.name': 'Этикетка большого перепелиного майонеза',
  'config.LQMLabel.description': 'Выберите, нужна ли этикетка на большом перепелином майонезе.',
  'config.LQMLabel.values.Label': 'С этикеткой',
  'config.LQMLabel.values.No_Label': 'Без этикетки',
  'config.EnableLQMCover.name': 'Тканевая крышка большого перепелиного майонеза',
  'config.EnableLQMCover.description': 'Добавить тканевую крышку. Она отображается только у банки обычного размера.',
  'config.LQMCoverColour.name': 'Цвет тканевой крышки',
  'config.LQMCoverColour.description': 'Выберите цвет ткани для большого перепелиного майонеза. Параметр действует только при включённой тканевой крышке.',
  'config.LQMCoverColour.values.Brown': 'Коричневый',
  'config.LQMCoverColour.values.Cool_White': 'Холодный белый',
  'config.LQMCoverColour.values.Navy': 'Тёмно-синий',
  'config.LQMCoverColour.values.Off_White': 'Молочно-белый',
  'config.LQMCoverColour.values.Orange': 'Оранжевый',
  'config.LQMCoverColour.values.Vanilla': 'Цвета оригинальной игры',
  'config.LQMCoverColour.values.Warm_White': 'Тёплый белый',
  'config.section.ZHAG.name': 'Совместимость со стилем ремесленных товаров',
  'config.LQMCopyQuality.name': 'Перенос качества на большой перепелиный майонез',
  'config.LQMCopyQuality.description': 'Сохранять качество большого перепелиного яйца при изготовлении большого перепелиного майонеза.',
  'config.section.Options.name': 'Параметры большого перепелиного майонеза',
  LargeQuailMayonnaise_name: 'Большой перепелиный майонез',
  LargeQuailMayonnaise_description: 'Наконец-то обычная порция майонеза со всей прелестью перепелиных яиц.'
};

async function nexusJson(url, key) {
  const response = await fetch(url, { headers: { apikey: key, 'User-Agent': 'nexus-loader-stage63/1.0' } });
  const data = await response.json().catch(function () { return null; });
  if (!response.ok) throw new Error('Nexus API ' + response.status);
  return data;
}

async function downloadArchive(mod, key) {
  const links = await nexusJson('https://api.nexusmods.com/v1/games/stardewvalley/mods/' + mod.modId + '/files/' + mod.fileId + '/download_link.json', key);
  const mirror = Array.isArray(links) && links.find(function (item) { return item && (item.URI || item.uri); });
  if (!mirror) throw new Error(mod.name + ': no Nexus mirror');
  const response = await fetch(mirror.URI || mirror.uri, { redirect: 'follow', headers: { 'User-Agent': 'nexus-loader-stage63/1.0' } });
  if (!response.ok) throw new Error(mod.name + ': archive download ' + response.status);
  return Buffer.from(await response.arrayBuffer());
}

function archiveEntries(buffer) {
  return new AdmZip(buffer).getEntries().filter(function (entry) {
    return !entry.isDirectory && !/^__macosx\//i.test(entry.entryName);
  });
}

function stripJsonc(source) {
  let output = '';
  let quote = false;
  let escaped = false;
  for (let index = 0; index < source.length; index++) {
    const current = source[index];
    const next = source[index + 1];
    if (quote) {
      output += current;
      if (escaped) escaped = false;
      else if (current === '\\') escaped = true;
      else if (current === '"') quote = false;
      continue;
    }
    if (current === '"') {
      quote = true;
      output += current;
      continue;
    }
    if (current === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index++;
      output += '\n';
      continue;
    }
    if (current === '/' && next === '*') {
      index += 2;
      while (index < source.length - 1 && !(source[index] === '*' && source[index + 1] === '/')) index++;
      index++;
      continue;
    }
    output += current;
  }
  return output.replace(/,\s*([}\]])/g, '$1');
}

function parseText(text, label) {
  try {
    return JSON.parse(stripJsonc(String(text).replace(/^\uFEFF/, '')));
  } catch (error) {
    throw new Error(label + ': invalid JSON/JSONC: ' + error.message);
  }
}

function parseEntry(entry, label) {
  return parseText(entry.getData().toString('utf8'), label || entry.entryName);
}

function findEntry(entries, suffix) {
  const needle = String(suffix).replace(/\\/g, '/').toLowerCase();
  return entries.find(function (entry) {
    const name = entry.entryName.replace(/\\/g, '/').toLowerCase();
    return name === needle || name.endsWith('/' + needle);
  });
}

function requireEntry(entries, suffix, label) {
  const entry = findEntry(entries, suffix);
  if (!entry) throw new Error(label + ': missing ' + suffix);
  return entry;
}

function readObject(entries, suffix, label) {
  return parseEntry(requireEntry(entries, suffix, label), label);
}

function validateManifest(entries, mod) {
  const manifests = entries.filter(function (entry) { return /(^|\/)manifest\.json$/i.test(entry.entryName); });
  for (const entry of manifests) {
    const manifest = parseEntry(entry, entry.entryName);
    if (manifest.UniqueID !== mod.uniqueId) continue;
    if (String(manifest.Version) !== mod.version) {
      throw new Error(mod.name + ': version ' + manifest.Version + ', expected ' + mod.version);
    }
    const normalized = entry.entryName.replace(/\\/g, '/');
    return { manifest: manifest, root: normalized.replace(/\/manifest\.json$/i, '') };
  }
  throw new Error(mod.name + ': manifest ' + mod.uniqueId + ' missing');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function equal(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sorted(values) {
  return Array.from(values).sort();
}

function valuesOf(row) {
  return String(row && row.AllowValues || '').split(',').map(function (value) { return value.trim(); }).filter(Boolean);
}

function schemaStats(content) {
  const schema = content.ConfigSchema || {};
  return {
    schema: schema,
    options: Object.keys(schema).length,
    values: Object.values(schema).reduce(function (count, row) { return count + valuesOf(row).length; }, 0)
  };
}

function assertSchema(content, expectedNames, expectedValues, label) {
  const stats = schemaStats(content);
  if (!equal(sorted(Object.keys(stats.schema)), sorted(expectedNames))) {
    throw new Error(label + ': ConfigSchema names changed');
  }
  if (stats.values !== expectedValues) {
    throw new Error(label + ': AllowValues ' + stats.values + '/' + expectedValues);
  }
  return stats;
}

function assertSchemaCovered(schema, specification, label) {
  for (const name of Object.keys(schema)) {
    const row = specification[name];
    if (!row) throw new Error(label + ': missing config localization for ' + name);
    const missing = valuesOf(schema[name]).filter(function (value) { return !row.values || !row.values[value]; });
    if (missing.length) throw new Error(label + ': missing value labels for ' + name + ': ' + missing.join('|'));
  }
}

function buildConfigI18n(specification) {
  const defaultText = {};
  const russianText = {};
  for (const name of Object.keys(specification)) {
    const row = specification[name];
    defaultText['config.' + name + '.name'] = row.name[0];
    russianText['config.' + name + '.name'] = row.name[1];
    defaultText['config.' + name + '.description'] = row.description[0];
    russianText['config.' + name + '.description'] = row.description[1];
    for (const value of Object.keys(row.values || {})) {
      defaultText['config.' + name + '.values.' + value] = row.values[value][0];
      russianText['config.' + name + '.values.' + value] = row.values[value][1];
    }
  }
  return { defaultText: defaultText, russianText: russianText };
}

function keyParity(source, translated, label) {
  const missing = Object.keys(source).filter(function (key) { return !(key in translated); });
  const extra = Object.keys(translated).filter(function (key) { return !(key in source); });
  if (missing.length || extra.length) {
    throw new Error(label + ': missing ' + missing.length + ', extra ' + extra.length);
  }
}

function assertNoVisibleLatin(object, label) {
  const bad = Object.entries(object).filter(function (row) {
    const value = String(row[1]).replace(/\{\{[^}]+\}\}/g, '');
    return /[A-Za-z]{2,}/.test(value);
  });
  if (bad.length) {
    throw new Error(label + ': visible Latin ' + bad.slice(0, 8).map(function (row) { return row[0]; }).join('|'));
  }
}

function assertNonEmpty(object, label) {
  const empty = Object.entries(object).filter(function (row) { return !String(row[1]).trim(); });
  if (empty.length) throw new Error(label + ': empty values ' + empty.slice(0, 6).map(function (row) { return row[0]; }).join('|'));
}

function jsonBuffer(value) {
  const text = JSON.stringify(value, null, 2) + '\n';
  parseText(text, 'generated JSON');
  return Buffer.from(text, 'utf8');
}

function outputPath(root, suffix) {
  return 'Mods/' + root + '/' + suffix;
}

function addI18nPair(zip, root, pair, label) {
  keyParity(pair.defaultText, pair.russianText, label);
  assertNonEmpty(pair.defaultText, label + ' default');
  assertNonEmpty(pair.russianText, label + ' RU');
  assertNoVisibleLatin(pair.russianText, label + ' RU');
  zip.addFile(outputPath(root, 'i18n/default.json'), jsonBuffer(pair.defaultText));
  zip.addFile(outputPath(root, 'i18n/ru.json'), jsonBuffer(pair.russianText));
}

function hasRussianI18n(entries) {
  return entries.some(function (entry) { return /\/i18n\/ru\.json$/i.test('/' + entry.entryName.replace(/\\/g, '/')); });
}

function countRawVisibleFields(value) {
  const playerFields = new Set(['displayname', 'shopdescription', 'shopmissingbuildingdescription', 'question', 'message', 'title', 'text']);
  let count = 0;
  function visit(node) {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (playerFields.has(key.toLowerCase()) && typeof child === 'string' && !/^\{\{i18n:[^}]+\}\}$/.test(child)) count++;
      visit(child);
    }
  }
  visit(value);
  return count;
}

function hideGuardianVisibleFields(value) {
  const visible = new Set(['DisplayName', 'ShopDescription', 'ShopMissingBuildingDescription']);
  const output = clone(value);
  function visit(node) {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const key of Object.keys(node)) {
      if (visible.has(key)) node[key] = '__VISIBLE__';
      else visit(node[key]);
    }
  }
  visit(output);
  return output;
}

function patchGuardianFile(source, id, englishName) {
  const output = clone(source);
  const changes = output.Changes;
  if (!Array.isArray(changes) || !changes[0] || !changes[0].Entries || !changes[0].Entries[id]) {
    throw new Error('Livestock Guardian Dogs: missing animal entry ' + id);
  }
  const animal = changes[0].Entries[id];
  if (animal.DisplayName !== englishName) throw new Error('Livestock Guardian Dogs: DisplayName changed for ' + id);
  if (animal.ShopDescription !== 'A dog with a job who protects livestock and sniffs up truffles.') {
    throw new Error('Livestock Guardian Dogs: ShopDescription changed for ' + id);
  }
  if (animal.ShopMissingBuildingDescription !== 'Requires construction of a Big Barn.') {
    throw new Error('Livestock Guardian Dogs: building description changed for ' + id);
  }
  animal.DisplayName = '{{i18n:animal.' + id + '.name}}';
  animal.ShopDescription = '{{i18n:animal.common.description}}';
  animal.ShopMissingBuildingDescription = '{{i18n:animal.common.missing-building}}';
  if (!equal(hideGuardianVisibleFields(source), hideGuardianVisibleFields(output))) {
    throw new Error('Livestock Guardian Dogs: technical fields changed for ' + id);
  }
  return output;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const key = process.env.NEXUS_API_KEY;
    if (!key) throw new Error('NEXUS_API_KEY missing');

    const downloaded = await Promise.all(MODS.map(async function (mod) {
      return [mod.key, archiveEntries(await downloadArchive(mod, key))];
    }));
    const sources = Object.fromEntries(downloaded);
    const manifests = {};
    for (const mod of MODS) {
      manifests[mod.key] = validateManifest(sources[mod.key], mod);
      if (hasRussianI18n(sources[mod.key])) throw new Error(mod.name + ': unexpected built-in RU changed');
    }

    const emRandomContent = readObject(sources.emRandom, 'content.json', "Em's SVE Animals random content");
    const emConfigContent = readObject(sources.emConfig, 'content.json', "Em's SVE Animals config content");
    const emRandom = assertSchema(emRandomContent, ['Honey Jar', 'Honey', 'Wool and Yarn color', 'Wool and Yarn', 'Goose Egg', 'Goose Mayo'], 16, "Em's SVE Animals random");
    const emConfig = assertSchema(emConfigContent, ['Bear', 'Honey Jar', 'Honey', 'Camel', 'Wool and Yarn', 'Goose', 'Goose Egg', 'Goose Mayo'], 26, "Em's SVE Animals config");
    assertSchemaCovered(emRandom.schema, EM_CONFIG, "Em's SVE Animals random");
    assertSchemaCovered(emConfig.schema, EM_CONFIG, "Em's SVE Animals config");

    const hxwContent = readObject(sources.hxw, 'content.json', 'HxW Tilesheets content');
    const ichorContent = readObject(sources.ichor, 'content.json', "Ichor's Cat content");
    const lumiOutdoorContent = readObject(sources.lumiOutdoor, 'content.json', 'Lumisteria Outdoor content');
    if (schemaStats(hxwContent).options || countRawVisibleFields(hxwContent)) throw new Error('HxW Tilesheets: active user-facing text changed');
    if (schemaStats(ichorContent).options || countRawVisibleFields(ichorContent)) throw new Error("Ichor's Cat: active user-facing text changed");
    if (schemaStats(lumiOutdoorContent).options || countRawVisibleFields(lumiOutdoorContent)) throw new Error('Lumisteria Outdoor: active user-facing text changed');

    const sheltieContent = readObject(sources.sheltie, 'content.json', 'Sheltie content');
    const sheltie = assertSchema(sheltieContent, ['dogReplaced', 'sheltieColor'], 8, 'Sheltie');
    assertSchemaCovered(sheltie.schema, SHELTIE_CONFIG, 'Sheltie');
    if (countRawVisibleFields(sheltieContent)) throw new Error('Sheltie: unexpected raw visible fields');

    const largeContent = readObject(sources.largeQuail, 'content.json', 'Large Quail content');
    const largeSchema = assertSchema(largeContent, ['EnableLQM', 'LQMTexture', 'LQMLabel', 'EnableLQMCover', 'LQMCoverColour', 'LQMCopyQuality'], 17, 'Large Quail');
    const largeDefault = readObject(sources.largeQuail, 'i18n/default.json', 'Large Quail default i18n');
    if (Object.keys(largeDefault).length !== 27) throw new Error('Large Quail: default keys ' + Object.keys(largeDefault).length + '/27');
    keyParity(largeDefault, LARGE_QUAIL_RU, 'Large Quail');
    assertNonEmpty(LARGE_QUAIL_RU, 'Large Quail RU');
    assertNoVisibleLatin(LARGE_QUAIL_RU, 'Large Quail RU');
    const artisanGoods = readObject(sources.largeQuail, 'Data/ArtisanGoods.json', 'Large Quail artisan goods');
    const artisanEntry = artisanGoods.Changes && artisanGoods.Changes[0] && artisanGoods.Changes[0].Entries && artisanGoods.Changes[0].Entries['ZoeyHoshi.LargeQuailMayonnaise'];
    if (!artisanEntry || artisanEntry.Displayname !== '{{i18n:LargeQuailMayonnaise_name}}' || artisanEntry.Description !== '{{i18n:LargeQuailMayonnaise_description}}') {
      throw new Error('Large Quail: item i18n anchors changed');
    }

    const guardianContent = readObject(sources.guardianDogs, 'content.json', 'Guardian Dogs content');
    const guardian = assertSchema(guardianContent, Object.keys(GUARDIAN_CONFIG), 28, 'Guardian Dogs');
    assertSchemaCovered(guardian.schema, GUARDIAN_CONFIG, 'Guardian Dogs');

    const luanContent = readObject(sources.luan, 'content.json', 'Luan content');
    const luan = assertSchema(luanContent, ['Choose Recolor Manually'], 5, 'Luan');
    assertSchemaCovered(luan.schema, LUAN_CONFIG, 'Luan');

    const lumiIndoorContent = readObject(sources.lumiIndoor, 'content.json', 'Lumisteria Indoor content');
    const lumiIndoor = assertSchema(lumiIndoorContent, ['InteriorOption'], 5, 'Lumisteria Indoor');
    assertSchemaCovered(lumiIndoor.schema, LUMI_INDOOR_CONFIG, 'Lumisteria Indoor');

    const zip = new AdmZip();
    const emPair = buildConfigI18n(EM_CONFIG);
    if (Object.keys(emPair.defaultText).length !== 50) throw new Error("Em's SVE Animals: i18n keys changed");
    addI18nPair(zip, manifests.emConfig.root, emPair, "Em's SVE Animals");

    const sheltiePair = buildConfigI18n(SHELTIE_CONFIG);
    if (Object.keys(sheltiePair.defaultText).length !== 12) throw new Error('Sheltie: i18n keys changed');
    addI18nPair(zip, manifests.sheltie.root, sheltiePair, 'Sheltie');

    zip.addFile(outputPath(manifests.largeQuail.root, 'i18n/ru.json'), jsonBuffer(LARGE_QUAIL_RU));

    const guardianPair = buildConfigI18n(GUARDIAN_CONFIG);
    for (const row of GUARDIAN_ANIMALS) {
      guardianPair.defaultText['animal.' + row[1] + '.name'] = row[2];
      guardianPair.russianText['animal.' + row[1] + '.name'] = row[3];
    }
    guardianPair.defaultText['animal.common.description'] = 'A dog with a job who protects livestock and sniffs up truffles.';
    guardianPair.russianText['animal.common.description'] = 'Рабочая собака, которая охраняет скот и вынюхивает трюфели.';
    guardianPair.defaultText['animal.common.missing-building'] = 'Requires construction of a Big Barn.';
    guardianPair.russianText['animal.common.missing-building'] = 'Требуется большой хлев.';
    if (Object.keys(guardianPair.defaultText).length !== 72) throw new Error('Guardian Dogs: i18n keys changed');
    addI18nPair(zip, manifests.guardianDogs.root, guardianPair, 'Guardian Dogs');

    let guardianDisplayNames = 0;
    let guardianShopStrings = 0;
    for (const row of GUARDIAN_ANIMALS) {
      const source = readObject(sources.guardianDogs, row[0], 'Guardian Dogs ' + row[0]);
      const patched = patchGuardianFile(source, row[1], row[2]);
      zip.addFile(outputPath(manifests.guardianDogs.root, row[0]), jsonBuffer(patched));
      guardianDisplayNames++;
      guardianShopStrings += 2;
    }

    const luanPair = buildConfigI18n(LUAN_CONFIG);
    if (Object.keys(luanPair.defaultText).length !== 7) throw new Error('Luan: i18n keys changed');
    addI18nPair(zip, manifests.luan.root, luanPair, 'Luan');

    const lumiIndoorPair = buildConfigI18n(LUMI_INDOOR_CONFIG);
    if (Object.keys(lumiIndoorPair.defaultText).length !== 7) throw new Error('Lumisteria Indoor: i18n keys changed');
    addI18nPair(zip, manifests.lumiIndoor.root, lumiIndoorPair, 'Lumisteria Indoor');

    const outputFiles = zip.getEntries().filter(function (entry) { return !entry.isDirectory; });
    if (outputFiles.length !== 25) throw new Error('Stage 63 output files ' + outputFiles.length + '/25');
    const output = zip.toBuffer();

    const status = {
      ok: true,
      complete: true,
      stage: 63,
      mods: 9,
      files: outputFiles.length,
      zipBytes: output.length,
      verified: [
        {
          name: "Em's SVE Animals",
          version: '1.2.0',
          sourceFileIds: [173371, 173372],
          auditedVariants: 2,
          randomVariantConfigOptions: emRandom.options,
          randomVariantAllowValues: emRandom.values,
          fixedVariantConfigOptions: emConfig.options,
          fixedVariantAllowValues: emConfig.values,
          ruKeys: Object.keys(emPair.russianText).length,
          missing: 0,
          extra: 0,
          internalConfigKeysChanged: 0,
          internalAllowValuesChanged: 0,
          remainingVisibleLatin: 0
        },
        {
          name: 'HxW Tilesheets',
          version: '2.0.0',
          sourceFileId: 137494,
          localizationNeeded: false,
          activeUserFacingTextFiles: 0
        },
        {
          name: "Ichor's Cat",
          version: '1.2.0',
          sourceFileId: 110717,
          localizationNeeded: false,
          activeUserFacingTextFiles: 0
        },
        {
          name: "Izabelleanne's Sheltie Collie dog",
          version: '1.1.0',
          sourceFileId: 124310,
          configOptions: sheltie.options,
          allowValues: sheltie.values,
          ruKeys: Object.keys(sheltiePair.russianText).length,
          internalConfigKeysChanged: 0,
          internalAllowValuesChanged: 0,
          remainingVisibleLatin: 0
        },
        {
          name: 'Large Quail Mayonnaise',
          version: '1.1.0',
          sourceFileId: 141016,
          sourceKeys: Object.keys(largeDefault).length,
          ruKeys: Object.keys(LARGE_QUAIL_RU).length,
          configOptions: largeSchema.options,
          allowValues: largeSchema.values,
          missing: 0,
          extra: 0,
          remainingVisibleLatin: 0
        },
        {
          name: 'Livestock Guardian Dogs',
          version: '2.0.0',
          sourceFileId: 137191,
          configOptions: guardian.options,
          allowValues: guardian.values,
          ruKeys: Object.keys(guardianPair.russianText).length,
          localizedAnimalFiles: GUARDIAN_ANIMALS.length,
          displayNamesTranslated: guardianDisplayNames,
          shopStringsTranslated: guardianShopStrings,
          technicalAnimalFieldsChanged: 0,
          internalConfigKeysChanged: 0,
          internalAllowValuesChanged: 0,
          remainingVisibleLatin: 0
        },
        {
          name: 'Luan Indoor Tilesheets',
          version: '2.8.1',
          sourceFileId: 171068,
          configOptions: luan.options,
          allowValues: luan.values,
          ruKeys: Object.keys(luanPair.russianText).length,
          internalConfigKeysChanged: 0,
          internalAllowValuesChanged: 0,
          remainingVisibleLatin: 0
        },
        {
          name: 'Lumisteria Tilesheets - Indoor',
          version: '1.4.0',
          sourceFileId: 83792,
          configOptions: lumiIndoor.options,
          allowValues: lumiIndoor.values,
          ruKeys: Object.keys(lumiIndoorPair.russianText).length,
          internalConfigKeysChanged: 0,
          internalAllowValuesChanged: 0,
          remainingVisibleLatin: 0
        },
        {
          name: 'Lumisteria Tilesheets - Outdoor',
          version: '1.4.0',
          sourceFileId: 83413,
          localizationNeeded: false,
          activeUserFacingTextFiles: 0
        }
      ]
    };

    if (String(req.query.status || '') === '1') return res.status(200).json(status);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="RU_STAGE63_INSTALLED_CONTENT_PACKS_VERIFIED.zip"');
    return res.status(200).send(output);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      complete: false,
      stage: 63,
      error: String(error && error.message || error)
    });
  }
};

const AdmZip = require('adm-zip');
const fs = require('fs');
const { createExtractorFromData } = require('node-unrar-js');

const MODS = {
  alpacas: { name: 'Alpacas', modId: 8515, fileId: 152535, version: '2.3.0', manifestVersion: '2.3' },
  alpacasRu: { name: 'Alpacas Russian translation', modId: 33513, fileId: 130870, version: '1.0' },
  alvadea: { name: "Alvadea's Tilesheets", modId: 13743, fileId: 107918, version: '2.2.1' },
  atoms: { name: 'AToMS', modId: 28480, fileId: 149187, version: '2.4.2' },
  bean: { name: "Bean's Pet Overhaul", modId: 21080, fileId: 171811, version: '2.1.0' },
  cold: { name: 'Cold Pets (Hats Away)', modId: 14379, fileId: 87725, version: '1.1.1' },
  custom: { name: 'Custom Companions', modId: 8626, fileId: 150992, version: '5.1.0' }
};

async function nexusJson(url, key) {
  const r = await fetch(url, { headers: { apikey: key, 'User-Agent': 'nexus-loader-stage60/2.0' } });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Nexus API ${r.status}`);
  return data;
}

async function downloadArchive(mod, key) {
  const links = await nexusJson(`https://api.nexusmods.com/v1/games/stardewvalley/mods/${mod.modId}/files/${mod.fileId}/download_link.json`, key);
  const mirror = Array.isArray(links) && links.find(x => x && (x.URI || x.uri));
  if (!mirror) throw new Error(`${mod.name}: no Nexus mirror`);
  const r = await fetch(mirror.URI || mirror.uri, { redirect: 'follow', headers: { 'User-Agent': 'nexus-loader-stage60/2.0' } });
  if (!r.ok) throw new Error(`${mod.name}: archive download ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

function zipEntries(buffer) {
  return new AdmZip(buffer).getEntries().filter(e => !e.isDirectory);
}

async function rarEntries(buffer) {
  const wasm = fs.readFileSync(require.resolve('node-unrar-js/esm/js/unrar.wasm'));
  const wasmBinary = wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength);
  const extractor = await createExtractorFromData({ data: Uint8Array.from(buffer).buffer, wasmBinary });
  const extracted = extractor.extract();
  return extracted.files.filter(x => !(x.fileHeader && x.fileHeader.flags && x.fileHeader.flags.directory) && x.extraction).map(x => ({
    entryName: String(x.fileHeader.name || '').replace(/\\\\/g, '/'),
    getData: () => Buffer.from(x.extraction)
  }));
}

function stripJsonc(source) {
  let out = '', quote = false, escaped = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (quote) {
      out += c;
      if (escaped) escaped = false;
      else if (c === '\\\\') escaped = true;
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

function findEntry(entries, suffix) {
  const normalized = suffix.toLowerCase();
  return entries.find(e => !/^__macosx\//i.test(e.entryName) && e.entryName.replace(/\\\\/g, '/').toLowerCase().endsWith(normalized));
}

function requireEntry(entries, suffix, label) {
  const entry = findEntry(entries, suffix);
  if (!entry) throw new Error(`${label}: missing ${suffix}`);
  return entry;
}

function rootOf(entry, suffix) {
  return entry.entryName.replace(/\\\\/g, '/').slice(0, -suffix.length).replace(/\/$/, '');
}

function valuesOf(schemaRow) {
  return String(schemaRow.AllowValues || '').split(',').map(x => x.trim()).filter(Boolean);
}

function equal(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function keyParity(a, b, label) {
  const ak = Object.keys(a), bk = Object.keys(b);
  const missing = ak.filter(k => !(k in b));
  const extra = bk.filter(k => !(k in a));
  if (missing.length || extra.length) throw new Error(`${label}: missing ${missing.length}, extra ${extra.length}`);
  return { missing: 0, extra: 0 };
}

function visibleLatin(value) {
  const scrubbed = String(value)
    .replace(/%item[\s\S]*?%%/g, '')
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/\$\{[^}]+\}/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\$[A-Za-z0-9]+/g, '')
    .replace(/@[A-Za-z0-9_.-]*/g, '');
  return /[A-Za-z]{2,}/.test(scrubbed);
}

function assertNoVisibleLatin(object, label) {
  const bad = Object.entries(object).filter(([, value]) => visibleLatin(value));
  if (bad.length) throw new Error(`${label}: visible Latin in ${bad.slice(0, 4).map(([k]) => k).join('|')}`);
}

function manifestVersion(entries, expected, label) {
  const entry = requireEntry(entries, '/manifest.json', label);
  const manifest = parseEntry(entry);
  if (String(manifest.Version) !== String(expected)) throw new Error(`${label}: manifest ${manifest.Version}, expected ${expected}`);
  return manifest;
}

function tokens(value) {
  return String(value).match(/%item[\s\S]*?%%|\[#\]|\$[A-Za-z0-9]+|[@^#]/g) || [];
}

const ALPACA_DELTA = {
  AlpacaLetter: 'Дорогой @,^Ты уже доказал, что умеешь ухаживать за коровами, поэтому теперь я продаю овец и альпак в своём магазине!       ^   — Марни[#]Овцы и альпаки в продаже!',
  EvelynAlpacaLetter: 'Здравствуйте, дорогой!  Надеюсь, у тебя и животных всё хорошо.^ Я слышала, что теперь ты держишь альпак, и подумала: не найдётся ли для меня немного пряжи? ^   — Эвелин %item quest 5787484674676466767684678 %%[#]Пряжа для Эвелин',
  EvelynAlpacaRewardLetter: 'Дорогой @,^Посылаю тебе небольшой подарок в благодарность за альпачью пряжу... Надеюсь, он согреет тебя в холодные месяцы.  ^   — Эвелин  %item id birdb.CP.Alpaca_AlpacaHat 1 %%[#]Подарок от Эвелин',
  'EvelynAlpaca.Request01': 'Просьба Эвелин о пряже',
  'EvelynAlpaca.Request02': 'Эвелин написала тебе и попросила принести несколько клубков пряжи.',
  'EvelynAlpaca.Request03': 'Принесите Эвелин 3 клубка альпачьей пряжи.',
  'EvelynAlpaca.Request04': 'Боже мой, ты принёс пряжу, о которой я просила!$h#$b#Какая качественная шерсть, спасибо, дорогой!',
  EmilyAlpacaLetter: 'Привет!^Как поживаешь? Мне снова не терпится заняться ткачеством. Не принесёшь ли мне немного пряжи?^   — Эмили %item quest 575767676766867465664933003578 %%[#]Пряжа для Эмили',
  EmilyAlpacaRewardLetter: 'Привет, @!^^Ещё раз спасибо за превосходную пряжу.^Один мой друг научил меня ткать такую особую шапку. Надеюсь, она тебе понравится!^^— Эмили  %item id birdb.CP.Alpaca_ChulloHat 1 %%[#]Подарок от Эмили',
  'EmilyAlpaca.Request01': 'Ткацкий проект Эмили',
  'EmilyAlpaca.Request02': 'Эмили написала тебе и попросила принести альпачью пряжу.',
  'EmilyAlpaca.Request03': 'Принесите Эмили 3 клубка альпачьей пряжи.',
  'EmilyAlpaca.Request04': 'О, отлично, ты принёс пряжу!$h#$b#Сначала я её покрашу, а потом приступлю. Большое спасибо!',
  AlpacaHat: 'Вязаная альпачья шапка',
  AlpacaHatDescription: 'Связана Эвелин с любовью. Мягкая и тёплая!',
  ChulloHat: 'Шапка-чульо',
  ChulloHatDescription: 'Традиционная андская шапка — подарок Эмили.',
  AcceptGiftAlpacaYarnEmily: 'Ух ты, идеальный подарок для такой любительницы вязания, как я!$0#$b# Ты сделала мой день, огромное спасибо! $1',
  AcceptGiftAlpacaYarnEvelyn: 'Боже мой! Как мило с твоей стороны...$0#$b#Это идеальный подарок для такой старой вязальщицы, как я. Спасибо, дорогой.$1'
};

const ATOMS_NAMES = {
  Allow_Recolors: 'Поддержка перекрасок', Manual_Override: 'Ручной выбор', Blue_Grass: 'Синяя трава',
  Earthy_Recolour: 'Землистая перекраска', Starblue_Valley: 'Звёздно-синяя долина',
  Starblue_Valley_Grass: 'Весенняя трава звёздно-синей долины', Vibrant_Pastoral: 'Яркая пастораль',
  Vibrant_Pastoral_Fall: 'Осенняя листва яркой пасторали', Wittily_Named: 'Остроумно названная перекраска',
  Wittily_Named_Dirt: 'Почва остроумно названной перекраски', Aimon_Witchy: 'Ведьмовская перекраска Аймона',
  AW_Grass_Spring: 'Ведьмовская трава весной', AW_Dirt_Spring: 'Ведьмовская почва весной',
  AW_Grass_Summer: 'Ведьмовская трава летом', AW_Dirt_Summer: 'Ведьмовская почва летом',
  AW_Grass_Fall: 'Ведьмовская трава осенью', AW_Dirt_Fall: 'Ведьмовская почва осенью',
  Cotton_Candy: 'Перекраска «Сахарная вата»', CC_Grass_Spring: 'Трава «Сахарная вата» весной',
  CC_Dirt_Spring: 'Почва «Сахарная вата» весной', CC_Grass_Summer: 'Трава «Сахарная вата» летом',
  CC_Dirt_Summer: 'Почва «Сахарная вата» летом', CC_Grass_Fall: 'Трава «Сахарная вата» осенью',
  CC_Dirt_Fall: 'Почва «Сахарная вата» осенью', CC_Snow_Color: 'Цвет снега «Сахарная вата»',
  Universal_Recolors: 'Универсальные перекраски', UR_Desaturation: 'Обесцвечивание универсальной перекраски',
  UR_Hue: 'Сдвиг оттенка универсальной перекраски', Yri_Retro: 'Ретро-перекраска Ири',
  YR_Grass_Spring: 'Трава Ири весной', YR_Dirt_Spring: 'Почва Ири весной', YR_Foliage_Spring: 'Листва Ири весной',
  YR_Grass_Summer: 'Трава Ири летом', YR_Dirt_Summer: 'Почва Ири летом', YR_Foliage_Summer: 'Листва Ири летом',
  YR_Grass_Fall: 'Трава Ири осенью', YR_Dirt_Fall: 'Почва Ири осенью', YR_Foliage_Fall: 'Листва Ири осенью',
  YR_Foliage_Winter: 'Листва Ири зимой', Mild_Winter: 'Мягкая зима',
  Cave_Fol_Color: 'Цвет пещерной растительности', Alt_In_Grass: 'Особая пещерная трава'
};

const ATOMS_DESCRIPTIONS = {
  Allow_Recolors: 'Разрешает листам тайлов менять цвета под выбранную перекраску. Если отключено, всегда используются стандартные цвета игры независимо от автоматического или ручного выбора.',
  Manual_Override: 'Отключает автоматическое определение перекрасок и позволяет вручную выбрать одну из списка ниже.',
  Blue_Grass: 'Принудительно использует цвета, совместимые с синей травой.',
  Earthy_Recolour: 'Принудительно использует цвета, совместимые с землистой перекраской.',
  Starblue_Valley: 'Принудительно использует цвета, совместимые со звёздно-синей долиной.',
  Starblue_Valley_Grass: 'Выберите цвет весенней травы звёздно-синей долины.',
  Vibrant_Pastoral: 'Принудительно использует цвета, совместимые с яркой пасторалью.',
  Vibrant_Pastoral_Fall: 'Выберите цвет осенней листвы яркой пасторали.',
  Wittily_Named: 'Принудительно использует цвета, совместимые с остроумно названной перекраской.',
  Wittily_Named_Dirt: 'Выберите цвет почвы остроумно названной перекраски.',
  Aimon_Witchy: 'Принудительно использует цвета, совместимые с ведьмовской перекраской Аймона.',
  Cotton_Candy: 'Принудительно использует цвета, совместимые с перекраской «Сахарная вата».',
  Universal_Recolors: 'Принудительно использует цвета, совместимые с универсальными перекрасками.',
  UR_Desaturation: 'Выберите степень обесцвечивания цветов.',
  UR_Hue: 'Выберите интенсивность сдвига оттенка.',
  Yri_Retro: 'Принудительно использует цвета, совместимые с ретро-перекраской Ири.',
  Mild_Winter: 'Принудительно использует тайлы мягкой зимы. Зимой этот вариант имеет приоритет над любой ранее выбранной перекраской независимо от автоматического или ручного выбора.',
  Cave_Fol_Color: 'Делает всю незамёрзшую пещерную растительность зелёной, а лианы — более яркими.',
  Alt_In_Grass: 'Для совместимых модов, например ферм с лесом и водопадами, окрашивает растущую в пещерах траву в особый цвет.'
};

const ATOMS_SECTIONS = {
  Selection_Step_01: 'Поддержка перекрасок:', Selection_Step_02: 'При желании отключите автовыбор:',
  Selection_Step_03: 'Затем выберите одну перекраску вручную:', Selection_Step_04: 'Или настройте более сложные перекраски:',
  Selection_Step_05: 'Дополнительные параметры:'
};

function seasonalDescription(code) {
  const season = code.endsWith('_Spring') ? 'весной' : code.endsWith('_Summer') ? 'летом' : code.endsWith('_Fall') ? 'осенью' : 'зимой';
  if (code.includes('_Grass_')) return `Выберите цвет травы ${season}.`;
  if (code.includes('_Dirt_')) return `Выберите цвет почвы ${season}.`;
  if (code.includes('_Foliage_')) return `Выберите цвет листвы ${season}.`;
  if (code === 'CC_Snow_Color') return 'Выберите цвет снега зимой.';
  return null;
}

const SIMPLE_VALUES = {
  True: 'Да', False: 'Нет', none: 'Без перекраски', None: 'Без перекраски', Default: 'Стандартная листва',
  Green: 'Зелёный', Blue: 'Синий', Red: 'Красный', Brown: 'Коричневый', Purple: 'Фиолетовый',
  Dark: 'Тёмная', Light: 'Светлая', Medium: 'Немного более тёмная', Mint: 'Мятный', Pink: 'Розовый',
  Peach: 'Персиковый', D0: 'Нет (пока недоступно)', D30: '30% (пока недоступно)', D40: '40%',
  D50: '50% (пока недоступно)', H0: 'Нет (пока недоступно)', H1: 'Небольшой', H2: 'Значительный (пока недоступно)',
  MixedGreen: 'Смешанная зелёная', NaturalGreen: 'Натуральная зелёная', Orange: 'Оранжевая', Black: 'Чёрная',
  Cream: 'Кремовая', GreyBrown: 'Серо-коричневая', LightBrown: 'Светло-коричневая', Mocha: 'Мокко', Rose: 'Розовая',
  Standard: 'Стандартная', Beige: 'Бежевая', Blue_Alt: 'Синяя (вариант)', Cherry: 'Вишнёвая',
  CherryRose: 'Вишнёво-розовая', DarkBlue: 'Тёмно-синяя', DarkGreen: 'Тёмно-зелёная', Lavender: 'Лавандовая',
  LightBlue: 'Голубая', LightGreen: 'Светло-зелёная', PastelGreen: 'Пастельно-зелёная', PastelRose: 'Пастельно-розовая',
  Purple_Alt: 'Фиолетовая (вариант)', Red_Alt: 'Красная (вариант)', Turquoise: 'Бирюзовая', White: 'Белая',
  Winter: 'Зимняя', Yellow: 'Жёлтая'
};

function atomsValue(code, value) {
  if (value === 'True' || value === 'False') return SIMPLE_VALUES[value];
  if (value === 'Green' && code.includes('Grass')) return 'Зелёная трава';
  if (value === 'Green' && code.includes('Dirt')) return 'Зелёная почва';
  if (value === 'Green' && (code.includes('Foliage') || code === 'Vibrant_Pastoral_Fall' || code === 'Cave_Fol_Color')) return 'Зелёная листва';
  if (value === 'Blue' && (code.includes('Grass') || code === 'Starblue_Valley_Grass')) return 'Синяя трава';
  if (value === 'Red' && code.includes('Fall')) return 'Красная листва';
  if (value === 'Brown' && code.includes('Grass')) return 'Коричневая трава';
  if (value === 'Brown' && code.includes('Dirt')) return 'Коричневая почва';
  if (value === 'Purple' && code.includes('Grass')) return 'Фиолетовая трава';
  if (value === 'Purple' && code.includes('Dirt')) return 'Фиолетовая почва';
  if (value === 'Light' && code.includes('Dirt')) return 'Светлая почва';
  if (value === 'Medium' && code.includes('Dirt')) return 'Немного более тёмная почва';
  if (value === 'Dark' && code.includes('Dirt')) return 'Тёмная почва';
  if (value === 'Mint' && code.includes('Grass')) return 'Мятная трава';
  if (value === 'Pink' && code.includes('Grass')) return 'Розовая трава';
  if (value === 'Peach' && code.includes('Grass')) return 'Персиковая трава';
  if (value === 'Purple' && code.includes('Snow')) return 'Фиолетовый снег';
  if (value === 'Blue' && code.includes('Snow')) return 'Голубой снег';
  if (!(value in SIMPLE_VALUES)) throw new Error(`AToMS: no RU value for ${code}.${value}`);
  return SIMPLE_VALUES[value];
}

function englishValue(value) {
  if (value === 'True') return 'Yes';
  if (value === 'False') return 'No';
  return value.replace(/_/g, ' ');
}

function buildAtoms(sourceDefault, schema) {
  const en = { ...sourceDefault };
  for (const [code, row] of Object.entries(schema)) {
    for (const value of valuesOf(row)) {
      const key = `config.${code}.values.${value}`;
      if (!(key in en)) en[key] = englishValue(value);
    }
  }
  const ru = {};
  for (const key of Object.keys(en)) {
    let match = key.match(/^config\.section\.([^.]+)\.name$/);
    if (match) {
      if (!ATOMS_SECTIONS[match[1]]) throw new Error(`AToMS: no section translation for ${key}`);
      ru[key] = ATOMS_SECTIONS[match[1]];
      continue;
    }
    match = key.match(/^config\.([^.]+)\.(name|description)$/);
    if (match) {
      const [, code, kind] = match;
      const translated = kind === 'name' ? ATOMS_NAMES[code] : (ATOMS_DESCRIPTIONS[code] || seasonalDescription(code));
      if (!translated) throw new Error(`AToMS: no ${kind} translation for ${code}`);
      ru[key] = translated;
      continue;
    }
    match = key.match(/^config\.([^.]+)\.values\.(.+)$/);
    if (match) {
      ru[key] = atomsValue(match[1], match[2]);
      continue;
    }
    throw new Error(`AToMS: unknown i18n key ${key}`);
  }
  return { en, ru };
}

const BEAN_NAMES = {
  'Brown Bear': 'Коричневый медведь', 'Black Bear': 'Чёрный медведь', 'Panda Bear': 'Панда', 'Polar Bear': 'Белый медведь',
  'Albino Bearded': 'Бородатая агама-альбинос', 'Brown Bearded': 'Коричневая бородатая агама',
  'Orange Bearded': 'Оранжевая бородатая агама', 'Red Bearded': 'Красная бородатая агама',
  'Sand Bearded': 'Песочная бородатая агама', 'Yellow Bearded': 'Жёлтая бородатая агама',
  Borzoi: 'Борзая', Capybara: 'Капибара', 'Sand Fennec': 'Песочный фенек', 'Cream Fennec': 'Кремовый фенек',
  'Brown Ferret': 'Коричневый хорёк', 'Black Ferret': 'Чёрный хорёк', 'Cream Ferret': 'Кремовый хорёк',
  'Gray Ferret': 'Серый хорёк', 'Light Brown Ferret': 'Светло-коричневый хорёк',
  'Red Fox': 'Рыжая лиса', 'Arctic Fox': 'Песец', 'Brown Fox': 'Коричневая лиса', 'Gray Fox': 'Серая лиса', 'Silver Fox': 'Серебристая лиса',
  'Albino Gecko': 'Геккон-альбинос', 'Black Gecko': 'Чёрный геккон', 'Blue Gecko': 'Синий геккон',
  'Brown Gecko': 'Коричневый геккон', 'Lime Gecko': 'Лаймовый геккон', 'Yellow Gecko': 'Жёлтый геккон',
  'Brown Hedgehog': 'Коричневый ёж', 'Black Hedgehog': 'Чёрный ёж', 'Gray Hedgehog': 'Серый ёж',
  'Blue Hedgehog': 'Синий ёж', 'Pinto Hedgehog': 'Пятнистый ёж',
  'Pink Pig': 'Розовый мини-пиг', 'Black Pig': 'Чёрный мини-пиг', 'Brown Pig': 'Коричневый мини-пиг', 'Cream Pig': 'Кремовый мини-пиг',
  'Red Panda': 'Красная панда'
};

const BEAN_SECTIONS = {
  Bears: 'Медведи', 'Bearded Dragons': 'Бородатые агамы', Borzoi: 'Борзая', Capybara: 'Капибара',
  Fennecs: 'Фенеки', Ferrets: 'Хорьки', Foxes: 'Лисы', Geckos: 'Гекконы', Hedgehogs: 'Ежи',
  'Mini Pigs': 'Мини-пиги', 'Red Panda': 'Красная панда'
};

const PET_NAMES = {
  Fox: 'Лиса', 'Fennec Fox': 'Фенек', 'Mini Pig': 'Мини-пиг', Ferret: 'Хорёк', Hedgehog: 'Ёж',
  Capybara: 'Капибара', 'Red Panda': 'Красная панда', 'Bearded Dragon': 'Бородатая агама', Gecko: 'Геккон', Bear: 'Медведь'
};

function buildBean(schema) {
  const en = {}, ru = {}, sections = new Set();
  for (const [code, row] of Object.entries(schema)) {
    if (!equal(valuesOf(row), ['True', 'False'])) throw new Error(`Bean: ${code} AllowValues changed`);
    if (!BEAN_NAMES[code]) throw new Error(`Bean: no RU name for ${code}`);
    en[`config.${code}.name`] = code;
    en[`config.${code}.values.True`] = 'Yes';
    en[`config.${code}.values.False`] = 'No';
    ru[`config.${code}.name`] = BEAN_NAMES[code];
    ru[`config.${code}.values.True`] = 'Да';
    ru[`config.${code}.values.False`] = 'Нет';
    sections.add(String(row.Section));
  }
  for (const section of sections) {
    if (!BEAN_SECTIONS[section]) throw new Error(`Bean: no RU section for ${section}`);
    en[`config.section.${section}.name`] = section;
    ru[`config.section.${section}.name`] = BEAN_SECTIONS[section];
  }
  return { en, ru, sections: [...sections] };
}

function patchDisplayNames(value) {
  let changed = 0;
  function visit(node) {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      if (key === 'DisplayName' && typeof child === 'string') {
        if (!PET_NAMES[child]) throw new Error(`Bean: unknown DisplayName ${child}`);
        node[key] = PET_NAMES[child];
        changed++;
      } else visit(child);
    }
  }
  visit(value);
  return changed;
}

function scrubDisplayNames(value) {
  if (Array.isArray(value)) return value.map(scrubDisplayNames);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) out[key] = key === 'DisplayName' ? '__DISPLAY_NAME__' : scrubDisplayNames(child);
  return out;
}

function jsonBuffer(value) {
  return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const key = process.env.NEXUS_API_KEY;
    if (!key) throw new Error('NEXUS_API_KEY missing');
    const [alpacaBuf, alpacaRuBuf, alvadeaBuf, atomsBuf, beanBuf, coldBuf, customBuf] = await Promise.all([
      downloadArchive(MODS.alpacas, key), downloadArchive(MODS.alpacasRu, key), downloadArchive(MODS.alvadea, key),
      downloadArchive(MODS.atoms, key), downloadArchive(MODS.bean, key), downloadArchive(MODS.cold, key), downloadArchive(MODS.custom, key)
    ]);
    const [alpaca, alpacaReadyRu, alvadea, atoms, bean, cold, custom] = await Promise.all([
      Promise.resolve(zipEntries(alpacaBuf)), rarEntries(alpacaRuBuf), Promise.resolve(zipEntries(alvadeaBuf)),
      Promise.resolve(zipEntries(atomsBuf)), Promise.resolve(zipEntries(beanBuf)), Promise.resolve(zipEntries(coldBuf)), Promise.resolve(zipEntries(customBuf))
    ]);
    const zip = new AdmZip();
    const verified = [];

    manifestVersion(alpaca, MODS.alpacas.manifestVersion, 'Alpacas');
    const alpacaDefaultEntry = requireEntry(alpaca, '/i18n/default.json', 'Alpacas');
    const alpacaDefault = parseEntry(alpacaDefaultEntry);
    const readyRu = parseEntry(requireEntry(alpacaReadyRu, '/i18n/ru.json', 'Alpacas ready RU'));
    if (Object.keys(alpacaDefault).length !== 25 || Object.keys(readyRu).length !== 6) throw new Error(`Alpacas: source/ready keys ${Object.keys(alpacaDefault).length}/${Object.keys(readyRu).length}`);
    for (const [k, v] of Object.entries(readyRu)) if (!(k in alpacaDefault) || v !== readyRu[k]) throw new Error(`Alpacas: invalid ready RU key ${k}`);
    const alpacaRu = { ...readyRu, ...ALPACA_DELTA };
    keyParity(alpacaDefault, alpacaRu, 'Alpacas');
    for (const k of Object.keys(alpacaDefault)) if (!equal(tokens(alpacaDefault[k]), tokens(alpacaRu[k]))) throw new Error(`Alpacas: tokens changed in ${k}`);
    assertNoVisibleLatin(alpacaRu, 'Alpacas');
    const alpacaRoot = rootOf(alpacaDefaultEntry, '/i18n/default.json');
    zip.addFile(`Mods/${alpacaRoot}/i18n/ru.json`, jsonBuffer(alpacaRu));
    verified.push({ name: MODS.alpacas.name, version: MODS.alpacas.version, fileId: MODS.alpacas.fileId, readyRuFileId: MODS.alpacasRu.fileId, sourceKeys: 25, readyRuKeys: 6, translatedDelta: 19, ruKeys: 25, missing: 0, extra: 0, placeholdersChanged: 0, remainingVisibleLatin: 0 });

    manifestVersion(alvadea, MODS.alvadea.version, 'Alvadea');
    const alvadeaContentEntry = requireEntry(alvadea, '/content.json', 'Alvadea');
    const alvadeaContent = parseEntry(alvadeaContentEntry);
    const alvadeaSchema = alvadeaContent.ConfigSchema || {};
    if (!equal(Object.keys(alvadeaSchema), ['VibrantPastoralRecolorFallColor']) || !equal(valuesOf(alvadeaSchema.VibrantPastoralRecolorFallColor), ['Green', 'Orange'])) throw new Error('Alvadea: ConfigSchema changed');
    const alvadeaEn = {
      'config.VibrantPastoralRecolorFallColor.name': 'Vibrant Pastoral Recolor fall color',
      'config.VibrantPastoralRecolorFallColor.values.Green': 'Green',
      'config.VibrantPastoralRecolorFallColor.values.Orange': 'Orange'
    };
    const alvadeaRu = {
      'config.VibrantPastoralRecolorFallColor.name': 'Осенний цвет для яркой пасторальной перекраски',
      'config.VibrantPastoralRecolorFallColor.values.Green': 'Зелёный',
      'config.VibrantPastoralRecolorFallColor.values.Orange': 'Оранжевый'
    };
    keyParity(alvadeaEn, alvadeaRu, 'Alvadea');
    assertNoVisibleLatin(alvadeaRu, 'Alvadea');
    const alvadeaRoot = rootOf(alvadeaContentEntry, '/content.json');
    zip.addFile(`Mods/${alvadeaRoot}/i18n/default.json`, jsonBuffer(alvadeaEn));
    zip.addFile(`Mods/${alvadeaRoot}/i18n/ru.json`, jsonBuffer(alvadeaRu));
    verified.push({ name: MODS.alvadea.name, version: MODS.alvadea.version, fileId: MODS.alvadea.fileId, configOptions: 1, allowValues: 2, ruKeys: 3, missing: 0, extra: 0, internalConfigKeysChanged: 0, internalAllowValuesChanged: 0, remainingVisibleLatin: 0 });

    manifestVersion(atoms, MODS.atoms.version, 'AToMS');
    const atomsContentEntry = requireEntry(atoms, '/content.json', 'AToMS');
    const atomsContent = parseEntry(atomsContentEntry);
    const atomsSchema = atomsContent.ConfigSchema || {};
    const atomsDefault = parseEntry(requireEntry(atoms, '/i18n/default.json', 'AToMS'));
    const atomsOptionCount = Object.keys(atomsSchema).length;
    const atomsAllowCount = Object.values(atomsSchema).reduce((n, row) => n + valuesOf(row).length, 0);
    if (atomsOptionCount !== 42 || atomsAllowCount !== 213 || Object.keys(atomsDefault).length !== 144) throw new Error(`AToMS: schema/default ${atomsOptionCount}/${atomsAllowCount}/${Object.keys(atomsDefault).length}`);
    const builtAtoms = buildAtoms(atomsDefault, atomsSchema);
    if (Object.keys(builtAtoms.en).length !== 292) throw new Error(`AToMS: final keys ${Object.keys(builtAtoms.en).length}`);
    keyParity(builtAtoms.en, builtAtoms.ru, 'AToMS');
    assertNoVisibleLatin(builtAtoms.ru, 'AToMS');
    const atomsRoot = rootOf(atomsContentEntry, '/content.json');
    zip.addFile(`Mods/${atomsRoot}/i18n/default.json`, jsonBuffer(builtAtoms.en));
    zip.addFile(`Mods/${atomsRoot}/i18n/ru.json`, jsonBuffer(builtAtoms.ru));
    verified.push({ name: MODS.atoms.name, version: MODS.atoms.version, fileId: MODS.atoms.fileId, configOptions: 42, allowValues: 213, sourceDefaultKeys: 144, addedValueLabels: 148, ruKeys: 292, missing: 0, extra: 0, internalConfigKeysChanged: 0, internalAllowValuesChanged: 0, remainingVisibleLatin: 0 });

    manifestVersion(bean, MODS.bean.version, 'Bean');
    const beanContentEntry = requireEntry(bean, '/content.json', 'Bean');
    const beanContent = parseEntry(beanContentEntry);
    const beanSchema = beanContent.ConfigSchema || {};
    if (Object.keys(beanSchema).length !== 40) throw new Error(`Bean: config options ${Object.keys(beanSchema).length}`);
    const builtBean = buildBean(beanSchema);
    if (builtBean.sections.length !== 11 || Object.keys(builtBean.ru).length !== 131) throw new Error(`Bean: sections/keys ${builtBean.sections.length}/${Object.keys(builtBean.ru).length}`);
    keyParity(builtBean.en, builtBean.ru, 'Bean');
    assertNoVisibleLatin(builtBean.ru, 'Bean');
    const petsEntry = requireEntry(bean, '/data/pets.json', 'Bean');
    const petsSource = parseEntry(petsEntry);
    const petsRu = JSON.parse(JSON.stringify(petsSource));
    const displayNamesChanged = patchDisplayNames(petsRu);
    if (displayNamesChanged !== 10) throw new Error(`Bean: translated DisplayName ${displayNamesChanged}/10`);
    if (!equal(scrubDisplayNames(petsSource), scrubDisplayNames(petsRu))) throw new Error('Bean: technical pet data changed');
    const remainingPetLatin = [];
    (function scan(node) {
      if (Array.isArray(node)) { node.forEach(scan); return; }
      if (!node || typeof node !== 'object') return;
      for (const [k, v] of Object.entries(node)) {
        if (k === 'DisplayName' && visibleLatin(v)) remainingPetLatin.push(v);
        else scan(v);
      }
    })(petsRu);
    if (remainingPetLatin.length) throw new Error(`Bean: visible Latin DisplayName ${remainingPetLatin.join('|')}`);
    const beanRoot = rootOf(beanContentEntry, '/content.json');
    zip.addFile(`Mods/${beanRoot}/i18n/default.json`, jsonBuffer(builtBean.en));
    zip.addFile(`Mods/${beanRoot}/i18n/ru.json`, jsonBuffer(builtBean.ru));
    zip.addFile(`Mods/${beanRoot}/data/pets.json`, jsonBuffer(petsRu));
    verified.push({ name: MODS.bean.name, version: MODS.bean.version, fileId: MODS.bean.fileId, configOptions: 40, allowValues: 80, sections: 11, ruKeys: 131, displayNamesTranslated: 10, technicalPetFieldsChanged: 0, missing: 0, extra: 0, internalConfigKeysChanged: 0, internalAllowValuesChanged: 0, remainingVisibleLatin: 0 });

    manifestVersion(cold, MODS.cold.version, 'Cold Pets');
    const coldUnexpected = cold.filter(e => /\.jsonc?$/i.test(e.entryName) && !/\/manifest\.json$/i.test('/' + e.entryName));
    if (coldUnexpected.length) throw new Error(`Cold Pets: unexpected text files ${coldUnexpected.map(e => e.entryName).join('|')}`);
    verified.push({ name: MODS.cold.name, version: MODS.cold.version, fileId: MODS.cold.fileId, localizationNeeded: false, activeUserFacingTextFiles: 0 });

    manifestVersion(custom, MODS.custom.version, 'Custom Companions');
    const customUnexpected = custom.filter(e => /\/i18n\/|content\.json$|config\.json$|translation/i.test('/' + e.entryName));
    const customJson = custom.filter(e => /\.jsonc?$/i.test(e.entryName) && !/\/manifest\.json$/i.test('/' + e.entryName) && !/\.deps\.json$/i.test(e.entryName));
    if (customUnexpected.length || customJson.length) throw new Error('Custom Companions: unexpected localization/content files');
    verified.push({ name: MODS.custom.name, version: MODS.custom.version, fileId: MODS.custom.fileId, localizationNeeded: false, activeUserFacingTextFiles: 0 });

    const files = zip.getEntries().filter(e => !e.isDirectory);
    if (files.length !== 8) throw new Error(`Stage 60: output files ${files.length}/8`);
    const output = zip.toBuffer();
    const status = { ok: true, complete: true, stage: 60, corrected: true, mods: 6, files: files.length, zipBytes: output.length, verified };
    if (String(req.query.status || '') === '1') return res.status(200).json(status);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="RU_STAGE60_CORRECTED_VERIFIED_6.zip"');
    return res.status(200).send(output);
  } catch (error) {
    return res.status(500).json({ ok: false, complete: false, stage: 60, corrected: true, error: String(error && error.message || error) });
  }
};

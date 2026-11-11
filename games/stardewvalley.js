const fs = require('fs');
const path = require('path');
const jsonc = require('jsonc-parser');
const generic = require('./generic');
const { collectFiles } = require('../lib/mod-archive-builder');
const { safeArchivePath } = require('../lib/archive-utils');

function review(message) {
  const error = new Error(message);
  error.code = 'NEEDS_REVIEW';
  return error;
}
function field(value, name) {
  if (!value || typeof value !== 'object') return undefined;
  const key = Object.keys(value).find(key => key.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : value[key];
}
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

// Content Patcher also permits raw line breaks in quoted strings (JSON.NET).
// Normalize for parsing only; never rewrite the actual mod files.
function normalizeMultiline(text) {
  let quoted = false;
  let escaped = false;
  let comment = null;
  let output = '';
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (comment === 'line') {
      if (char === '\n') comment = null;
    } else if (comment === 'block') {
      if (char === '*' && next === '/') { output += '*/'; i += 1; comment = null; continue; }
    } else if (quoted) {
      if (!escaped && (char === '\n' || char === '\r')) {
        output += char === '\n' ? '\\n' : '\\r';
        continue;
      }
      if (!escaped && char === '"') quoted = false;
      if (!escaped && char === '\\') escaped = true;
      else escaped = false;
    } else if (char === '/' && next === '/') {
      comment = 'line'; output += '//'; i += 1; continue;
    } else if (char === '/' && next === '*') {
      comment = 'block'; output += '/*'; i += 1; continue;
    } else if (char === '"') quoted = true;
    output += char;
  }
  return output.replace(/^\uFEFF/, '');
}
function readModJson(file) {
  const errors = [];
  const value = jsonc.parse(normalizeMultiline(fs.readFileSync(file, 'utf8')), errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length) throw review('Invalid mod JSON: ' + file + ' (' + jsonc.printParseErrorCode(errors[0].error) + ')');
  return value;
}
function prefix(root, relative) { return root ? root + '/' + relative : relative; }
function owns(root, relative) { return !root || relative.startsWith(root + '/'); }
function parent(relative) { const value = path.posix.dirname(relative); return value === '.' ? '' : value; }
function analyze(directory, role) {
  const files = collectFiles(directory);
  const byName = new Map();
  const documents = new Map();
  for (const file of files) {
    const lower = file.relative.toLowerCase();
    if (byName.has(lower)) throw review('Case-insensitive filename collision: ' + file.relative);
    byName.set(lower, file);
    if (lower.endsWith('.json')) documents.set(lower, readModJson(file.full));
  }
  const manifests = [];
  const ids = new Set();
  for (const file of files.filter(file => path.posix.basename(file.relative).toLowerCase() === 'manifest.json')) {
    const manifest = documents.get(file.relative.toLowerCase());
    const id = field(manifest, 'UniqueID');
    const version = field(manifest, 'Version');
    if (!object(manifest) || typeof field(manifest, 'Name') !== 'string' || !field(manifest, 'Name').trim() ||
        typeof id !== 'string' || !/^[\p{L}\p{N}_.-]+$/u.test(id) ||
        typeof version !== 'string' || !/^\d+(?:\.\d+){0,2}(?:[-+].+)?$/.test(version) || /^0(?:\.0){0,2}$/.test(version)) {
      throw review('Invalid SMAPI manifest identity/name/version: ' + file.relative);
    }
    if (ids.has(id.toLowerCase())) throw review('Duplicate manifest UniqueID: ' + id);
    ids.add(id.toLowerCase());
    const dll = field(manifest, 'EntryDll');
    const pack = field(manifest, 'ContentPackFor');
    const packId = typeof pack === 'string' ? pack : field(pack, 'UniqueID');
    if (Boolean(dll) === Boolean(pack) || (pack && (typeof packId !== 'string' || !packId.trim()))) {
      throw review('Manifest must specify exactly one EntryDll or ContentPackFor: ' + file.relative);
    }
    const root = parent(file.relative);
    if (dll && (typeof dll !== 'string' || /[\\/:*?"<>|\x00]/.test(dll) || (role !== 'translation' && !byName.has(prefix(root, dll).toLowerCase())))) {
      throw review('Manifest EntryDll is invalid or missing: ' + file.relative);
    }
    const dependencies = field(manifest, 'Dependencies') || [];
    if (!Array.isArray(dependencies) || dependencies.some(dependency => !/^[\p{L}\p{N}_.-]+$/u.test(field(dependency, 'UniqueID') || ''))) {
      throw review('Invalid manifest Dependencies: ' + file.relative);
    }
    if (String(packId).toLowerCase() === 'pathoschild.contentpatcher') {
      const contentName = prefix(root, 'content.json').toLowerCase();
      const content = documents.get(contentName);
      const changes = field(content, 'Changes');
      if (content === undefined && role === 'translation') {
        manifests.push({ root, id, version, manifest });
        continue;
      }
      if (!object(content) || typeof field(content, 'Format') !== 'string' || !field(content, 'Format').trim() ||
          (changes !== undefined && !Array.isArray(changes))) {
        throw review('Content Patcher requires a valid content.json with Format and optional Changes array: ' + file.relative);
      }
      for (const patch of changes || []) {
        if (!object(patch) || typeof field(patch, 'Action') !== 'string' || !field(patch, 'Action').trim()) throw review('Content Patcher patch has no Action: ' + contentName);
        const fromFile = field(patch, 'FromFile');
        if (typeof fromFile === 'string' && !fromFile.includes('{{') && !fromFile.includes(',')) {
          const safe = safeArchivePath(fromFile);
          if (role !== 'translation' && !byName.has(prefix(root, safe).toLowerCase())) throw review('Content Patcher FromFile is missing: ' + fromFile);
        }
      }
    }
    manifests.push({ root, id, version, manifest });
  }
  if (role !== 'translation' && !manifests.length) throw review('No SMAPI manifest.json found in original/merged mod');
  return { files, byName, documents, manifests };
}
function localization(report) {
  const coverage = [];
  for (const manifest of report.manifests) {
    const defaults = report.documents.get(prefix(manifest.root, 'i18n/default.json').toLowerCase());
    if (defaults === undefined) continue;
    const russian = report.documents.get(prefix(manifest.root, 'i18n/ru.json').toLowerCase()) || {};
    if (!object(defaults) || !object(russian)) throw review('i18n files must be objects: ' + manifest.id);
    const keys = Object.keys(defaults).filter(key => typeof defaults[key] === 'string');
    if (Object.values(defaults).some(value => typeof value !== 'string' && value !== null) ||
        Object.values(russian).some(value => typeof value !== 'string' && value !== null)) throw review('i18n values must be strings or null: ' + manifest.id);
    const translated = new Map(Object.entries(russian).map(([key, value]) => [key.toLowerCase(), value]));
    const missingKeys = keys.filter(key => typeof defaults[key] === 'string' && typeof translated.get(key.toLowerCase()) !== 'string');
    coverage.push({ uniqueID: manifest.id, totalKeys: keys.length, translatedKeys: keys.length - missingKeys.length, missingKeys });
  }
  return coverage;
}
function validateSource({ role, directory }) {
  try {
    const report = analyze(directory, role);
    const coverage = role === 'merged' ? localization(report) : [];
    return {
      valid: true, manifests: report.manifests.map(({ root, id, version }) => ({ root, uniqueID: id, version })),
      localization: coverage, needsReview: coverage.some(item => item.missingKeys.length),
      warnings: role === 'merged' ? ['Structural/key coverage checks do not prove Russian text quality, GMCM completeness or in-game compatibility.'] : []
    };
  } catch (error) {
    if (error.code !== 'NEEDS_REVIEW' && !/Unsafe archive entry/.test(error.message)) throw error;
    return { valid: false, error: error.message, warnings: [] };
  }
}
function createMergeOptions({ originalDir, translationDir }) {
  const original = analyze(originalDir, 'original');
  const translation = analyze(translationDir, 'translation');
  const roots = [...translation.manifests].sort((a, b) => b.root.length - a.root.length);
  const rootManifest = original.manifests.find(item => !item.root);
  function destination(relative) {
    const canonical = original.byName.get(relative.toLowerCase())?.relative || relative;
    return rootManifest ? prefix(rootManifest.id, canonical) : canonical;
  }
  return {
    mapOriginalPath: destination,
    mapTranslationPath(relative) {
      const owner = roots.find(item => owns(item.root, relative));
      if (owner) {
        const match = original.manifests.find(item => item.id.toLowerCase() === owner.id.toLowerCase());
        if (match) {
          if (match.version !== owner.version) throw review('Translation manifest version differs from original for ' + match.id);
          return destination(prefix(match.root, owner.root ? relative.slice(owner.root.length + 1) : relative));
        }
        if (original.manifests.some(item => !item.root || !owner.root || owns(item.root, owner.root + '/manifest.json') || owns(owner.root, item.root + '/manifest.json'))) {
          throw review('Standalone translation manifest collides with original mod folders: ' + owner.id);
        }
        return relative;
      }
      if (original.byName.has(relative.toLowerCase())) return destination(relative);
      if (original.manifests.some(item => item.root && owns(item.root, relative))) return destination(relative);
      if (original.manifests.length !== 1) throw review('Overlay without a manifest is ambiguous for a multi-mod archive: ' + relative);
      const root = original.manifests[0].root;
      if (/^i18n\//i.test(relative) || !relative.includes('/')) return destination(prefix(root, relative));
      const marker = relative.toLowerCase().indexOf('/i18n/');
      if (marker >= 0) return destination(prefix(root, relative.slice(marker + 1)));
      const suffix = relative.slice(relative.indexOf('/') + 1);
      if (original.byName.has(prefix(root, suffix).toLowerCase())) return destination(prefix(root, suffix));
      throw review('Cannot safely place translation file: ' + relative);
    }
  };
}
module.exports = { ...generic, id: 'stardewvalley', name: 'Stardew Valley (SMAPI/Content Patcher)', validateSource, createMergeOptions, readModJson, review };

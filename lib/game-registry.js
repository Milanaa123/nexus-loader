const genericGame = require('../games/generic');

const games = new Map();

function registerGame(adapter) {
  if (!adapter || !String(adapter.id || '').trim()) throw new Error('Game adapter requires id');
  const id = String(adapter.id).trim().toLowerCase();
  const value = Object.freeze({ ...adapter, id });
  games.set(id, value);
  return value;
}

function hasGame(id) {
  return games.has(String(id || '').trim().toLowerCase());
}

function getGame(id = 'generic') {
  const key = String(id || 'generic').trim().toLowerCase();
  return games.get(key) || games.get('generic');
}

function resolveGame(id = 'generic') {
  const requested = String(id || 'generic').trim().toLowerCase();
  const adapter = getGame(requested);
  return { requested, adapter, fallback: !hasGame(requested) };
}

function listGames() {
  return Array.from(games.values()).map(game => ({ id: game.id, name: game.name, mergeStrategy: game.mergeStrategy || null }));
}

registerGame(genericGame);
registerGame(require('../games/stardewvalley'));

module.exports = { registerGame, hasGame, getGame, resolveGame, listGames };

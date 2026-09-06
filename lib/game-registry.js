const genericGame = require('../games/generic');

const games = new Map();

function registerGame(adapter) {
  if (!adapter || !adapter.id) {
    throw new Error('Game adapter requires id');
  }

  games.set(adapter.id, adapter);
  return adapter;
}

function getGame(id = 'generic') {
  return games.get(id) || games.get('generic');
}

function listGames() {
  return Array.from(games.values()).map((game) => ({
    id: game.id,
    name: game.name
  }));
}

registerGame(genericGame);

module.exports = {
  registerGame,
  getGame,
  listGames
};

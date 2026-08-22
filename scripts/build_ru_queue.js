const fs = require('fs');

const source = JSON.parse(fs.readFileSync('data/full-source-537.json','utf8'));

const queue = {
  version: '1.0',
  game: 'stardewvalley',
  target: 'desktop_steamdeck',
  status: 'pending_ids',
  total: source.source_entry_count,
  processed: 0,
  items: []
};

fs.mkdirSync('data/queue', { recursive: true });
fs.writeFileSync('data/queue/ru-pack-queue.json', JSON.stringify(queue, null, 2), 'utf8');

console.log(JSON.stringify({ created: true, total: queue.total }));

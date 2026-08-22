const fs = require('fs');

const input = 'data/queue/ru-pack-queue.json';
const output = 'data/queue/resolved-queue.json';

if (!fs.existsSync(input)) {
  console.error('Queue not found');
  process.exit(1);
}

const queue = JSON.parse(fs.readFileSync(input, 'utf8'));

queue.status = 'ready_for_nexus_resolve';
queue.batches = [];
const size = 50;

for (let i = 0; i < queue.total; i += size) {
  queue.batches.push({
    batch: queue.batches.length + 1,
    from: i + 1,
    to: Math.min(i + size, queue.total),
    status: 'pending'
  });
}

fs.writeFileSync(output, JSON.stringify(queue, null, 2));
console.log(JSON.stringify({batches: queue.batches.length, total: queue.total}));

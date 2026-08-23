const fs = require('fs');

const sourcePath = 'data/full-source-537.json';
const queueDir = 'data/queue';
const queuePath = `${queueDir}/ru-pack-queue.json`;
const progressPath = 'data/RU_PACK_WORK/progress.json';

if (!fs.existsSync(sourcePath)) {
  throw new Error('Missing data/full-source-537.json');
}

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const items = Array.isArray(source.items) ? source.items : [];

fs.mkdirSync(queueDir, { recursive: true });
fs.mkdirSync('data/RU_PACK_WORK', { recursive: true });

const queue = {
  version: '2.0',
  status: 'ready',
  total: items.length,
  processed: 0,
  items: items.map((item, index) => ({
    index,
    ...item,
    status: 'pending'
  }))
};

const progress = {
  running: false,
  total: queue.total,
  processed: 0,
  remaining: queue.total,
  current: null,
  downloaded: 0,
  foundTranslations: 0,
  failed: 0
};

fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));

console.log(JSON.stringify({ok:true,total:queue.total}));

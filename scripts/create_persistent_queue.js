const fs = require('fs');
const path = require('path');
const paths = require('../config/paths');

const sourcePath = path.join(paths.root, 'data', 'full-source-537.json');
const queuePath = paths.queueFile;
const progressPath = path.join(paths.workDir, 'progress.json');

if (!fs.existsSync(sourcePath)) {
  throw new Error('Missing data/full-source-537.json');
}

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const items = Array.isArray(source.items) ? source.items : [];

fs.mkdirSync(paths.queueDir, { recursive: true });
fs.mkdirSync(paths.workDir, { recursive: true });

const queue = {
  version: '2.1',
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
  status: 'ready',
  total: queue.total,
  processed: 0,
  remaining: queue.total,
  current: null,
  downloaded: 0,
  foundTranslations: 0,
  failed: 0,
  updatedAt: new Date().toISOString()
};

fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));

console.log(JSON.stringify({ok:true,total:queue.total,queuePath,progressPath}));

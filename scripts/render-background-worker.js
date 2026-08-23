const worker = require('./ru-pack-worker');

let stopping = false;

async function run() {
  console.log('RU background worker online');

  while (!stopping) {
    try {
      const progress = worker.loadProgress();

      if (!progress.running) {
        await worker.start();
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (err) {
      const current = worker.loadProgress();
      worker.saveProgress({
        ...current,
        running: false,
        status: 'error',
        lastError: err.message
      });
      console.error('Worker error:', err.message);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

process.on('SIGTERM', () => {
  stopping = true;
});

run();

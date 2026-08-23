const worker = require('./ru-pack-worker');

async function run() {
  console.log('RU background worker started');

  while (true) {
    try {
      const progress = worker.loadProgress();

      if (progress.running) {
        console.log(
          'Processing:',
          progress.current,
          `${progress.processed}/${progress.total}`
        );
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (e) {
      console.error('Worker error:', e.message);
    }
  }
}

run();

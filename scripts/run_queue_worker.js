// Compatibility entry point: never mark a job complete without processing it.
const worker = require('./ru-pack-worker');
async function run() { return worker.start(); }
if (require.main === module) run().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
module.exports = { run };

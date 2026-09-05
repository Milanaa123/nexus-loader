const fs = require('fs');
const path = require('path');

const DEFAULT_FILE = path.join(__dirname, '..', 'data', 'jobs.json');

function ensureStorage(file = DEFAULT_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({ jobs: [] }, null, 2));
  }
}

function loadJobs(file = DEFAULT_FILE) {
  ensureStorage(file);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJobs(data, file = DEFAULT_FILE) {
  ensureStorage(file);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function updateJob(id, patch, file = DEFAULT_FILE) {
  const data = loadJobs(file);
  const job = data.jobs.find(item => item.id === id);

  if (!job) throw new Error(`Job ${id} not found`);

  Object.assign(job, patch, {
    updatedAt: new Date().toISOString()
  });

  saveJobs(data, file);
  return job;
}

module.exports = {
  loadJobs,
  saveJobs,
  updateJob
};

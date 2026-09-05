const { createModJob } = require('./modJobSchema');

function parseLine(line) {
  const value = String(line || '').trim();
  if (!value) return null;

  const parts = value.split(/\s+/);
  const author = parts.pop();
  const name = parts.join(' ');

  return { name, author };
}

function createJobsFromText(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(parseLine)
    .filter(Boolean)
    .map(createModJob);
}

module.exports = {
  parseLine,
  createJobsFromText
};

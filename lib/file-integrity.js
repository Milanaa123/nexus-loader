const fs = require('fs');
const crypto = require('crypto');
async function digestFile(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
module.exports = { digestFile };

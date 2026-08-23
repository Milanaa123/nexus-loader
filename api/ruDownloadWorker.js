const fs = require('fs');
const path = require('path');
const https = require('https');

function download(url, out) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(out);
    https.get(url, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        file.close();
        return download(r.headers.location, out).then(resolve).catch(reject);
      }
      r.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', e => {
      try { fs.unlinkSync(out); } catch {}
      reject(e);
    });
  });
}

async function saveTranslation(item) {
  if (!item.downloadUrl) return { ...item, downloaded: false, reason: 'no_download_url' };
  const dir = path.join(__dirname, '..', 'RU_PACK_WORK', 'downloads');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${item.modId || Date.now()}.zip`);
  await download(item.downloadUrl, file);
  return { ...item, downloaded: true, file };
}

module.exports = { saveTranslation };

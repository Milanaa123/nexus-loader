const KEYS = Object.freeze({
  clientId: 'GOOGLE_DRIVE_CLIENT_ID',
  clientSecret: 'GOOGLE_DRIVE_CLIENT_SECRET',
  refreshToken: 'GOOGLE_DRIVE_REFRESH_TOKEN',
  folderId: 'GOOGLE_DRIVE_FOLDER_ID'
});

function configurationStatus(env = process.env) {
  const present = Object.fromEntries(Object.entries(KEYS).map(([key, name]) => [key, Boolean(env[name]?.trim())]));
  return { provider: 'google-drive', configured: Object.values(present).every(Boolean), present, runtimeIntegration: false };
}

function getDriveConfig(env = process.env) {
  const status = configurationStatus(env);
  if (!status.configured) {
    const error = new Error('Google Drive configuration is incomplete: ' + Object.entries(KEYS).filter(([key]) => !status.present[key]).map(([, name]) => name).join(', '));
    error.code = 'DRIVE_NOT_CONFIGURED';
    throw error;
  }
  function integer(name, fallback, min, max) {
    const value = env[name] === undefined ? fallback : Number(env[name]);
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      const error = new Error('Invalid Google Drive setting: ' + name);
      error.code = 'DRIVE_INVALID_CONFIG';
      throw error;
    }
    return value;
  }
  return {
    ...Object.fromEntries(Object.entries(KEYS).map(([key, name]) => [key, env[name].trim()])),
    timeoutMs: integer('GOOGLE_DRIVE_TIMEOUT_MS', 60000, 100, 300000),
    attempts: integer('GOOGLE_DRIVE_MAX_ATTEMPTS', 4, 1, 8),
    chunkBytes: integer('GOOGLE_DRIVE_CHUNK_BYTES', 1024 * 1024, 256 * 1024, 8 * 1024 * 1024),
    maxFileBytes: integer('GOOGLE_DRIVE_MAX_FILE_BYTES', 1024 * 1024 * 1024, 1, Number.MAX_SAFE_INTEGER)
  };
}

module.exports = { KEYS, configurationStatus, getDriveConfig };

function selectedBackend(env = process.env) {
  const value = env.NEXUS_LOADER_STORAGE_BACKEND || 'local';
  if (!['local', 'supabase'].includes(value)) throw Object.assign(new Error('Unknown storage backend'), { code: 'STORAGE_CONFIG' });
  return value;
}
function cloudStatus(env = process.env) {
  return { backend: selectedBackend(env), configured: Boolean(env.NEXUS_LOADER_SUPABASE_URL && env.NEXUS_LOADER_STORAGE_TOKEN), embeddedWorker: env.NEXUS_LOADER_EMBEDDED_WORKER === 'true' };
}
function cloudConfig(env = process.env) {
  const base = env.NEXUS_LOADER_SUPABASE_URL || '';
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(base) || !/^[A-Za-z0-9_-]{43,128}$/.test(env.NEXUS_LOADER_STORAGE_TOKEN || '')) {
    throw Object.assign(new Error('Supabase storage configuration is missing or invalid'), { code: 'STORAGE_CONFIG' });
  }
  return { url: base + '/functions/v1/nexus-storage', token: env.NEXUS_LOADER_STORAGE_TOKEN, chunkBytes: 2097152, maxFileBytes: 838860800, timeoutMs: 30000, attempts: 3 };
}
module.exports = { selectedBackend, cloudConfig, cloudStatus };

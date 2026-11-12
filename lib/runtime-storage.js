const { selectedBackend } = require('../config/cloud');
let cloud;
function getStores() {
  if (selectedBackend() === 'supabase') {
    if (!cloud) cloud = require('./supabase-store').createSupabaseStore();
    return cloud;
  }
  return { queue: require('./job-queue'), state: require('./state-store') };
}
function getWorkerStores() {
  return selectedBackend() === 'supabase' ? require('./supabase-store').createSupabaseStore() : getStores();
}
module.exports = { getStores, getWorkerStores };

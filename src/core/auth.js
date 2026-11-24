const bcrypt = require('bcrypt');
const paths = require('../config/paths');
const settingsStore = require('./settingsStore');

function isSetUp() {
  const auth = settingsStore.readJson(paths.AUTH_JSON, null);
  return Boolean(auth && auth.passwordHash);
}

async function setup(password) {
  if (isSetUp()) throw new Error('Já existe uma password de administrador configurada.');
  const passwordHash = await bcrypt.hash(password, 12);
  settingsStore.atomicWriteJson(paths.AUTH_JSON, { passwordHash });
}

async function verify(password) {
  const auth = settingsStore.readJson(paths.AUTH_JSON, null);
  if (!auth) return false;
  return bcrypt.compare(password, auth.passwordHash);
}

// Exige sempre a password atual, mesmo com sessão já autenticada - defesa
// extra para quem tenha acesso físico a uma sessão aberta sem saber a
// password real.
async function changePassword(currentPassword, newPassword) {
  const ok = await verify(currentPassword);
  if (!ok) throw new Error('Password atual incorreta.');
  const passwordHash = await bcrypt.hash(newPassword, 12);
  settingsStore.atomicWriteJson(paths.AUTH_JSON, { passwordHash });
}

module.exports = { isSetUp, setup, verify, changePassword };

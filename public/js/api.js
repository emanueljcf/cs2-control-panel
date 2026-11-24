// Centraliza todas as chamadas fetch() à API. Para apontar a um host remoto
// no futuro, basta mudar BASE_URL aqui.
const BASE_URL = '';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
  });
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('unauthenticated'));
    throw new Error('not-authenticated');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.warning || `Erro ${res.status}`);
  }
  return data;
}

const api = {
  authStatus: () => apiFetch('/api/auth/status'),
  setup: (password) => apiFetch('/api/auth/setup', { method: 'POST', body: JSON.stringify({ password }) }),
  login: (password) => apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => apiFetch('/api/auth/logout', { method: 'POST' }),
  changePassword: (currentPassword, newPassword) => apiFetch('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),

  status: () => apiFetch('/api/status'),
  checkUpdate: () => apiFetch('/api/update/check'),
  runUpdate: () => apiFetch('/api/update/run', { method: 'POST' }),
  getUpdateStatus: () => apiFetch('/api/update/status'),
  adopt: () => apiFetch('/api/status/adopt', { method: 'POST' }),

  serverStart: () => apiFetch('/api/server/start', { method: 'POST' }),
  serverStop: () => apiFetch('/api/server/stop', { method: 'POST' }),
  serverRestart: () => apiFetch('/api/server/restart', { method: 'POST' }),
  getServerSettings: () => apiFetch('/api/server/settings'),
  putServerSettings: (changes) => apiFetch('/api/server/settings', { method: 'PUT', body: JSON.stringify(changes) }),

  getMaps: () => apiFetch('/api/maps'),
  setMapcycle: (maps) => apiFetch('/api/maps/mapcycle', { method: 'PUT', body: JSON.stringify({ maps }) }),
  changeMap: (map) => apiFetch('/api/maps/change', { method: 'POST', body: JSON.stringify({ map }) }),

  getModes: () => apiFetch('/api/mode'),
  changeMode: (mode) => apiFetch('/api/mode/change', { method: 'POST', body: JSON.stringify({ mode }) }),

  restartMatch: () => apiFetch('/api/match/restart', { method: 'POST' }),
  restartRound: () => apiFetch('/api/match/restart-round', { method: 'POST' }),
  pauseMatch: (durationSeconds) => apiFetch('/api/match/pause', { method: 'POST', body: JSON.stringify({ durationSeconds }) }),
  unpauseMatch: () => apiFetch('/api/match/unpause', { method: 'POST' }),
  getPauseState: () => apiFetch('/api/match/pause-state'),

  getModeSettings: (mode) => apiFetch(`/api/settings/modes/${mode}`),
  applyModeLive: (mode, changes) => apiFetch(`/api/settings/modes/${mode}/apply-live`, { method: 'POST', body: JSON.stringify({ changes }) }),
  applyAll: (dryRun = false) => apiFetch(`/api/settings/apply?dryRun=${dryRun}`, { method: 'POST' }),

  getConvars: () => apiFetch('/api/convars'),

  getPlayers: () => apiFetch('/api/players'),
  kickPlayer: (userid, reason) => apiFetch(`/api/players/${userid}/kick`, { method: 'POST', body: JSON.stringify({ reason }) }),
  banPlayer: (userid, minutes, reason, name, address) => apiFetch(`/api/players/${userid}/ban`, { method: 'POST', body: JSON.stringify({ minutes, reason, name, address }) }),
  getBans: () => apiFetch('/api/players/bans'),
  unbanEntry: (id) => apiFetch(`/api/players/bans/${id}/unban`, { method: 'POST' }),
  getBansRaw: () => apiFetch('/api/players/bans/raw'),
  clearAllBans: () => apiFetch('/api/players/bans/clear-all', { method: 'POST' }),

  getPresets: () => apiFetch('/api/presets'),
  savePreset: (name, baseMode, overrides, rawOverrides) => apiFetch('/api/presets', { method: 'POST', body: JSON.stringify({ name, baseMode, overrides, rawOverrides }) }),
  applyPreset: (id) => apiFetch(`/api/presets/${id}/apply`, { method: 'POST' }),
  deletePreset: (id) => apiFetch(`/api/presets/${id}`, { method: 'DELETE' }),
};

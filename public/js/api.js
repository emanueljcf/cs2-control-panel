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

  status: () => apiFetch('/api/status'),
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
  putModeSettings: (mode, changes) => apiFetch(`/api/settings/modes/${mode}`, { method: 'PUT', body: JSON.stringify({ changes }) }),
  applyAll: (dryRun = false) => apiFetch(`/api/settings/apply?dryRun=${dryRun}`, { method: 'POST' }),

  getConvars: () => apiFetch('/api/convars'),

  getPresets: () => apiFetch('/api/presets'),
  savePreset: (name, baseMode) => apiFetch('/api/presets', { method: 'POST', body: JSON.stringify({ name, baseMode }) }),
  applyPreset: (id) => apiFetch(`/api/presets/${id}/apply`, { method: 'POST' }),
  deletePreset: (id) => apiFetch(`/api/presets/${id}`, { method: 'DELETE' }),
};

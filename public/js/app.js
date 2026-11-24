let dashboardInitialized = false;
let convarsCache = null;

async function initDashboard() {
  if (dashboardInitialized) {
    refreshStatus();
    return;
  }
  dashboardInitialized = true;

  convarsCache = await api.getConvars();

  await refreshStatus();
  await loadMaps();
  await loadModes();
  await loadServerSettings();
  await loadModeSettings(document.getElementById('settings-mode-select').value);
  await loadPresets();

  document.getElementById('btn-start').addEventListener('click', async () => {
    await api.serverStart();
    refreshStatus();
  });
  document.getElementById('btn-stop').addEventListener('click', async () => {
    if (!confirm('Isto desliga TODOS os jogadores. Continuar?')) return;
    await api.serverStop();
    refreshStatus();
  });
  document.getElementById('btn-restart').addEventListener('click', async () => {
    if (!confirm('Isto desliga TODOS os jogadores e reinicia o processo. Continuar?')) return;
    await api.serverRestart();
    refreshStatus();
  });
  document.getElementById('btn-adopt').addEventListener('click', async () => {
    await api.adopt();
    refreshStatus();
  });

  document.getElementById('btn-change-map').addEventListener('click', async () => {
    const map = document.getElementById('live-map-select').value;
    const result = await api.changeMap(map);
    showLiveFeedback(result);
    refreshStatus();
  });
  document.getElementById('btn-restart-match').addEventListener('click', async () => {
    const result = await api.restartMatch();
    showLiveFeedback(result);
  });
  document.getElementById('btn-restart-round').addEventListener('click', async () => {
    const result = await api.restartRound();
    showLiveFeedback(result);
  });
  document.getElementById('btn-change-mode').addEventListener('click', async () => {
    const mode = document.getElementById('mode-select').value;
    const result = await api.changeMode(mode);
    showLiveFeedback(result);
    refreshStatus();
    loadModeSettings(mode);
  });

  document.getElementById('btn-pause').addEventListener('click', async () => {
    const isFixed = document.getElementById('pause-type-select').value === 'fixed';
    const duration = isFixed ? Number(document.getElementById('pause-duration-input').value) : null;
    const result = await api.pauseMatch(duration);
    showLiveFeedback(result);
    refreshPauseState();
  });
  document.getElementById('btn-unpause').addEventListener('click', async () => {
    const result = await api.unpauseMatch();
    showLiveFeedback(result);
    refreshPauseState();
  });
  document.getElementById('pause-type-select').addEventListener('change', (e) => {
    document.getElementById('pause-duration-input').disabled = e.target.value === 'indefinite';
  });
  refreshPauseState();
  setInterval(refreshPauseState, 5000);

  document.querySelectorAll('.tab-btn').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  setInterval(() => {
    if (document.getElementById('tab-jogadores').classList.contains('hidden')) return;
    loadPlayers();
  }, 5000);

  document.getElementById('btn-change-password').addEventListener('click', async () => {
    const current = document.getElementById('change-pw-current').value;
    const next = document.getElementById('change-pw-new').value;
    const confirm = document.getElementById('change-pw-confirm').value;
    const feedback = document.getElementById('change-password-feedback');
    if (next.length < 8) {
      feedback.textContent = 'A nova password tem de ter pelo menos 8 caracteres.';
      feedback.className = 'warning';
      return;
    }
    if (next !== confirm) {
      feedback.textContent = 'A confirmação não corresponde à nova password.';
      feedback.className = 'warning';
      return;
    }
    try {
      await api.changePassword(current, next);
      feedback.textContent = 'Password alterada com sucesso.';
      feedback.className = 'hint';
      document.getElementById('change-pw-current').value = '';
      document.getElementById('change-pw-new').value = '';
      document.getElementById('change-pw-confirm').value = '';
    } catch (err) {
      feedback.textContent = err.message || 'Não foi possível mudar a password.';
      feedback.className = 'warning';
    }
  });

  document.getElementById('btn-save-mapcycle').addEventListener('click', saveMapcycle);
  document.getElementById('btn-save-server-settings').addEventListener('click', saveServerSettings);
  document.getElementById('settings-mode-select').addEventListener('change', (e) => loadModeSettings(e.target.value));
  document.getElementById('btn-save-mode-settings').addEventListener('click', saveModeSettings);
  document.getElementById('btn-save-as-preset').addEventListener('click', saveAsPreset);
  document.getElementById('btn-save-raw').addEventListener('click', saveRawOverrides);
  document.getElementById('btn-apply-all').addEventListener('click', async () => {
    await api.applyAll(false);
    alert('Ficheiros .cfg reconstruídos a partir das definições guardadas.');
  });

  setInterval(refreshStatus, 10000);
}

function showLiveFeedback(result) {
  const el = document.getElementById('live-feedback');
  if (result.applied) {
    el.textContent = 'Aplicado ao vivo com sucesso.';
    el.className = 'hint';
  } else {
    el.textContent = result.warning || 'Não foi possível aplicar ao vivo — fica pendente.';
    el.className = 'warning';
  }
}

async function refreshStatus() {
  const status = await api.status();
  const body = document.getElementById('status-body');
  const badge = status.running
    ? (status.managed ? '<span class="badge running">a correr</span>' : '<span class="badge unmanaged">a correr (fora do painel)</span>')
    : '<span class="badge stopped">parado</span>';

  const rconDot = status.rconAvailable
    ? '<span class="badge running">disponível</span>'
    : '<span class="badge stopped">não configurado</span>';

  body.innerHTML = `
    <div class="stat-tile">
      <div class="stat-label">Estado</div>
      <div class="stat-value">${badge}</div>
    </div>
    <div class="stat-tile">
      <div class="stat-label">IP do servidor</div>
      <div class="stat-value mono">${status.ip}:${status.port}
        <button type="button" class="secondary copy-btn" id="btn-copy-ip">Copiar</button>
      </div>
    </div>
    <div class="stat-tile">
      <div class="stat-label">Modo ativo</div>
      <div class="stat-value">${status.activeMode || '-'}</div>
    </div>
    <div class="stat-tile">
      <div class="stat-label">Mapa ativo</div>
      <div class="stat-value">${status.activeMap || '-'}</div>
    </div>
    <div class="stat-tile">
      <div class="stat-label">RCON</div>
      <div class="stat-value">${rconDot}</div>
    </div>
    ${status.pid ? `
    <div class="stat-tile">
      <div class="stat-label">PID</div>
      <div class="stat-value mono">${status.pid}</div>
    </div>` : ''}
  `;
  const copyBtn = document.getElementById('btn-copy-ip');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard?.writeText(`${status.ip}:${status.port}`).catch(() => {});
    });
  }

  document.getElementById('btn-adopt').classList.toggle('hidden', !(status.running && !status.managed));

  const rconWarning = document.getElementById('rcon-warning');
  if (!status.rconAvailable) {
    rconWarning.textContent = 'Ativa o RCON e reinicia uma vez (em "Definições do servidor") para desbloquear aplicação imediata de mapa, modo, placar e definições sem desligar ninguém.';
    rconWarning.classList.remove('hidden');
  } else {
    rconWarning.classList.add('hidden');
  }
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('tab-painel').classList.toggle('hidden', tab !== 'painel');
  document.getElementById('tab-jogadores').classList.toggle('hidden', tab !== 'jogadores');
  if (tab === 'jogadores') {
    loadPlayers();
    loadBans();
  }
}

async function loadBans() {
  const { bans } = await api.getBans();
  const tbody = document.getElementById('bans-tbody');
  if (!bans.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="hint">Sem histórico ainda.</td></tr>';
    return;
  }
  tbody.innerHTML = bans.map((b) => `
    <tr data-id="${b.id}">
      <td>${new Date(b.bannedAt).toLocaleString('pt-PT')}</td>
      <td>${b.name || '-'}</td>
      <td>${b.address || '-'}</td>
      <td>${b.minutes === 0 ? 'Permanente' : `${b.minutes} min`}</td>
      <td>${b.reason || '-'}</td>
      <td>${b.liftedAt ? 'Levantado' : 'Ativo'}</td>
      <td>${b.liftedAt ? '-' : '<button type="button" class="secondary btn-unban">Desbanir</button>'}</td>
    </tr>
  `).join('');
  tbody.querySelectorAll('.btn-unban').forEach((btn) => btn.addEventListener('click', async (e) => {
    const id = e.target.closest('tr').dataset.id;
    const result = await api.unbanEntry(id);
    document.getElementById('bans-feedback').textContent = result.warning || 'Tentativa de desbanir feita.';
    loadBans();
  }));
}

document.getElementById('btn-clear-all-bans')?.addEventListener('click', async () => {
  if (!confirm('Isto apaga TODOS os banimentos guardados pelo motor (ficheiro). Continuar?')) return;
  const result = await api.clearAllBans();
  document.getElementById('bans-feedback').textContent = result.warning;
  loadBans();
});

async function loadPlayers() {
  const warning = document.getElementById('players-warning');
  const tbody = document.getElementById('players-tbody');
  try {
    const { players } = await api.getPlayers();
    warning.classList.add('hidden');
    if (!players.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="hint">Ninguém ligado.</td></tr>';
      return;
    }
    tbody.innerHTML = players.map((p) => `
      <tr data-userid="${p.userid}">
        <td>${p.userid}</td>
        <td>${p.name}${p.isBot ? ' <span class="hint">(bot)</span>' : ''}</td>
        <td>${p.time ?? '-'}</td>
        <td>${p.ping}</td>
        <td>${p.loss}</td>
        <td>${p.address ?? '-'}</td>
        <td>
          <button type="button" class="secondary btn-kick">Kick</button>
          <button type="button" class="danger btn-ban">Banir</button>
        </td>
      </tr>
    `).join('');
    tbody.querySelectorAll('.btn-kick').forEach((btn) => btn.addEventListener('click', async (e) => {
      const userid = e.target.closest('tr').dataset.userid;
      if (!confirm(`Kickar o jogador #${userid}?`)) return;
      await api.kickPlayer(userid, 'Removido pelo administrador');
      loadPlayers();
    }));
    tbody.querySelectorAll('.btn-ban').forEach((btn) => btn.addEventListener('click', async (e) => {
      const row = e.target.closest('tr');
      const userid = row.dataset.userid;
      const player = players.find((p) => p.userid === userid);
      const minutesStr = prompt('Duração do banimento em minutos (0 = permanente):', '60');
      if (minutesStr === null) return;
      await api.banPlayer(userid, Number(minutesStr) || 0, 'Banido pelo administrador', player?.name, player?.address);
      loadPlayers();
      loadBans();
    }));
  } catch (err) {
    warning.textContent = err.message || 'RCON indisponível — ativa-o e reinicia uma vez para ver os jogadores ligados.';
    warning.classList.remove('hidden');
    tbody.innerHTML = '';
  }
}

async function refreshPauseState() {
  const { paused, until } = await api.getPauseState();
  const el = document.getElementById('pause-status');
  if (!paused) {
    el.textContent = 'Jogo não está pausado.';
  } else if (until) {
    const remaining = Math.max(0, Math.round((new Date(until) - Date.now()) / 1000));
    el.textContent = `Pausado — retoma automaticamente em ~${remaining}s.`;
  } else {
    el.textContent = 'Pausado indefinidamente — clica "Despausar" para retomar.';
  }
}

async function loadMaps() {
  const { available, mapcycle } = await api.getMaps();

  // Datalist partilhado: sugere os mapas instalados, mas o campo é de texto
  // livre - aceita qualquer nome (workshop, comunidade, etc.), não só os
  // mapas oficiais da lista.
  let datalist = document.getElementById('map-options');
  if (!datalist) {
    datalist = document.createElement('datalist');
    datalist.id = 'map-options';
    document.body.appendChild(datalist);
  }
  datalist.innerHTML = available.map((m) => `<option value="${m}"></option>`).join('');

  const liveInput = document.getElementById('live-map-select');
  liveInput.setAttribute('list', 'map-options');
  if (!liveInput.value) liveInput.value = available[0] || '';

  const editor = document.getElementById('mapcycle-editor');
  editor.innerHTML = mapcycle.map((m) => `
    <div class="live-row">
      <input type="text" class="mapcycle-select" list="map-options" value="${m}" placeholder="ex: de_dust2 ou workshop/123456/nome" />
      <button type="button" class="secondary mapcycle-remove">Remover</button>
    </div>
  `).join('') + '<button type="button" id="mapcycle-add" class="secondary">+ Adicionar mapa</button>';

  editor.querySelectorAll('.mapcycle-remove').forEach((btn) => btn.addEventListener('click', (e) => {
    e.target.closest('.live-row').remove();
  }));
  document.getElementById('mapcycle-add').addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'live-row';
    row.innerHTML = `<input type="text" class="mapcycle-select" list="map-options" placeholder="ex: de_dust2 ou workshop/123456/nome" /><button type="button" class="secondary mapcycle-remove">Remover</button>`;
    row.querySelector('.mapcycle-remove').addEventListener('click', () => row.remove());
    editor.insertBefore(row, document.getElementById('mapcycle-add'));
  });
}

async function saveMapcycle() {
  const maps = [...document.querySelectorAll('.mapcycle-select')].map((s) => s.value);
  await api.setMapcycle(maps);
  alert('Rotação de mapas guardada.');
}

async function loadModes() {
  const { modes, activeMode } = await api.getModes();
  const liveSelect = document.getElementById('mode-select');
  const settingsSelect = document.getElementById('settings-mode-select');
  const options = Object.entries(modes).map(([key, m]) => `<option value="${key}" ${key === activeMode ? 'selected' : ''}>${m.label}</option>`).join('');
  liveSelect.innerHTML = options;
  settingsSelect.innerHTML = options;
}

function fieldLiveTag(entry) {
  return entry.liveApplicable
    ? '<span class="live-tag">● aplica-se já, se o RCON estiver ativo</span>'
    : '<span class="restart-tag">● só no próximo arranque</span>';
}

function renderField(entry, currentValue) {
  const value = currentValue !== undefined ? currentValue : entry.default;
  let input;
  if (entry.type === 'bool') {
    input = `<select data-key="${entry.key}"><option value="true" ${value ? 'selected' : ''}>Sim</option><option value="false" ${!value ? 'selected' : ''}>Não</option></select>`;
  } else if (entry.type === 'enum') {
    input = `<select data-key="${entry.key}">${entry.enumValues.map((o) => `<option value="${o.value}" ${Number(value) === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}</select>`;
  } else if (entry.type === 'int' || entry.type === 'float') {
    input = `<input type="number" data-key="${entry.key}" value="${value}" min="${entry.min ?? ''}" max="${entry.max ?? ''}" step="${entry.step ?? 1}" />`;
  } else {
    input = `<input type="text" data-key="${entry.key}" value="${value ?? ''}" />`;
  }
  return `<div class="field"><label>${entry.label} ${fieldLiveTag(entry)}</label>${input}</div>`;
}

function readFieldValue(entry, el) {
  if (entry.type === 'bool') return el.value === 'true';
  if (entry.type === 'enum' || entry.type === 'int') return Number(el.value);
  if (entry.type === 'float') return parseFloat(el.value);
  return el.value;
}

async function loadServerSettings() {
  const settings = await api.getServerSettings();
  const fields = convarsCache.convars.filter((c) => c.modes.includes('*'));
  const form = document.getElementById('server-settings-form');
  form.innerHTML = fields.map((f) => renderField(f, settings[f.key])).join('');
}

async function saveServerSettings() {
  const form = document.getElementById('server-settings-form');
  const fields = convarsCache.convars.filter((c) => c.modes.includes('*'));
  const changes = {};
  fields.forEach((entry) => {
    const el = form.querySelector(`[data-key="${entry.key}"]`);
    if (el) changes[entry.key] = readFieldValue(entry, el);
  });
  const result = await api.putServerSettings(changes);
  const feedback = document.getElementById('server-settings-feedback');
  feedback.textContent = result.warnings.length ? result.warnings.join(' ') : 'Guardado e aplicado.';
  feedback.className = result.warnings.length ? 'warning' : 'hint';
  refreshStatus();
}

async function loadModeSettings(mode) {
  if (!mode) return;
  const { fields, values, isCustom, activePresetId } = await api.getModeSettings(mode);
  const form = document.getElementById('mode-settings-form');
  form.innerHTML = fields.filter((f) => !f.modes.includes('*')).map((f) => renderField(f, values[f.key])).join('');
  form.dataset.mode = mode;
  form.dataset.dirty = 'false';
  form.querySelectorAll('input,select').forEach((el) => el.addEventListener('input', () => markModeDirty()));

  const badge = document.getElementById('mode-status-badge');
  if (isCustom) {
    badge.textContent = 'Custom (modificado)';
    badge.className = 'badge unmanaged';
  } else if (activePresetId) {
    const preset = (await api.getPresets()).presets.find((p) => p.id === activePresetId);
    badge.textContent = preset ? `Preset: ${preset.name}` : 'Preset';
    badge.className = 'badge running';
  } else {
    badge.textContent = 'Standard (Valve)';
    badge.className = 'badge running';
  }
}

function markModeDirty() {
  document.getElementById('mode-settings-form').dataset.dirty = 'true';
  const badge = document.getElementById('mode-status-badge');
  badge.textContent = 'Custom (não guardado)';
  badge.className = 'badge unmanaged';
}

async function saveAsPreset() {
  const form = document.getElementById('mode-settings-form');
  const mode = form.dataset.mode;
  const name = prompt('Nome para este preset (ex: "Torneio sexta-feira"):');
  if (!name) return;
  await saveModeSettings(); // garante que o que está no formulário foi gravado primeiro
  await api.savePreset(name, mode);
  await loadPresets();
  await loadModeSettings(mode);
  alert(`Preset "${name}" guardado.`);
}

async function loadPresets() {
  const { presets } = await api.getPresets();
  const list = document.getElementById('presets-list');
  if (!presets.length) {
    list.innerHTML = '<p class="hint">Ainda não guardaste nenhum preset.</p>';
    return;
  }
  list.innerHTML = presets.map((p) => `
    <div class="live-row" data-id="${p.id}">
      <span>${p.name} <span class="hint">(${settingsModeLabel(p.baseMode)})</span></span>
      <button type="button" class="live preset-apply">Aplicar</button>
      <button type="button" class="danger preset-delete">Apagar</button>
    </div>
  `).join('');
  list.querySelectorAll('.preset-apply').forEach((btn) => btn.addEventListener('click', async (e) => {
    const id = e.target.closest('[data-id]').dataset.id;
    const result = await api.applyPreset(id);
    showLiveFeedback(result);
    refreshStatus();
    loadModeSettings(document.getElementById('settings-mode-select').value);
  }));
  list.querySelectorAll('.preset-delete').forEach((btn) => btn.addEventListener('click', async (e) => {
    const id = e.target.closest('[data-id]').dataset.id;
    if (!confirm('Apagar este preset?')) return;
    await api.deletePreset(id);
    loadPresets();
  }));
}

function settingsModeLabel(mode) {
  return { competitive: 'Competitivo', casual: 'Casual', deathmatch: 'Deathmatch', custom: 'Custom' }[mode] || mode;
}

async function saveModeSettings() {
  const form = document.getElementById('mode-settings-form');
  const mode = form.dataset.mode;
  const fields = convarsCache.convars.filter((c) => !c.modes.includes('*'));
  const changes = {};
  fields.forEach((entry) => {
    const el = form.querySelector(`[data-key="${entry.key}"]`);
    if (el) changes[entry.key] = readFieldValue(entry, el);
  });
  const result = await api.putModeSettings(mode, changes);
  const feedback = document.getElementById('mode-settings-feedback');
  const parts = [];
  if (result.appliedLive.length) parts.push(`Aplicado ao vivo: ${result.appliedLive.join(', ')}.`);
  if (result.pendingNextLoad.length) parts.push(`Fica pendente até esse modo ser carregado: ${result.pendingNextLoad.join(', ')}.`);
  if (result.warnings.length) parts.push(...result.warnings);
  feedback.textContent = parts.join(' ') || 'Guardado.';
  feedback.className = result.warnings.length ? 'warning' : 'hint';
}

async function saveRawOverrides() {
  const text = document.getElementById('raw-overrides').value;
  const changes = {};
  text.split('\n').map((l) => l.trim()).filter(Boolean).forEach((line) => {
    const [key, ...rest] = line.split(/\s+/);
    if (key) changes[key] = rest.join(' ');
  });
  const mode = document.getElementById('settings-mode-select').value;
  await api.putModeSettings(mode, changes);
  alert('Overrides avançados guardados (aplicam-se ao gerar os ficheiros).');
}

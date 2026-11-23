// Schema único de todas as definições controláveis pelo painel.
// Adicionar um novo convar controlável é só acrescentar uma entrada aqui —
// nenhuma rota ou página deve ter listas hardcoded destas chaves.
//
// liveApplicable:
//   true  -> aplicado de imediato via RCON "set <key> <value>" quando o RCON
//            estiver disponível e o modo editado for o activeMode.
//   false -> nunca aplicado em runtime; grava só para o próximo arranque,
//            e a rota devolve um aviso explícito (liveApplicableReason).

const MODES = ['competitive', 'casual', 'deathmatch', 'custom'];

const CONVARS = [
  // --- Tempo ---
  { key: 'mp_roundtime_defuse', label: 'Tempo de ronda (bomba)', category: 'Tempo', type: 'float', min: 0.5, max: 10, step: 0.01, default: 1.92, modes: MODES, liveApplicable: true },
  { key: 'mp_roundtime', label: 'Tempo de ronda (genérico)', category: 'Tempo', type: 'float', min: 0.5, max: 10, step: 0.01, default: 1.92, modes: MODES, liveApplicable: true },
  { key: 'mp_freezetime', label: 'Tempo de compra (freezetime)', category: 'Tempo', type: 'int', min: 0, max: 60, step: 1, default: 15, modes: MODES, liveApplicable: true },
  { key: 'mp_timelimit', label: 'Limite de tempo do mapa (min, 0 = sem limite)', category: 'Tempo', type: 'int', min: 0, max: 120, step: 1, default: 0, modes: MODES, liveApplicable: true },

  // --- Aquecimento ---
  { key: 'mp_warmuptime', label: 'Duração máxima do aquecimento (seg)', category: 'Aquecimento', type: 'int', min: 5, max: 999999, step: 5, default: 999999, modes: MODES, liveApplicable: true },
  { key: 'mp_warmup_pausetimer', label: 'Pausar o temporizador de aquecimento', category: 'Aquecimento', type: 'bool', default: false, modes: MODES, liveApplicable: true },
  { key: 'mp_endwarmup_player_count', label: 'Nº de jogadores que termina o aquecimento', category: 'Aquecimento', type: 'int', min: 1, max: 64, step: 1, default: 2, modes: MODES, liveApplicable: true },
  { key: 'mp_warmuptime_all_players_connected', label: 'Contagem final após atingir esse nº (seg)', category: 'Aquecimento', type: 'int', min: 0, max: 600, step: 1, default: 6, modes: MODES, liveApplicable: true },

  // --- Rondas / vitória ---
  { key: 'mp_maxrounds', label: 'Nº de rondas da partida', category: 'Rondas', type: 'int', min: 0, max: 99, step: 1, default: 24, modes: MODES, liveApplicable: true },
  { key: 'mp_match_can_clinch', label: 'Permitir vitória antecipada (mercy rule)', category: 'Rondas', type: 'bool', default: true, modes: MODES, liveApplicable: true },
  { key: 'mp_match_restart_delay', label: 'Segundos até reiniciar após o fim da partida', category: 'Rondas', type: 'int', min: 1, max: 60, step: 1, default: 15, modes: MODES, liveApplicable: true },
  { key: 'mp_endmatch_votenextmap', label: 'Votação para o próximo mapa no fim da partida', category: 'Rondas', type: 'bool', default: false, modes: MODES, liveApplicable: true },

  // --- Economia ---
  { key: 'mp_free_armor', label: 'Colete/casco automático', category: 'Economia', type: 'enum',
    enumValues: [
      { value: 0, label: 'Compra manual' },
      { value: 1, label: 'Colete automático' },
      { value: 2, label: 'Colete + casco automático' },
    ], default: 0, modes: MODES, liveApplicable: true },
  { key: 'mp_buy_anywhere', label: 'Comprar em qualquer lugar do mapa', category: 'Economia', type: 'bool', default: false, modes: MODES, liveApplicable: true },
  { key: 'mp_startmoney', label: 'Dinheiro inicial', category: 'Economia', type: 'int', min: 0, max: 65000, step: 100, default: 800, modes: MODES, liveApplicable: true },
  { key: 'mp_maxmoney', label: 'Dinheiro máximo', category: 'Economia', type: 'int', min: 0, max: 65000, step: 500, default: 16000, modes: MODES, liveApplicable: true },

  // --- Jogadores / bots ---
  { key: 'bot_quota', label: 'Nº de bots', category: 'Jogadores', type: 'int', min: 0, max: 32, step: 1, default: 0, modes: MODES, liveApplicable: true },
  { key: 'mp_autokick', label: 'Kick automático por idle/team-damage', category: 'Jogadores', type: 'bool', default: false, modes: MODES, liveApplicable: true },
  { key: 'mp_forcecamera', label: 'Câmara de morte restrita à própria equipa', category: 'Jogadores', type: 'enum',
    enumValues: [
      { value: 0, label: 'Ver qualquer jogador' },
      { value: 1, label: 'Só a própria equipa (sem death cam do inimigo)' },
      { value: 2, label: 'Nenhum espetador' },
    ], default: 1, modes: MODES, liveApplicable: true },
  { key: 'mp_friendlyfire', label: 'Dano entre aliados (friendly fire)', category: 'Jogadores', type: 'bool', default: true, modes: MODES, liveApplicable: true },

  // --- Servidor (nível global, não por modo) ---
  { key: 'hostname', label: 'Nome do servidor', category: 'Servidor', type: 'string', default: 'Servidor LAN CS2', modes: ['*'], liveApplicable: true },
  { key: 'sv_password', label: 'Password do servidor', category: 'Servidor', type: 'string', default: '', modes: ['*'], liveApplicable: true },
  { key: 'maxplayers', label: 'Nº máximo de jogadores (slots)', category: 'Servidor', type: 'int', min: 2, max: 64, step: 1, default: 15, modes: ['*'], liveApplicable: false, liveApplicableReason: 'viaRestartOnly' },
  { key: 'port', label: 'Porta do servidor', category: 'Servidor', type: 'int', min: 1024, max: 65535, step: 1, default: 27015, modes: ['*'], liveApplicable: false, liveApplicableReason: 'viaRestartOnly' },
  { key: 'rcon_password', label: 'Password RCON', category: 'Servidor', type: 'string', default: '', modes: ['*'], liveApplicable: false, liveApplicableReason: 'viaRestartOnly' },
];

const BY_KEY = Object.fromEntries(CONVARS.map((c) => [c.key, c]));

function get(key) {
  return BY_KEY[key];
}

function forMode(mode) {
  return CONVARS.filter((c) => c.modes.includes('*') || c.modes.includes(mode));
}

function isLiveApplicable(key) {
  const entry = BY_KEY[key];
  return Boolean(entry && entry.liveApplicable);
}

module.exports = { CONVARS, MODES, get, forMode, isLiveApplicable };

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
  // --- Tempos de ronda ---
  { key: 'mp_roundtime_defuse', label: 'Tempo de ronda (bomba)', category: 'Tempos de ronda', type: 'float', min: 0.5, max: 10, step: 0.01, default: 1.92, modes: MODES, liveApplicable: true },
  { key: 'mp_roundtime', label: 'Tempo de ronda (genérico)', category: 'Tempos de ronda', type: 'float', min: 0.5, max: 10, step: 0.01, default: 1.92, modes: MODES, liveApplicable: true },
  { key: 'mp_freezetime', label: 'Tempo de compra (freezetime)', category: 'Tempos de ronda', type: 'int', min: 0, max: 60, step: 1, default: 15, modes: MODES, liveApplicable: true },
  { key: 'mp_timelimit', label: 'Limite de tempo do mapa (min, 0 = sem limite)', category: 'Tempos de ronda', type: 'int', min: 0, max: 120, step: 1, default: 0, modes: MODES, liveApplicable: true },

  // --- Aquecimento ---
  // mp_warmuptime / mp_warmup_pausetimer / mp_endwarmup_player_count sao
  // houseRule: true -> regra geral do servidor (ver nota mais abaixo em
  // "Jogadores / bots"). Garantem, independentemente do preset/modo ativo,
  // que o jogo fica em aquecimento a aguardar jogadores em vez de arrancar
  // por tempo ou com poucos jogadores (confirmado nesta sessao que
  // mp_warmup_pausetimer=1 bloqueia a transicao "termina ao atingir N
  // jogadores", por isso forca-se sempre a 0 aqui tambem).
  { key: 'mp_warmuptime', label: 'Duração máxima do aquecimento (seg, alto = só acaba pelo nº de jogadores)', category: 'Aquecimento', type: 'int', min: 5, max: 999999, step: 5, default: 999999, modes: MODES, liveApplicable: true, houseRule: true },
  { key: 'mp_warmup_pausetimer', label: 'Pausar o temporizador de aquecimento', category: 'Aquecimento', type: 'bool', default: false, modes: MODES, liveApplicable: true, houseRule: true },
  { key: 'mp_endwarmup_player_count', label: 'Nº de jogadores que termina o aquecimento e começa o jogo', category: 'Aquecimento', type: 'int', min: 1, max: 64, step: 1, default: 10, modes: MODES, liveApplicable: true, houseRule: true },
  { key: 'mp_warmuptime_all_players_connected', label: 'Contagem final após atingir esse nº (seg)', category: 'Aquecimento', type: 'int', min: 0, max: 600, step: 1, default: 6, modes: MODES, liveApplicable: true },

  // --- Rondas / vitória ---
  { key: 'mp_maxrounds', label: 'Nº de rondas da partida', category: 'Rondas', type: 'int', min: 0, max: 99, step: 1, default: 24, modes: MODES, liveApplicable: true },
  { key: 'mp_match_can_clinch', label: 'Permitir vitória antecipada (mercy rule)', category: 'Rondas', type: 'bool', default: true, modes: MODES, liveApplicable: true },
  { key: 'mp_match_restart_delay', label: 'Segundos até reiniciar após o fim da partida', category: 'Rondas', type: 'int', min: 1, max: 60, step: 1, default: 15, modes: MODES, liveApplicable: true },
  { key: 'mp_endmatch_votenextmap', label: 'Votação para o próximo mapa no fim da partida', category: 'Rondas', type: 'bool', default: true, modes: MODES, liveApplicable: true },
  { key: 'mp_endmatch_votenextmap_keepcurrent', label: 'Incluir o mapa atual nas opções de voto', category: 'Rondas', type: 'bool', default: true, modes: MODES, liveApplicable: true },
  { key: 'mp_endmatch_votenextleveltime', label: 'Tempo para votar o próximo mapa (seg)', category: 'Rondas', type: 'int', min: 5, max: 60, step: 5, default: 20, modes: MODES, liveApplicable: true },

  // --- Economia (armas e dinheiro) ---
  { key: 'mp_free_armor', label: 'Colete/casco automático', category: 'Economia (armas e dinheiro)', type: 'enum',
    enumValues: [
      { value: 0, label: 'Compra manual' },
      { value: 1, label: 'Colete automático' },
      { value: 2, label: 'Colete + casco automático' },
    ], default: 0, modes: MODES, liveApplicable: true },
  { key: 'mp_buy_anywhere', label: 'Comprar em qualquer lugar do mapa', category: 'Economia (armas e dinheiro)', type: 'bool', default: false, modes: MODES, liveApplicable: true },
  { key: 'mp_startmoney', label: 'Dinheiro inicial', category: 'Economia (armas e dinheiro)', type: 'int', min: 0, max: 65000, step: 100, default: 800, modes: MODES, liveApplicable: true },
  { key: 'mp_maxmoney', label: 'Dinheiro máximo', category: 'Economia (armas e dinheiro)', type: 'int', min: 0, max: 65000, step: 500, default: 16000, modes: MODES, liveApplicable: true },

  // --- Pausas ---
  // Confirmado nesta sessao via "find timeout"/"find pause" no servidor real
  // (nao via documentacao de terceiros): sv_vote_issue_timeout_allowed e
  // sv_vote_issue_pause_match_allowed NAO EXISTEM nesta versao do CS2 - sao
  // strings residuais no binario, mas nao convars registados. O mecanismo
  // real e: jogadores chamam "timeout_ct_start"/"timeout_terrorist_start"
  // (comando direto, sem votacao) para pedir pausa tactica, e
  // "mp_pause_match" para pausa tecnica - ambos ja funcionam sem qualquer
  // destes convars, desde que sv_vote_issue_pause_match_spec_only esteja a 0.
  { key: 'sv_vote_issue_pause_match_spec_only', label: 'Só admins/espetadores podem pausar (desliga para permitir aos jogadores)', category: 'Pausas', type: 'bool', default: false, modes: ['competitive', 'custom'], liveApplicable: true },
  { key: 'mp_team_timeout_time', label: 'Duração de cada pausa táctica (seg)', category: 'Pausas', type: 'int', min: 10, max: 180, step: 5, default: 60, modes: ['competitive', 'custom'], liveApplicable: true },
  { key: 'mp_team_timeout_max', label: 'Nº de pausas tácticas por equipa, por partida', category: 'Pausas', type: 'int', min: 0, max: 10, step: 1, default: 1, modes: ['competitive', 'custom'], liveApplicable: true },
  { key: 'sv_matchpause_auto_5v5', label: 'Pausar automaticamente se uma equipa ficar incompleta (<5)', category: 'Pausas', type: 'bool', default: false, modes: ['competitive', 'custom'], liveApplicable: true },

  // --- Jogadores / bots ---
  // houseRule: true -> regra geral do servidor, aplica-se SEMPRE, independente
  // de qual preset/modo está ativo (ao contrário dos restantes campos acima,
  // que só valem para o modo que está a ser editado). Vive em
  // server.json.houseRules, nunca em <mode>.json, e é escrita em cima de
  // qualquer preset ao gerar cada gamemode_X.cfg.
  { key: 'mp_limitteams', label: 'Diferença máxima permitida entre equipas (0 = sem limite)', category: 'Jogadores', type: 'int', min: 0, max: 10, step: 1, default: 2, modes: MODES, liveApplicable: true, houseRule: true },
  { key: 'mp_autoteambalance', label: 'Equilibrar equipas automaticamente (troca jogadores)', category: 'Jogadores', type: 'bool', default: true, modes: MODES, liveApplicable: true, houseRule: true },
  { key: 'bot_quota', label: 'Nº de bots', category: 'Jogadores', type: 'int', min: 0, max: 32, step: 1, default: 0, modes: MODES, liveApplicable: true },
  // Trava a equipa que os bots escolhem a partir de agora (bots ja em jogo
  // nao mudam so por isto - usar "mover bot de equipa" na aba Jogadores).
  { key: 'bot_join_team', label: 'Equipa dos bots (novos bots a entrar)', category: 'Jogadores', type: 'enum',
    enumValues: [
      { value: 'any', label: 'Qualquer equipa (equilibra automaticamente)' },
      { value: 'T', label: 'Só Terrorista' },
      { value: 'CT', label: 'Só Contra-Terrorista' },
    ], default: 'any', modes: MODES, liveApplicable: true },
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
  return CONVARS.filter((c) => !c.houseRule && (c.modes.includes('*') || c.modes.includes(mode)));
}

function houseRules() {
  return CONVARS.filter((c) => c.houseRule);
}

function isLiveApplicable(key) {
  const entry = BY_KEY[key];
  return Boolean(entry && entry.liveApplicable);
}

module.exports = { CONVARS, MODES, get, forMode, houseRules, isLiveApplicable };

# CS2 Control Panel

Painel web para controlar o servidor dedicado CS2 sem precisar de editar ficheiros `.cfg` à mão.

## Instalação

```
npm install
```

Copia `.env.example` para `.env.development` (teste) ou `.env.production` (servidor real) e preenche `CS2_ROOT` e `CS2_GAME_PORT`.

```
set NODE_ENV=development   (ou production)
npm start
```

Abre `http://127.0.0.1:3000`. Na primeira utilização, cria a password de administrador.

## Como funciona

- As definições reais vivem em `config/server.json` e `config/gamemodes/*.json` — nunca editar os `.cfg` do servidor à mão, eles são **gerados** a partir destes JSON (botão "Reaplicar configurações" reconstrói tudo, útil depois de um `steamcmd ... validate`).
- Ações como trocar de mapa, reiniciar a partida (zerar placar) ou trocar de modo aplicam-se **ao vivo via RCON, sem desligar ninguém**, sempre que o RCON estiver configurado (define uma password RCON em "Definições do servidor" e reinicia uma vez). Até isso acontecer, essas ações ficam pendentes para o próximo arranque.
- Slots (nº de jogadores) e porta nunca são aplicáveis em runtime — exigem sempre um reinício do processo.

## Privilégios

A gestão da firewall (`src/core/firewall.js`) precisa de permissões de Administrador. Corre o `npm start` num terminal elevado, ou configura uma Tarefa Agendada com "Run with highest privileges" no logon.

## Testar sem risco

Nunca apontar `CS2_ROOT` diretamente para o servidor em produção sem testar primeiro contra uma instalação descartável (ver plano de implementação em `.claude/plans/` para o procedimento completo).

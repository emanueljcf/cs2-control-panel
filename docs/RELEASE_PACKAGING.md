# Notas — Empacotar uma release "um clique"

Status: **parcialmente implementado**. O essencial já funciona e foi testado (build isolado, nunca tocou no servidor de produção nem no painel em execução):

- `scripts/build-release.ps1` — monta `dist/release/` com Node.js portátil, a app + dependências (`npm install --omit=dev`), e o SteamCMD incluído. Testado de ponta a ponta (arranca com o Node portátil, responde em HTTP).
- `release-assets/Iniciar.bat` — pede admin automaticamente, cria `.env.production` na primeira vez, **cria um atalho "CS2 Control Panel" no ambiente de trabalho na primeira vez** (idempotente — não recria se já existir), arranca o painel com o Node portátil, espera a porta e abre o browser sozinho.
- `release-assets/Instalar-Servidor-CS2.bat` — corre o SteamCMD incluído para instalar/atualizar o servidor dedicado.
- `release-assets/LEIA-ME.txt` — instruções para quem for usar.
- **Arranque automático do servidor CS2** (`src/server.js`) — sempre que o painel arranca (pelo `Iniciar.bat`, pelo atalho, ou por uma Tarefa Agendada no logon), tenta logo arrancar também o servidor CS2 dedicado, sem precisar de clicar em "Arrancar" no painel. Não bloqueia o arranque do painel e não falha visivelmente se o CS2 ainda não estiver instalado — só regista o aviso na consola. Testado (ambiente de teste, porta alternativa): painel e servidor CS2 arrancam juntos com um único comando.
- `Iniciar-Painel.bat` (na raiz do projeto, não faz parte da release) — equivalente ao `Iniciar.bat` mas para esta máquina de desenvolvimento/produção (usa o Node.js já instalado no sistema em vez do Node portátil). Já tem um atalho "CS2 Control Panel" no ambiente de trabalho desta máquina.

**Ainda por fazer:**
- Assistente de primeira utilização *dentro* do painel (em vez do `.bat` separado para o SteamCMD) — ver secção 3 abaixo, continua por implementar.
- Reaplicar configs automaticamente depois de um `validate` correndo através do `Instalar-Servidor-CS2.bat` (hoje é preciso abrir o painel e carregar manualmente em "Reaplicar configurações").
- Empacotar tudo num único `.zip` para distribuição (hoje fica só na pasta `dist/release/`, não implementado o passo de compactar).
- Instalador "a sério" (Inno Setup) — ainda não iniciado, ver secção 7.

## Objetivo

Alguém sem Claude Code e sem conhecimentos técnicos deve conseguir, a partir de uma pasta/instalador:
1. Correr uma única coisa (ex. `Iniciar.bat` ou um instalador `Setup.exe`).
2. Ficar com o Node a correr, o servidor CS2 instalado (e os mods, quando essa parte for desbloqueada), e o browser a abrir sozinho em `http://127.0.0.1:3000`.
3. Nunca ter de abrir uma consola, editar um `.env` à mão, ou saber o que é SteamCMD.

## Peças em falta

1. **Empacotar o painel sem exigir Node.js pré-instalado**
   - Opção recomendada: embutir um Node.js portátil (zip "embeddable") dentro da pasta da release.
   - Alternativa: compilar para um único `.exe` via Node Single Executable Applications — mais "limpo" visualmente, mas mais trabalho de build e menos testado.

2. **Lançador** (`Iniciar.bat` ou pequeno `.exe`)
   - Verifica se está elevado (Administrador); se não, auto-eleva via UAC (necessário para a gestão da firewall).
   - Arranca `node src/server.js`.
   - Espera a porta do painel (`PANEL_PORT`) ficar disponível.
   - Abre o browser por defeito em `http://127.0.0.1:3000` (`start http://127.0.0.1:3000`).

3. **Assistente de primeira utilização dentro do próprio painel** (em vez de instalador separado a despejar texto em consola)
   - Se `CS2_ROOT` não existir/não estiver configurado, a app mostra uma página "Instalação inicial": escolher pasta de instalação, botão "Instalar".
   - O backend corre o SteamCMD (processo já validado nesta sessão — ver comandos abaixo) e transmite progresso para o browser (polling de um endpoint de progresso, ou SSE).
   - A mesma lógica de página serve para instalar MetaMod/CounterStrikeSharp/MatchZy, quando essa parte for desbloqueada (ver secção própria).

4. **SteamCMD incluído na release**
   - É pequeno (~1.5MB), vale a pena incluir diretamente em vez de descarregar no primeiro arranque.
   - URL oficial usado nesta sessão: `https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip`

5. **Download do servidor CS2 (~70GB via SteamCMD, App ID 730, login anónimo)**
   - Não há como embutir isto na release (é conteúdo da Valve) nem acelerar — mas a barra de progresso deve estar visível na UI em vez de parecer "pendurado".
   - Comando validado nesta sessão:
     ```
     steamcmd.exe +force_install_dir "<pasta>" +login anonymous +app_update 730 validate +quit
     ```
   - Atenção ao bug confirmado nesta sessão: correr `validate` **repõe os `gamemode_*.cfg` e `server.cfg` para o estado original da Valve**, apagando customizações. O painel já lida com isto (fonte de verdade em JSON, botão "Reaplicar configurações"), mas o assistente de instalação deve sempre reaplicar as configs depois de qualquer `validate`.

6. **Firewall**
   - Já tratado pelo `src/core/firewall.js` existente (idempotente, remove regras de bloqueio residuais). O lançador só precisa de garantir que o processo corre elevado para isto funcionar.

7. **Formato de distribuição**
   - Simples: `.zip` para extrair, com `Iniciar.bat` à vista.
   - Mais profissional: instalador real (ex. Inno Setup) com assistente, atalho no Desktop/Menu Iniciar, manifesto a pedir admin automaticamente, desinstalador.
   - Decisão a tomar nessa altura, não urgente agora.

8. **(Opcional) Arranque totalmente automático ao ligar o PC, sem clicar em nada**
   - Já implementado o essencial: um clique no atalho do ambiente de trabalho arranca painel + servidor CS2 juntos (ver acima). Isto ainda exige esse clique depois de reiniciar a máquina.
   - Em falta, se for preciso zero cliques: Tarefa Agendada a correr `Iniciar.bat`/`Iniciar-Painel.bat` no logon do Windows.

## Bloqueado / a retomar antes disto fazer sentido por completo

- **Ronda de faca (MatchZy)**: instalação de MetaMod:Source 2.0 (build 1491, dev branch) + CounterStrikeSharp (via bundle MatchZy 0.9.3 "with-cssharp") causou um **access violation** no arranque do CS2 na instância de teste (ficheiros ainda guardados localmente em `Downloads\cs2-plugins`, e já copiados mas desativados em `C:\cs2server-test` — o `gameinfo.gi` foi revertido para a instância arrancar normalmente). Antes de incluir isto no instalador automático, é preciso encontrar uma combinação de versões estável.
  - MetaMod usado: `https://github.com/alliedmodders/metamod-source/releases/download/2.0.0.1491/mmsource-2.0.0-git1491-windows.zip`
  - MatchZy usado: `https://github.com/shobhit-pathak/MatchZy/releases/download/0.9.3/MatchZy-0.9.3-with-cssharp-windows.zip`
  - MatchZy tem ronda de faca nativa e ativa por defeito (`matchzy_knife_enabled_default true`, `matchzy_autostart_mode 1`) — vale a pena manter como plugin de escolha quando a incompatibilidade for resolvida.

## Pré-requisito antes de sequer começar isto

- Branch atual (`feature/presets-pause-knife`) revista, testada e integrada em `master`.
- RCON ativado no servidor real (falta o único reinício de que já se falou).

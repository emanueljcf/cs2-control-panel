const os = require('os');

// O motor do CS2 liga o socket de jogo/RCON ao IP da rede local da máquina,
// nunca a 127.0.0.1 (confirmado nesta sessão) — por isso este é também o IP
// que os jogadores devem usar para o "connect".
function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

module.exports = { getLanIp };

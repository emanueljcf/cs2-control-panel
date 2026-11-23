const express = require('express');
const session = require('express-session');
const path = require('path');
const paths = require('./config/paths');
const requireAuth = require('./middleware/requireAuth');

const app = express();

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'troca-isto',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'strict', maxAge: 24 * 60 * 60 * 1000 },
}));

app.use(express.static(path.join(paths.PROJECT_ROOT, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/status', requireAuth, require('./routes/status'));
app.use('/api/server', requireAuth, require('./routes/server'));
app.use('/api/maps', requireAuth, require('./routes/maps'));
app.use('/api/mode', requireAuth, require('./routes/mode'));
app.use('/api/match', requireAuth, require('./routes/match'));
app.use('/api/settings', requireAuth, require('./routes/settings'));
app.use('/api/convars', requireAuth, require('./routes/convars'));
app.use('/api/presets', requireAuth, require('./routes/presets'));

app.listen(paths.PANEL_PORT, '127.0.0.1', () => {
  console.log(`CS2 Control Panel a correr em http://127.0.0.1:${paths.PANEL_PORT}`);
  console.log(`A controlar o servidor em: ${paths.CS2_ROOT} (porta ${paths.CS2_GAME_PORT})`);
});

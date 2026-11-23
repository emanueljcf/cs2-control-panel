const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginForm = document.getElementById('login-form');
const loginHint = document.getElementById('login-hint');
const loginError = document.getElementById('login-error');
const loginPasswordInput = document.getElementById('login-password');

let isSetupMode = false;

async function checkAuth() {
  const status = await api.authStatus();
  isSetupMode = !status.setUp;
  loginHint.textContent = isSetupMode
    ? 'Primeira utilização: define a password de administrador (mínimo 8 caracteres).'
    : '';
  if (status.authenticated) {
    showDashboard();
  } else {
    showLogin();
  }
}

function showLogin() {
  loginView.classList.remove('hidden');
  dashboardView.classList.add('hidden');
}

function showDashboard() {
  loginView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  initDashboard();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const password = loginPasswordInput.value;
  try {
    if (isSetupMode) {
      await api.setup(password);
    } else {
      await api.login(password);
    }
    loginPasswordInput.value = '';
    showDashboard();
  } catch (err) {
    loginError.textContent = isSetupMode ? 'Não foi possível criar a password.' : 'Password incorreta.';
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await api.logout();
  showLogin();
});

window.addEventListener('unauthenticated', showLogin);

checkAuth();

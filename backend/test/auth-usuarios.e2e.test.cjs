const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

const HOST = '127.0.0.1';
const PORT = 3101;
const BASE_URL = `http://${HOST}:${PORT}`;

let serverProcess;
let adminToken = '';
let vendedorToken = '';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHealth(maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return;
    } catch {
      // no-op
    }
    await sleep(250);
  }
  throw new Error('Backend não respondeu /health no tempo esperado');
}

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  return { response, data };
}

test.before(async () => {
  serverProcess = spawn('node', ['dist/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(PORT),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', () => {});
  serverProcess.stderr.on('data', () => {});

  await waitForHealth();
});

test.after(async () => {
  if (!serverProcess || serverProcess.killed) return;
  serverProcess.kill('SIGTERM');
  await sleep(300);
  if (!serverProcess.killed) {
    serverProcess.kill('SIGKILL');
  }
});

test('auth + usuarios: login, autorização e gerenciamento', async () => {
  const ts = Date.now();

  const loginInvalido = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'senha-errada' }),
  });
  assert.equal(loginInvalido.response.status, 401);

  const loginAdmin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  assert.equal(loginAdmin.response.status, 200);
  assert.ok(loginAdmin.data.token);
  assert.equal(loginAdmin.data.user.perfil, 'admin');
  adminToken = loginAdmin.data.token;

  const semToken = await request('/usuarios');
  assert.equal(semToken.response.status, 401);

  const listarAdmin = await request('/usuarios?page=1&limit=5', { token: adminToken });
  assert.equal(listarAdmin.response.status, 200);
  assert.ok(Array.isArray(listarAdmin.data.data));

  const vendedorLogin = `vend_e2e_${ts}`;
  const vendedorSenha = 'vendedor123';

  const criarVendedor = await request('/usuarios', {
    method: 'POST',
    token: adminToken,
    body: JSON.stringify({
      nome: `Vendedor E2E ${ts}`,
      login: vendedorLogin,
      senha: vendedorSenha,
      perfil: 'vendedor',
      ativo: true,
    }),
  });
  assert.equal(criarVendedor.response.status, 201);
  assert.equal(criarVendedor.data.perfil, 'vendedor');
  assert.ok(criarVendedor.data.id);

  const vendedorId = Number(criarVendedor.data.id);

  const loginVendedor = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: vendedorLogin, password: vendedorSenha }),
  });
  assert.equal(loginVendedor.response.status, 200);
  assert.equal(loginVendedor.data.user.perfil, 'vendedor');
  vendedorToken = loginVendedor.data.token;

  const vendedorSemPermissao = await request('/usuarios', { token: vendedorToken });
  assert.equal(vendedorSemPermissao.response.status, 403);

  const atualizarVendedor = await request(`/usuarios/${vendedorId}`, {
    method: 'PATCH',
    token: adminToken,
    body: JSON.stringify({
      nome: `Vendedor E2E Atualizado ${ts}`,
      ativo: false,
    }),
  });
  assert.equal(atualizarVendedor.response.status, 200);
  assert.equal(atualizarVendedor.data.ativo, false);

  const loginInativo = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: vendedorLogin, password: vendedorSenha }),
  });
  assert.equal(loginInativo.response.status, 403);
});

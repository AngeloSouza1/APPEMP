const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

const HOST = '127.0.0.1';
const PORT = 3100;
const BASE_URL = `http://${HOST}:${PORT}`;

let serverProcess;
let authToken = '';

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

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
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

  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  assert.equal(login.response.status, 200);
  assert.ok(login.data.token);
  authToken = login.data.token;
});

test.after(async () => {
  if (!serverProcess || serverProcess.killed) return;
  serverProcess.kill('SIGTERM');
  await sleep(300);
  if (!serverProcess.killed) {
    serverProcess.kill('SIGKILL');
  }
});

test('fluxo E2E de pedidos: criar, editar, efetivar e filtrar', async () => {
  const ts = Date.now();
  const dataPedido = '2026-02-10';

  const rota = await request('/rotas', {
    method: 'POST',
    body: JSON.stringify({ nome: `Rota E2E Test ${ts}` }),
  });
  assert.equal(rota.response.status, 201);
  assert.ok(rota.data.id);

  const cliente = await request('/clientes', {
    method: 'POST',
    body: JSON.stringify({
      codigo_cliente: `CLTTEST${ts}`,
      nome: `Cliente E2E Test ${ts}`,
      rota_id: rota.data.id,
    }),
  });
  assert.equal(cliente.response.status, 201);
  assert.ok(cliente.data.id);

  const produto = await request('/produtos', {
    method: 'POST',
    body: JSON.stringify({
      codigo_produto: `PRDTEST${ts}`,
      nome: `Produto E2E Test ${ts}`,
      embalagem: 'UN',
      preco_base: 10,
    }),
  });
  assert.equal(produto.response.status, 201);
  assert.ok(produto.data.id);

  const pedidoCriado = await request('/pedidos', {
    method: 'POST',
    body: JSON.stringify({
      cliente_id: cliente.data.id,
      rota_id: rota.data.id,
      data: dataPedido,
      status: 'EM_ESPERA',
      itens: [
        {
          produto_id: produto.data.id,
          quantidade: 3,
          embalagem: 'UN',
          valor_unitario: 15.5,
        },
      ],
    }),
  });
  assert.equal(pedidoCriado.response.status, 201);
  assert.equal(pedidoCriado.data.status, 'EM_ESPERA');

  const pedidoId = pedidoCriado.data.id;

  const pedidoAtualizado = await request(`/pedidos/${pedidoId}`, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'CONFERIR',
      itens: [
        {
          produto_id: produto.data.id,
          quantidade: 4,
          embalagem: 'UN',
          valor_unitario: 20,
        },
      ],
    }),
  });
  assert.equal(pedidoAtualizado.response.status, 200);
  assert.equal(pedidoAtualizado.data.status, 'CONFERIR');
  assert.equal(Number(pedidoAtualizado.data.valor_total), 80);

  const statusAtualizado = await request(`/pedidos/${pedidoId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'EFETIVADO', valor_efetivado: 80 }),
  });
  assert.equal(statusAtualizado.response.status, 200);
  assert.equal(statusAtualizado.data.status, 'EFETIVADO');
  assert.equal(Number(statusAtualizado.data.valor_efetivado), 80);

  const filtroEfetivado = await request('/pedidos?status=EFETIVADO');
  assert.equal(filtroEfetivado.response.status, 200);
  assert.ok(filtroEfetivado.data.some((p) => Number(p.id) === Number(pedidoId)));

  const filtroOk = await request('/pedidos?status=ok');
  assert.equal(filtroOk.response.status, 200);
  assert.ok(filtroOk.data.some((p) => Number(p.id) === Number(pedidoId)));

  const paginadoBusca = await request('/pedidos/paginado?q=E2E Test&page=1&limit=5');
  assert.equal(paginadoBusca.response.status, 200);
  assert.ok(Array.isArray(paginadoBusca.data.data));
  assert.ok(typeof paginadoBusca.data.total === 'number');
});

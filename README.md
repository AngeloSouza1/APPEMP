## APPEMP – Sistema de Pedidos e Rotas

Este projeto é a nova versão do app da sua empresa, baseado nos dados da planilha `AppStaClara3` e no app atual do AppSheet (`AppStaClara2`).

### Stack principal

- **Backend**: Node.js + TypeScript (Express)
- **Web Admin**: Next.js + TypeScript + Tailwind CSS
- **Mobile Vendedores**: React Native (Expo) + TypeScript
- **Banco de dados**: PostgreSQL

### Estrutura do projeto

- `backend/`: API em Node.js/TypeScript que centraliza pedidos, clientes, produtos, rotas etc.
- `web/`: painel administrativo em Next.js/TypeScript.
- `mobile/`: app de vendedores em React Native/TypeScript (Expo).

---

## Como rodar o projeto

### 1. Backend

Na pasta `backend/`:

```bash
cd backend
npm install
npm run dev
```

O servidor ficará disponível em `http://localhost:3000`.

#### Variáveis de ambiente necessárias

Crie um arquivo `.env` dentro de `backend/` com:

```bash
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=appemp
DB_USER=SEU_USUARIO_POSTGRES
DB_PASSWORD=SUA_SENHA_POSTGRES

AUTH_USER=admin
AUTH_PASSWORD=admin123
AUTH_NAME=Administrador
AUTH_PERFIL=admin
JWT_SECRET=troque-para-um-segredo-forte
JWT_EXPIRES_IN=8h
```

#### Configuração do banco de dados

1. Crie o banco de dados:
```bash
psql -h localhost -U SEU_USUARIO -c "CREATE DATABASE appemp;"
```

2. Execute o script de criação das tabelas:
```bash
psql -h localhost -U SEU_USUARIO -d appemp -f db-schema.sql
```

3. Execute a migração (se necessário):
```bash
psql -h localhost -U SEU_USUARIO -d appemp -f migration-add-atualizado-em.sql
psql -h localhost -U SEU_USUARIO -d appemp -f migration-normalizar-status-pedidos.sql
psql -h localhost -U SEU_USUARIO -d appemp -f migration-auth-rbac-auditoria.sql
```

### 2. Front-end Web

Na pasta `web/`:

```bash
cd web
npm install
npm run dev
```

O front-end ficará disponível em `http://localhost:3001` (ou outra porta, conforme o Next.js indicar).

#### Variáveis de ambiente

Crie um arquivo `.env.local` dentro de `web/` com:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 3. Mobile (Expo)

Na pasta `mobile/`:

```bash
cd mobile
npm install
npm run start
```

Depois abra no emulador (Android/iOS) ou no Expo Go.

#### Variável de ambiente (mobile)

Use `EXPO_PUBLIC_API_URL` para apontar para o backend.

Exemplos:
- emulador Android: `http://10.0.2.2:3000`
- iOS simulator: `http://localhost:3000`
- dispositivo físico: `http://SEU_IP_LOCAL:3000`

Rodando com variável:

```bash
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 npm run start
```

Fluxo atual no mobile:
- login com JWT
- listagem paginada de pedidos
- busca por texto e filtro por data (`dd/mm/aaaa` ou `yyyy-mm-dd`)
- toque no card para abrir detalhes do pedido e itens

---

## Endpoints da API

### Health Check
- `GET /health` → checa se o backend está funcionando

### Autenticação
- `POST /auth/login` → gera token JWT
- `GET /auth/me` → retorna usuário autenticado
- `POST /auth/change-password` → troca senha do usuário logado
- Todas as rotas de negócio exigem `Authorization: Bearer <token>`

### Usuários (admin)
- `GET /usuarios` → lista usuários
- `POST /usuarios` → cria novo usuário
- `PATCH /usuarios/:id` → atualiza usuário (perfil, ativo, senha etc.)

### Rotas
- `GET /rotas` → lista todas as rotas
- `POST /rotas` → cria uma nova rota

### Clientes
- `GET /clientes` → lista todos os clientes
- `POST /clientes` → cria um novo cliente

### Produtos
- `GET /produtos` → lista todos os produtos
- `POST /produtos` → cria um novo produto

### Pedidos
- `GET /pedidos` → lista pedidos (com filtros opcionais: `?data=2026-02-10&rota_id=1&status=EM_ESPERA`)
- `GET /pedidos/paginado` → lista pedidos com paginação e busca (`?page=1&limit=10&q=texto`)
- `GET /pedidos/:id` → busca detalhes de um pedido específico
- `POST /pedidos` → cria um novo pedido
- `PUT /pedidos/:id` → atualiza um pedido completo
- `PATCH /pedidos/:id/status` → atualiza apenas o status do pedido

### Fluxo no painel de pedidos (web)
- Na tela `/pedidos`, usuários `admin` e `backoffice` podem usar **Cadastro Rápido** para:
  - criar rota
  - criar cliente (com rota opcional)
- Após criar cliente, o botão **Ir para Novo Pedido** abre `/pedidos/novo` com:
  - `cliente_id` pré-selecionado
  - `rota_id` pré-selecionado (quando existir)

### Trocas
- `GET /pedidos/:id/trocas` → lista trocas de um pedido
- `POST /trocas` → cria uma nova troca

---

## Testes automatizados

Na pasta `backend/`:

```bash
npm test
```

Esse comando roda um E2E automatizado com:
- `auth-usuarios.e2e.test.cjs`
  - login válido/inválido
  - autorização por perfil (`admin` x `vendedor`)
  - criação e atualização de usuários
- `pedidos.e2e.test.cjs`
  - criação de rota/cliente/produto
  - criação de pedido
  - edição de pedido
  - atualização de status
  - validação de filtros (`EFETIVADO` e `ok`)

Na pasta `web/`:

```bash
npm run test
```

Esse comando roda testes de frontend com Vitest:
- `lib/pedidos.test.ts`
  - validações e montagem de payload de pedido
- `components/PedidoDadosForm.test.tsx`
  - render e callbacks dos campos de dados do pedido
- `components/PedidoItensEditor.test.tsx`
  - busca de produto, callbacks e estados de remoção
- `app/pedidos/novo/page.test.tsx`
  - validação de formulário, submit de criação e pré-seleção por query params
- `app/pedidos/page.test.tsx`
  - cadastro rápido de cliente e navegação para `/pedidos/novo` com parâmetros
- `app/pedidos/[id]/page.test.tsx`
  - validação e submit de atualização de pedido/status

## Checklist de release

Antes de publicar, execute:

```bash
# backend
cd backend
npm run build
npm test

# web
cd ../web
npm run test
npm run lint
npm run build
```

Checklist funcional:
- [ ] Fluxo de pedidos validado na UI (`/pedidos` e `/pedidos/:id`)
- [ ] Fluxo de autenticação validado na UI (`/login` e `/trocar-senha`)
- [ ] Fluxo de usuários validado na UI (`/usuarios`)
- [ ] Fluxo E2E validado na collection Postman (`E2E - Pedidos` e `Auth/Usuários`)
- [ ] Migrações aplicadas no banco (`migration-add-atualizado-em.sql`, `migration-normalizar-status-pedidos.sql`, `migration-auth-rbac-auditoria.sql`)
# APPEMP

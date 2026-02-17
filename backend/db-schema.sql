-- Esquema inicial do banco de dados APPEMP (PostgreSQL)

CREATE TABLE rotas (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  imagem_url TEXT
);

CREATE TABLE clientes (
  id SERIAL PRIMARY KEY,
  codigo_cliente TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  rota_id INTEGER REFERENCES rotas(id),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  imagem_url TEXT,
  link TEXT,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE produtos (
  id SERIAL PRIMARY KEY,
  codigo_produto TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  embalagem TEXT,
  preco_base NUMERIC(12, 2),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  imagem_url TEXT,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE cliente_produtos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  produto_id INTEGER NOT NULL REFERENCES produtos(id),
  valor_unitario NUMERIC(14, 4) NOT NULL CHECK (valor_unitario >= 0),
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (cliente_id, produto_id)
);

CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  login TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  perfil TEXT NOT NULL, -- ex: 'vendedor', 'backoffice', 'admin'
  rota_id INTEGER REFERENCES rotas(id),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  imagem_url TEXT,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE pedidos (
  id SERIAL PRIMARY KEY,
  chave_pedido TEXT NOT NULL UNIQUE, -- CHAVEPEDIDO da planilha
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  rota_id INTEGER REFERENCES rotas(id),
  data DATE NOT NULL,
  status TEXT NOT NULL, -- ex: 'EM_ESPERA', 'CONFERIR', 'EFETIVADO'
  valor_total NUMERIC(14, 2) DEFAULT 0,
  valor_efetivado NUMERIC(14, 2),
  codigo_empresa TEXT, -- CODEMPP
  criado_por INTEGER REFERENCES usuarios(id),
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE itens_pedido (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id INTEGER NOT NULL REFERENCES produtos(id),
  quantidade NUMERIC(14, 3) NOT NULL,
  embalagem TEXT,
  valor_unitario NUMERIC(14, 4) NOT NULL,
  valor_total_item NUMERIC(14, 2) NOT NULL,
  comissao NUMERIC(14, 2) DEFAULT 0 -- CCOMSS
);

CREATE TABLE trocas (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  item_pedido_id INTEGER REFERENCES itens_pedido(id),
  produto_id INTEGER NOT NULL REFERENCES produtos(id),
  quantidade NUMERIC(14, 3) NOT NULL,
  valor_troca NUMERIC(14, 2) DEFAULT 0,
  motivo TEXT,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

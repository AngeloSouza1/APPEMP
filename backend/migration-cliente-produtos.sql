-- Relação de preços personalizados por cliente x produto
CREATE TABLE IF NOT EXISTS cliente_produtos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  produto_id INTEGER NOT NULL REFERENCES produtos(id),
  valor_unitario NUMERIC(14, 4) NOT NULL CHECK (valor_unitario >= 0),
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (cliente_id, produto_id)
);

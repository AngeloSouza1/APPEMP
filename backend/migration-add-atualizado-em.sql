-- Adiciona coluna atualizado_em na tabela pedidos
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP;


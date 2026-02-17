-- Adiciona controle de bloqueio para clientes existentes
ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS ativo BOOLEAN;

UPDATE clientes
SET ativo = TRUE
WHERE ativo IS NULL;

ALTER TABLE clientes
ALTER COLUMN ativo SET DEFAULT TRUE;

ALTER TABLE clientes
ALTER COLUMN ativo SET NOT NULL;

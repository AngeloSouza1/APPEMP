-- Adiciona controle de bloqueio para produtos existentes
ALTER TABLE produtos
ADD COLUMN IF NOT EXISTS ativo BOOLEAN;

UPDATE produtos
SET ativo = TRUE
WHERE ativo IS NULL;

ALTER TABLE produtos
ALTER COLUMN ativo SET DEFAULT TRUE;

ALTER TABLE produtos
ALTER COLUMN ativo SET NOT NULL;

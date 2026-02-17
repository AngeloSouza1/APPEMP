-- Adiciona link de localização para clientes
ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS link TEXT;

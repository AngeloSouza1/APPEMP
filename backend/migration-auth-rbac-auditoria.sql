BEGIN;

-- Ajustes de usuários para autenticação e RBAC
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rota_id INTEGER REFERENCES rotas(id);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP NOT NULL DEFAULT NOW();

-- Garantir nomenclatura esperada para senha
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'senha'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'senha_hash'
  ) THEN
    ALTER TABLE usuarios RENAME COLUMN senha TO senha_hash;
  END IF;
END $$;

-- Auditoria em pedidos
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS criado_por INTEGER REFERENCES usuarios(id);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS atualizado_por INTEGER REFERENCES usuarios(id);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP;

-- Auditoria em trocas
ALTER TABLE trocas ADD COLUMN IF NOT EXISTS criado_por INTEGER REFERENCES usuarios(id);
ALTER TABLE trocas ADD COLUMN IF NOT EXISTS atualizado_por INTEGER REFERENCES usuarios(id);
ALTER TABLE trocas ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP;

COMMIT;

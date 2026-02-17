-- Padroniza valores legados de status na tabela pedidos
BEGIN;

UPDATE pedidos
SET status = CASE
  WHEN UPPER(REPLACE(TRIM(status), ' ', '_')) = 'OK' THEN 'EFETIVADO'
  WHEN UPPER(REPLACE(TRIM(status), ' ', '_')) = 'EM_ESPERA' THEN 'EM_ESPERA'
  WHEN UPPER(REPLACE(TRIM(status), ' ', '_')) = 'CONFERIR' THEN 'CONFERIR'
  WHEN UPPER(REPLACE(TRIM(status), ' ', '_')) = 'EFETIVADO' THEN 'EFETIVADO'
  WHEN UPPER(REPLACE(TRIM(status), ' ', '_')) = 'CANCELADO' THEN 'CANCELADO'
  ELSE status
END
WHERE status IS NOT NULL;

COMMIT;

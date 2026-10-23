-- Executar UMA vez, como `postgres`, no SQL Editor do Supabase (ou via MCP), antes da primeira migration.
-- As senhas NÃO ficam no repositório: defina-as em seguida com
--   ALTER ROLE tennis_owner PASSWORD '...';  ALTER ROLE tennis_api PASSWORD '...';
-- e coloque-as em DIRECT_URL / DATABASE_URL no .env.

-- Dono do schema: só usado para rodar migrations (DIRECT_URL).
CREATE ROLE tennis_owner LOGIN;
-- Papel da aplicação em runtime (DATABASE_URL): recebe apenas DML via a migration inicial.
CREATE ROLE tennis_api LOGIN;
-- Necessário para `postgres` criar o schema em nome de tennis_owner (PG 16+).
GRANT tennis_owner TO postgres;

CREATE SCHEMA IF NOT EXISTS tennis AUTHORIZATION tennis_owner;
CREATE SCHEMA IF NOT EXISTS tennis_test AUTHORIZATION tennis_owner;
REVOKE ALL ON SCHEMA tennis, tennis_test FROM PUBLIC;

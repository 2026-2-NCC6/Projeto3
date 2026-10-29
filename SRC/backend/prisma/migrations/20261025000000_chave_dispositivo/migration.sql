-- Chave do BLE de cada raquete, cifrada pela API (RNF Cibersegurança do IoT).
-- A coluna herda os grants e a policy de RLS da tabela dispositivo.
ALTER TABLE "dispositivo" ADD COLUMN "chave_cifrada" TEXT;

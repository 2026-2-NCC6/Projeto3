-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('JOGADOR', 'AUTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "TipoPraticante" AS ENUM ('TITULAR', 'DEPENDENTE');

-- CreateEnum
CREATE TYPE "FaixaEtaria" AS ENUM ('ATE_9', 'DE_10_A_13', 'DE_14_A_17', 'DE_18_A_29', 'DE_30_A_44', 'DE_45_A_59', 'DE_60_MAIS');

-- CreateEnum
CREATE TYPE "Nivel" AS ENUM ('INICIANTE', 'INTERMEDIARIO', 'AVANCADO');

-- CreateEnum
CREATE TYPE "ModoPublico" AS ENUM ('INFANTIL', 'ADULTO', 'TODOS');

-- CreateEnum
CREATE TYPE "StatusVersao" AS ENUM ('RASCUNHO', 'EM_REVISAO', 'PUBLICADA', 'ARQUIVADA');

-- CreateEnum
CREATE TYPE "OrigemTreino" AS ENUM ('LOCAL', 'PLATAFORMA_MAE');

-- CreateEnum
CREATE TYPE "Licenca" AS ENUM ('CC_BY', 'PROPRIETARIA', 'USO_PESSOAL');

-- CreateEnum
CREATE TYPE "ModeloRemuneracao" AS ENUM ('GRATUITO', 'AVULSO', 'ASSINATURA');

-- CreateEnum
CREATE TYPE "OrigemSessao" AS ENUM ('SENSOR', 'DEMO');

-- CreateEnum
CREATE TYPE "EstadoSessao" AS ENUM ('CRIADA', 'EM_EXECUCAO', 'PAUSADA', 'ENCERRADA', 'PARADA_SEGURA');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('GOLPE', 'LANCAMENTO', 'COMANDO', 'ESTADO', 'ERRO');

-- CreateEnum
CREATE TYPE "TipoEnvio" AS ENUM ('RESUMO', 'EVENTOS');

-- CreateEnum
CREATE TYPE "StatusEnvio" AS ENUM ('PENDENTE', 'ENVIADO', 'FALHOU');

-- CreateEnum
CREATE TYPE "Severidade" AS ENUM ('INFO', 'INCIDENTE');

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'JOGADOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "declara_maioridade" BOOLEAN NOT NULL,
    "termos_versao" TEXT NOT NULL,
    "termos_aceitos_em" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anonimizado_em" TIMESTAMP(3),

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "familia_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "revogado_em" TIMESTAMP(3),
    "substituido_por_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "praticante" (
    "id" UUID NOT NULL,
    "conta_id" UUID NOT NULL,
    "tipo" "TipoPraticante" NOT NULL,
    "apelido" TEXT NOT NULL,
    "faixa_etaria" "FaixaEtaria" NOT NULL,
    "nivel" "Nivel" NOT NULL DEFAULT 'INICIANTE',
    "objetivos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferencias" JSONB NOT NULL DEFAULT '{}',
    "restricoes" TEXT,
    "consente_telemetria" BOOLEAN NOT NULL DEFAULT false,
    "consentimento_parental_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "praticante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treino" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "autor_id" UUID NOT NULL,
    "categoria_id" UUID,
    "origem" "OrigemTreino" NOT NULL DEFAULT 'LOCAL',
    "id_externo" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treino_versao" (
    "id" UUID NOT NULL,
    "treino_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "status" "StatusVersao" NOT NULL DEFAULT 'RASCUNHO',
    "conteudo" JSONB NOT NULL,
    "publico_alvo" TEXT NOT NULL,
    "objetivo" TEXT NOT NULL,
    "nivel" "Nivel" NOT NULL,
    "duracao_min" INTEGER NOT NULL,
    "sensores" TEXT[],
    "modo_publico" "ModoPublico" NOT NULL,
    "compatibilidade_firmware" TEXT NOT NULL DEFAULT '1.0.0',
    "notas_alteracao" TEXT,
    "criado_por_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicado_em" TIMESTAMP(3),

    CONSTRAINT "treino_versao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_metadados" (
    "treino_id" UUID NOT NULL,
    "descricao_comercial" TEXT NOT NULL,
    "licenca" "Licenca" NOT NULL DEFAULT 'USO_PESSOAL',
    "modelo_remuneracao" "ModeloRemuneracao" NOT NULL DEFAULT 'GRATUITO',
    "preco_futuro_centavos" INTEGER,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_metadados_pkey" PRIMARY KEY ("treino_id")
);

-- CreateTable
CREATE TABLE "dispositivo" (
    "id" UUID NOT NULL,
    "conta_id" UUID NOT NULL,
    "nome_ble" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "firmware_versao" TEXT NOT NULL,
    "ultimo_status" JSONB,
    "ultimo_contato_em" TIMESTAMP(3),
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessao" (
    "id" UUID NOT NULL,
    "praticante_id" UUID NOT NULL,
    "treino_versao_id" UUID NOT NULL,
    "dispositivo_id" UUID,
    "origem" "OrigemSessao" NOT NULL,
    "estado" "EstadoSessao" NOT NULL DEFAULT 'CRIADA',
    "iniciada_em" TIMESTAMP(3),
    "encerrada_em" TIMESTAMP(3),
    "motivo_interrupcao" TEXT,
    "duracao_seg" INTEGER,
    "lancamentos" INTEGER NOT NULL DEFAULT 0,
    "resumo" JSONB,
    "pontos" INTEGER,
    "golpes" INTEGER,
    "acertos" INTEGER,
    "divergencia" BOOLEAN NOT NULL DEFAULT false,
    "offline" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_sessao" (
    "id" UUID NOT NULL,
    "sessao_id" UUID NOT NULL,
    "tipo" "TipoEvento" NOT NULL,
    "t_ms" INTEGER NOT NULL,
    "ocorrido_em" TIMESTAMP(3) NOT NULL,
    "dados" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "evento_sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envio_plataforma" (
    "id" UUID NOT NULL,
    "sessao_id" UUID NOT NULL,
    "tipo" "TipoEnvio" NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" "StatusEnvio" NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "proxima_tentativa_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_erro" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviado_em" TIMESTAMP(3),

    CONSTRAINT "envio_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" BIGSERIAL NOT NULL,
    "ocorrido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" UUID,
    "acao" TEXT NOT NULL,
    "alvo_tipo" TEXT,
    "alvo_id" TEXT,
    "ip" TEXT,
    "request_id" TEXT,
    "severidade" "Severidade" NOT NULL DEFAULT 'INFO',
    "detalhes" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametro_sistema" (
    "chave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parametro_sistema_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "mock_plataforma_resultado" (
    "idempotency_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "recebido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mock_plataforma_resultado_pkey" PRIMARY KEY ("idempotency_key")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_token_hash_key" ON "refresh_token"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_token_familia_id_idx" ON "refresh_token"("familia_id");

-- CreateIndex
CREATE INDEX "praticante_conta_id_idx" ON "praticante"("conta_id");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_slug_key" ON "categoria"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "treino_slug_key" ON "treino"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "treino_id_externo_key" ON "treino"("id_externo");

-- CreateIndex
CREATE INDEX "treino_versao_status_nivel_modo_publico_idx" ON "treino_versao"("status", "nivel", "modo_publico");

-- CreateIndex
CREATE UNIQUE INDEX "treino_versao_treino_id_numero_key" ON "treino_versao"("treino_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "dispositivo_identificador_key" ON "dispositivo"("identificador");

-- CreateIndex
CREATE INDEX "sessao_praticante_id_criado_em_idx" ON "sessao"("praticante_id", "criado_em");

-- CreateIndex
CREATE INDEX "sessao_dispositivo_id_estado_idx" ON "sessao"("dispositivo_id", "estado");

-- CreateIndex
CREATE INDEX "evento_sessao_sessao_id_t_ms_idx" ON "evento_sessao"("sessao_id", "t_ms");

-- CreateIndex
CREATE UNIQUE INDEX "envio_plataforma_idempotency_key_key" ON "envio_plataforma"("idempotency_key");

-- CreateIndex
CREATE INDEX "envio_plataforma_status_proxima_tentativa_em_idx" ON "envio_plataforma"("status", "proxima_tentativa_em");

-- CreateIndex
CREATE INDEX "auditoria_ocorrido_em_idx" ON "auditoria"("ocorrido_em");

-- CreateIndex
CREATE INDEX "auditoria_acao_idx" ON "auditoria"("acao");

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "praticante" ADD CONSTRAINT "praticante_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treino" ADD CONSTRAINT "treino_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treino" ADD CONSTRAINT "treino_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treino_versao" ADD CONSTRAINT "treino_versao_treino_id_fkey" FOREIGN KEY ("treino_id") REFERENCES "treino"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_metadados" ADD CONSTRAINT "marketplace_metadados_treino_id_fkey" FOREIGN KEY ("treino_id") REFERENCES "treino"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivo" ADD CONSTRAINT "dispositivo_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_praticante_id_fkey" FOREIGN KEY ("praticante_id") REFERENCES "praticante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_treino_versao_id_fkey" FOREIGN KEY ("treino_versao_id") REFERENCES "treino_versao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_dispositivo_id_fkey" FOREIGN KEY ("dispositivo_id") REFERENCES "dispositivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_sessao" ADD CONSTRAINT "evento_sessao_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "sessao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envio_plataforma" ADD CONSTRAINT "envio_plataforma_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "sessao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- No máximo uma versão PUBLICADA por treino (RF16).
CREATE UNIQUE INDEX "treino_versao_uma_publicada" ON "treino_versao"("treino_id") WHERE "status" = 'PUBLICADA';

-- Menor privilégio (RNF Segurança): a API roda como tennis_api, só com DML.
-- A auditoria é só de inserção e leitura para a API. RLS ligado em tudo, com policy apenas
-- para tennis_api: anon/authenticated do Supabase não têm grant nem policy neste schema.
DO $$
DECLARE
  s text := current_schema();
  t record;
BEGIN
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO tennis_api', s);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO tennis_api', s);
  EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO tennis_api', s);
  EXECUTE format('REVOKE UPDATE, DELETE ON %I.auditoria FROM tennis_api', s);
  IF to_regclass(format('%I._prisma_migrations', s)) IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON %I._prisma_migrations FROM tennis_api', s);
  END IF;
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = s AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', s, t.tablename);
    EXECUTE format('CREATE POLICY api_acesso ON %I.%I TO tennis_api USING (true) WITH CHECK (true)', s, t.tablename);
  END LOOP;
END $$;

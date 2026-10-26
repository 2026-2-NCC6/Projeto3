# Tennis Analytics API

Backend do Smart Tennis Arena (Projeto Interdisciplinar, 6º CCOMP FECAP 2026). Ele atende o lado servidor de RF01–RF23 do edital: autenticação, catálogo e versionamento de treinos, sessões com máquina de estados, simulador da máquina lançadora, pontuação gamificada, histórico, integração com a plataforma mãe, administração e auditoria.

- **Design e rastreabilidade de requisitos:** [docs/superpowers/specs/2026-10-23-backend-design.md](../../docs/superpowers/specs/2026-10-23-backend-design.md)
- **Contrato da API:** Swagger em `/api/v1/docs` e [docs/openapi.json](docs/openapi.json)

## Stack

NestJS 11 (TypeScript), Prisma 6 e PostgreSQL no Supabase (schema dedicado `tennis`). O tempo real usa Socket.IO, os logs são estruturados com pino e as métricas seguem o formato Prometheus. Testes com Jest e supertest. A raquete fala com o app por BLE; a API recebe os dados **do app**.

```
src/
  auth/          cadastro, login, refresh rotativo, conta (exportar/excluir — LGPD)
  praticantes/   titular e dependentes (RF02, RF11) + rotas de histórico (RF13)
  treinos/       catálogo, versões, validação, ensaio, marketplace (RF03/04/14/15/16/18/20)
  dispositivos/  raquete vinculada à conta e status dos sensores (RF05)
  sessoes/       máquina de estados, comandos, eventos idempotentes, sincronização offline (RF06/07/21/22)
  maquina/       simulador da lançadora + gateway WebSocket /maquina (RF09)
  pontuacao/     regras de pontuação (paridade com o app), conquistas, recomendações, indicadores (RF10/12/13)
  integracao/    cliente da plataforma mãe, mock embutido, outbox com retry, importação (RF18/19)
  admin/         usuários, categorias, dispositivos, parâmetros, sessões, auditoria (RF17/23)
  saude/         /health e /metrics
  privacidade/   retenção de eventos (LGPD)
```

## Como rodar localmente

Pré-requisito: Node 22+.

1. **Banco (uma vez por projeto Supabase).** No SQL Editor, rode [prisma/sql/papeis.sql](prisma/sql/papeis.sql). Depois defina as senhas dos papéis `tennis_owner` e `tennis_api` com `ALTER ROLE ... PASSWORD`.
2. **Ambiente.** Copie `.env.example` para `.env` e preencha. As URLs usam o pooler do Supabase em session mode (porta 5432), e o usuário fica no formato `papel.project-ref`.
3. **Instalar, migrar e popular:**
   ```bash
   npm install
   npx prisma generate
   npm run db:migrate          # schema tennis (usa DIRECT_URL)
   npm run db:seed             # 6 treinos do app, categorias, autores fictícios e o admin do .env
   npm run start:dev           # http://localhost:3000/api/v1/docs
   ```

## Testes

```bash
npm test            # unitários: pontuação, máquina de estados, simulador, validação, firmware
npm run test:e2e    # cenário de aceitação da §9, contra o schema tennis_test
```

Antes do primeiro E2E, aplique as migrations no schema de teste com `node scripts/com-env-teste.js npx prisma migrate deploy`. O E2E apaga e repopula `tennis_test` a cada execução e nunca toca o schema `tennis`.

## Fluxo do app (resumo)

1. `POST /auth/login`: guarde `accessToken` (15 min) e `refreshToken` (renove em `POST /auth/refresh`; cada refresh vale uma vez).
2. `GET /treinos?nivel=&sensor=&modoPublico=`, depois `GET /treinos/{slug}`. Guarde o `ETag`; com `If-None-Match` a API responde `304` quando a versão não mudou (cache para uso offline).
3. `POST /dispositivos` uma vez; depois `PUT /dispositivos/{id}/status` a cada pareamento BLE.
4. `POST /sessoes` com um `id` UUID gerado no app (repetir a chamada não duplica a sessão).
5. Socket.IO em `/maquina` com `auth: { token }`, depois `emit('entrar', { sessaoId })`. A partir daí chegam `lancamento`, `estado` e `parada`.
6. `POST /sessoes/{id}/comandos` com `{ comando: 'INICIAR' }`. Os golpes vão em lotes por `POST /sessoes/{id}/eventos`, cada evento com o próprio UUID; reenviar não duplica.
7. Emergência: `{ comando: 'EMERGENCIA', motivo }`. A sessão vai para `PARADA_SEGURA` e só aceita `{ comando: 'REINICIAR', areaSegura: true }`.
8. `{ comando: 'ENCERRAR', pontosCliente }`: devolve o resumo calculado no servidor, com conquistas e recomendações. Se a pontuação do app divergir, a sessão é marcada com `divergencia`.
9. **Sem conexão:** ao voltar a rede, envie tudo de uma vez em `POST /sessoes/sincronizar` (idempotente).

Máquina de estados da sessão:

```
CRIADA ─INICIAR─▶ EM_EXECUCAO ⇄ PAUSADA ─ENCERRAR─▶ ENCERRADA
                     │  PAUSAR/RETOMAR       ▲
       EMERGENCIA / falha do sensor          │ ENCERRAR
                     ▼                       │
               PARADA_SEGURA ─REINICIAR(areaSegura)─▶ PAUSADA
```

Erros seguem sempre `{ statusCode, codigo, mensagem, detalhes?, requestId }`. Envie `x-request-id` para correlacionar app, raquete e API nos logs.

## Segurança (resumo)

- **Banco:** schema `tennis` fora da Data API do Supabase, RLS ligado e papel de runtime só com DML. A auditoria é só de inserção.
- **Acesso:** guard global que nega por padrão; papéis `JOGADOR`, `AUTOR` e `ADMIN`; checagem de posse em todo recurso.
- **Credenciais:** bcrypt; refresh rotativo com detecção de reuso; rate limit no login.
- **HTTP:** Helmet, CORS por lista, DTOs estritos e logs com credenciais mascaradas.
- **Dependências:** `npm audit` no CI.
- **LGPD:** coleta mínima, dependentes sem e-mail e com consentimento parental, retenção limitada, exportação e exclusão da conta, praticante pseudonimizado no envio à plataforma mãe e estatísticas de autor só agregadas (mínimo de 3 praticantes).

## Deploy

O [Dockerfile](Dockerfile) é multiestágio, roda como usuário `node`, aplica as migrations ao subir e tem healthcheck. O [render.yaml](../../render.yaml) na raiz do repositório cria o serviço no Render:
- Preencha `DATABASE_URL`, `DIRECT_URL`, `CORS_ORIGINS` e `PLATAFORMA_MAE_URL` no painel do Render.
- Os demais segredos são gerados pelo próprio Render.

O CI ([.github/workflows/backend.yml](../../.github/workflows/backend.yml)) roda verificação de tipos, testes unitários, `npm audit` e o build da imagem.

## Limitações conhecidas

1. O BLE é autenticado por desafio e resposta desde o firmware 1.1.0. A chave de cada raquete fica cifrada na API (`CHAVE_DISPOSITIVOS`) e só é entregue ao dono, em `GET /dispositivos/{id}/chave`. Os dados de golpe continuam trafegando legíveis (sem dado pessoal). O desafio da placa não vem de um gerador criptográfico por hardware.
2. O modo offline executa sem o simulador da máquina, que roda no servidor.
3. O simulador mantém estado em memória: o MVP roda em instância única. O estado também é espelhado no banco, então a sessão retoma após um reinício do servidor.
4. App e site ainda não consomem esta API.
5. Um access token continua válido por até 15 min depois de a conta ser desativada; o refresh é revogado na hora.

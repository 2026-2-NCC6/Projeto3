# Backend Tennis Analytics — Design

Data: 2026-10-23 · Projeto Interdisciplinar Smart Tennis Arena · 6º CCOMP FECAP 2026
Fonte de requisitos: `RequisitosProjetoSemestralCCOMP6.pdf` (Versão FINAL). Toda decisão abaixo cita o requisito que atende; a seção 9 traz a matriz completa.

## 1. Contexto e escopo

O ecossistema tem quatro partes: app mobile (Expo, `SRC/app`), site de autoria/admin (a construir), API (este documento) e raquete instrumentada (`SRC/arduino`). A raquete fala com o app por **BLE**; o backend recebe dados **do app**, não da placa (mudança em relação à NI1, que previa Wi-Fi).

**No escopo:** API REST + WebSocket que atende o lado servidor de RF01–RF23, simulador da máquina lançadora, mock da plataforma mãe, banco, testes, CI e artefatos de deploy.

**Fora do escopo:** alterar o app para consumir a API; construir o site; firmware. A API expõe tudo o que app e site precisam.

## 2. Stack e decisões de base

| Decisão | Escolha | Requisito |
|---|---|---|
| Framework | NestJS (TypeScript) | §6 Backend; coerente com NI1 |
| Banco | PostgreSQL hospedado no Supabase (projeto `ykloakoxwlcsgcxmyhuz`), usado só como Postgres | §6 Banco de dados |
| Acesso a dados | Prisma, schema e migrations versionados no repo | RNF Manutenibilidade |
| Schema | `tennis` (via `?schema=` na URL), **não** `public` — a Data API do Supabase não o expõe | RNF Segurança |
| RLS | Ligado em todas as tabelas, sem policies (defesa extra contra acesso pela chave anônima) | RNF Segurança |
| Papel do banco em runtime | `tennis_api`, só DML no schema `tennis`; migrations rodam como dono | RNF Segurança (menor privilégio) |
| Autenticação | JWT próprio (access 15 min) + refresh 7 dias rotativo | RF01, RNF Segurança |
| Tempo real | WebSocket (Socket.IO) para o simulador | §6 Comunicação, RF09 |
| Documentação | Swagger em `/api/docs` + export `docs/openapi.json` | RNF Interoperabilidade, RF18 |
| Versão de API | Prefixo `/api/v1` | RNF Interoperabilidade |

Local: `SRC/backend/`.

```
SRC/backend/
  prisma/ schema.prisma, migrations/, seed.ts
  src/ main.ts, app.module.ts
       config/        validação de variáveis de ambiente
       comum/         guards, decorators, filtros, interceptors (request-id, auditoria, logs)
       auth/ praticantes/ treinos/ dispositivos/ sessoes/ pontuacao/
       maquina/ historico/ integracao/ admin/ auditoria/ saude/
  test/ e2e
  Dockerfile, .env.example, render.yaml, README.md
.github/workflows/backend.yml
```

## 3. Módulos

| Módulo | Responsabilidade | RFs |
|---|---|---|
| `auth` | Cadastro (só adultos), login, refresh, logout; papéis `JOGADOR`, `AUTOR`, `ADMIN` | RF01 |
| `praticantes` | Titular e dependentes; perfil; consentimentos; exclusão (LGPD) | RF02, RF11 |
| `treinos` | Treino + versões; catálogo com filtros; ciclo de vida; validar/ensaiar; metadados de marketplace; estatísticas agregadas ao autor | RF03, 04, 14, 15, 16, 18, 20 |
| `dispositivos` | Cadastro da raquete, status de sensores/comunicação, bloqueio | RF05, RF17 |
| `sessoes` | Máquina de estados; comandos; eventos idempotentes; sincronização offline; resumo | RF06, 07, 12, 21, 22 |
| `pontuacao` | Regras de pontuação, conquistas, recomendações, indicadores — porte de `SRC/app/src/sessao/regras.ts` | RF10, RF12, RF13 |
| `maquina` | Simulador da lançadora, limites de operação, WebSocket | RF09, RF22 |
| `historico` | Sessões por período/treino; indicadores | RF13 |
| `integracao` | Cliente da plataforma mãe (interface), mock embutido, outbox com retry, importação de treinos | RF18, RF19, §1 |
| `admin` | Usuários, papéis, categorias, dispositivos, parâmetros, sessões, auditoria | RF17 |
| `auditoria` | Registro de autenticação, publicação, comandos, paradas, admin, incidentes | RF23 |
| `saude` | `/health`, `/metrics` | RNF Observabilidade |

Transversal: Helmet, CORS por lista permitida, `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`), rate limit (`@nestjs/throttler`), logs estruturados (pino) com `x-request-id` propagado e mascaramento de `senha`, `*token*` e `authorization`.

## 4. Modelo de dados (schema `tennis`)

**Contas e praticantes**
- `usuario` — id, email (único), senha_hash, nome, papel, ativo, declara_maioridade (obrigatório `true`), termos_versao, termos_aceitos_em, criado_em.
- `refresh_token` — id, usuario_id, familia_id, token_hash, expira_em, revogado_em, substituido_por_id.
- `praticante` — id, conta_id → usuario, tipo `TITULAR|DEPENDENTE`, apelido, faixa_etaria (`ATE_9|10_13|14_17|18_29|30_44|45_59|60_MAIS`), nivel (`INICIANTE|INTERMEDIARIO|AVANCADO`), objetivos text[], preferencias jsonb, restricoes text, consente_telemetria (default false), consentimento_parental_em (obrigatório para dependente), criado_em. Sem data de nascimento (minimização). Toda conta nasce com 1 titular; dependente exige faixa etária < 18.

**Treinos**
- `categoria` — id, nome, slug.
- `treino` — id, slug (único), autor_id, categoria_id, origem `LOCAL|PLATAFORMA_MAE`, id_externo, criado_em.
- `treino_versao` — id, treino_id, numero, status `RASCUNHO|EM_REVISAO|PUBLICADA|ARQUIVADA`, conteudo jsonb, colunas de filtro (publico_alvo, objetivo, nivel, duracao_min, sensores text[], modo_publico), compatibilidade_firmware, notas_alteracao, criado_por, criado_em, publicado_em. Únicos: (treino_id, numero); índice único parcial garante no máximo uma `PUBLICADA` por treino.
- `marketplace_metadados` — treino_id (PK), descricao_comercial, licenca (`CC_BY|PROPRIETARIA|USO_PESSOAL`), modelo_remuneracao (`GRATUITO|AVULSO|ASSINATURA`), preco_futuro_centavos (nulo). Nenhuma cobrança no MVP (RF20).

`conteudo` (validado por DTO de classe aninhado):

```
publicoAlvo: string, objetivo: string, nivel, duracaoMin, modoPublico: INFANTIL|ADULTO|TODOS
instrucoes[], equipamentos[], riscos[], sensores: (IMU|PIEZO)[]
pontuacao: { base=10, bonusSequencia=5, bonusForte=5, penalidadeErro=0, metaPrecisao }
exercicios: [{ nome, repeticoes, golpeEsperado: FH|BH|ALTERNADO,
               lancamento: { velocidadeKmh, rotacao: TOPSPIN|SLICE|PLANO,
                             direcao: ESQ|CENTRO|DIR, alturaM, intervaloSeg } }]
feedbacks: { acerto, erro, sequencia }
conclusao: { tipo: TEMPO|REPETICOES, valor }
tutorial: { golpes[], segPorBola, passos[] }   // formato atual do app
```

Os padrões de `pontuacao` reproduzem o cálculo atual do app (`10 + seq*5 + 5 se força 3`).

**Execução**
- `dispositivo` — id, conta_id, nome_ble, identificador (único), firmware_versao, ultimo_status jsonb (sensores, bateria, rssi), ultimo_contato_em, bloqueado.
- `sessao` — id (UUID gerado pelo app), praticante_id, treino_versao_id, dispositivo_id (nulo em demo), origem `SENSOR|DEMO`, estado, iniciada_em, encerrada_em, motivo_interrupcao, duracao_seg, resumo jsonb, pontos, golpes, acertos, divergencia (bool), offline (bool), criado_em.
- `evento_sessao` — id (UUID do app, chave idempotente), sessao_id, tipo `GOLPE|LANCAMENTO|COMANDO|ESTADO|ERRO`, t_ms, ocorrido_em, dados jsonb. Índice (sessao_id, t_ms). GOLPE: `{lado, forca, picoG, picoGiro, seq, acertoAlvo?}`.

**Operação**
- `envio_plataforma` — id, sessao_id, tipo `RESUMO|EVENTOS`, payload, idempotency_key (única), status `PENDENTE|ENVIADO|FALHOU`, tentativas, proxima_tentativa_em, ultimo_erro.
- `auditoria` — id, ocorrido_em, usuario_id, acao, alvo_tipo, alvo_id, ip, request_id, severidade (`INFO|INCIDENTE`), detalhes.
- `parametro_sistema` — chave, valor jsonb. Padrões: `retencao_eventos_dias=180`, `retencao_eventos_dependente_dias=30`, `limite_velocidade_adulto_kmh=120`, `limite_velocidade_infantil_kmh=50`, `intervalo_minimo_seg=1.5`.

**Seed:** os 6 treinos de `SRC/app/src/data/treinos.ts` como versões `PUBLICADA` com os mesmos slugs, exercícios coerentes com `tutorial.golpes`; autores e jogadores fictícios; 1 admin a partir das variáveis de ambiente.

## 5. Fluxos

### 5.1 Ciclo de vida do treino (RF14, RF15, RF16)

```
RASCUNHO ──enviar-revisao (validação ok)──▶ EM_REVISAO ──publicar──▶ PUBLICADA ──▶ ARQUIVADA
   ▲ edição só aqui                            │ devolver
   └───────────────────────────────────────────┘
```

- Criar treino e editar versões: papel `AUTOR` (só os próprios) ou `ADMIN`.
- Validar retorna lista de erros: campos obrigatórios da §3, sensores desconhecidos, parâmetros fora dos limites de operação, `modoPublico=INFANTIL` com velocidade acima do limite infantil, e duração estimada incompatível com os lançamentos (nunca menor que o tempo de máquina, nem maior que o dobro dele; mínimo 1 min).
- Ensaiar: simula a sequência sem tempo real e devolve linha do tempo de lançamentos + resumo calculado com golpes de exemplo (porte de `golpesDeExemplo`).
- Publicar: autor do treino ou admin; arquiva a publicada anterior na mesma transação.
- Nova versão copia a mais recente para um `RASCUNHO` com `numero+1`.
- Treinos `PLATAFORMA_MAE` são só leitura.
- Toda transição é auditada.

### 5.2 Máquina de estados da sessão (RF06, RF22, §3)

| Estado atual | Comando/evento | Próximo | Observação |
|---|---|---|---|
| CRIADA | INICIAR | EM_EXECUCAO | checagens de dispositivo (5.6) |
| EM_EXECUCAO | PAUSAR | PAUSADA | |
| PAUSADA | RETOMAR | EM_EXECUCAO | |
| EM_EXECUCAO, PAUSADA | ENCERRAR | ENCERRADA | calcula resumo, enfileira envio |
| CRIADA, EM_EXECUCAO, PAUSADA | EMERGENCIA | PARADA_SEGURA | motivo obrigatório |
| EM_EXECUCAO, PAUSADA | ERRO `SENSOR_INCONSISTENTE` | PARADA_SEGURA | automático |
| EM_EXECUCAO | desconexão do WebSocket | PAUSADA | motivo `conexao_perdida` |
| PARADA_SEGURA | REINICIAR (`areaSegura=true`) | PAUSADA | só o dono da conta ou admin |
| PARADA_SEGURA | qualquer outro | — | **409**, auditado como `INCIDENTE` |
| ENCERRADA | qualquer | — | **409** |

Sessões só são criadas sobre versões `PUBLICADA` (rascunhos são testados por "ensaiar"); dependentes só em versões `INFANTIL` ou `TODOS`. Enquanto houver sessão em `PARADA_SEGURA` num dispositivo, nenhuma sessão nova inicia nele. Mapeamento com o firmware: CRIADA≈AGUARDANDO, EM_EXECUCAO≈COLETANDO, PAUSADA≈PAUSADO, ENCERRADA/PARADA_SEGURA≈PARADO.

### 5.3 Simulador (RF09, RNF Segurança física, RNF Desempenho)

- Expande `exercicios` em uma fila de lançamentos (`ALTERNADO` alterna FH/BH).
- Em EM_EXECUCAO emite, a cada `intervaloSeg`, `lancamento {seq, exercicio, velocidadeKmh, rotacao, direcao, alturaM, golpeEsperado}` na sala `sessao:<id>` do namespace `/maquina`; grava evento `LANCAMENTO`.
- PAUSAR suspende sem perder a posição; EMERGENCIA cancela o timer imediatamente e emite `parada {motivo}`.
- Aplica teto dos limites em runtime mesmo se a versão passou na validação.
- Estado em memória espelhado no banco (`sessao.estado`); instância única no MVP.
- Meta: EMERGENCIA → timer cancelado + `parada` emitida em ≤ 200 ms p95 no servidor; histograma `maquina_emergencia_latencia_ms` em `/metrics`; teste unitário com timers falsos.
- Conexão WebSocket exige JWT válido e posse da sessão.

### 5.4 Eventos, pontuação e sincronização (RF07, RF10, RF12, RF21)

- `POST /sessoes/:id/eventos` aceita lote (≤ 200); insere com `ON CONFLICT (id) DO NOTHING`; responde `{aceitos, duplicados, parcial: {pontos, golpes, acertos, sequencia}}`. Só aceito em EM_EXECUCAO/PAUSADA.
- Golpe esperado do índice _i_ = sequência expandida dos exercícios (equivale a `ladoEsperado` do app). `ok = lado == esperado && acertoAlvo !== false`.
- Pontos por golpe = `ok ? base + sequencia*bonusSequencia + (forca==3 ? bonusForte : 0) : -penalidadeErro`; total nunca negativo.
- Resumo = estrutura `ResumoSessao` do app + `conquistas[]` + `recomendacoes[]` + `metaAtingida`.
  - Conquistas: `PRIMEIRA_SESSAO`, `SEQUENCIA_10` (melhor sequência ≥ 10), `META_PRECISAO` (precisão ≥ meta), `RESISTENCIA` (≥ 20 golpes e sem queda).
  - Recomendações: precisão de um lado < 50% com ≥ 5 golpes daquele lado → treino publicado focado nesse lado; queda de resistência → treino mais curto do mesmo nível; meta atingida → treino do nível acima.
- Offline: `GET /treinos/:slug` com `ETag`; depois `POST /sessoes/sincronizar {sessao, eventos[]}` idempotente por id da sessão e dos eventos, marca `offline=true`. Offline não há simulador. A sessão sincronizada sempre termina `ENCERRADA` (com `motivoInterrupcao` se foi interrompida): um registro histórico não pode deixar a raquete travada em `PARADA_SEGURA`.
- O resumo traz também `porLadoEsperado` (contado pelo lado pedido), usado pelas recomendações; `porLado` segue idêntico ao do app.
- No encerramento o servidor recalcula; se o app enviar `pontosCliente` diferente, marca `divergencia=true` e prevalece o do servidor.

### 5.5 Plataforma mãe (RF18, RF19, §1, RNF Resiliência)

- Interface `PlataformaMaeCliente { listarTreinos(), enviarResultado(chave, payload) }`; implementação HTTP com `PLATAFORMA_MAE_URL` e `PLATAFORMA_MAE_API_KEY` do ambiente.
- Mock embutido em `/api/v1/mock/plataforma-mae` (protegido pela mesma API key, comparada em tempo constante), habilitado por `MOCK_PLATAFORMA_MAE=true`; guarda resultados recebidos por `Idempotency-Key` e responde igual a repetições.
- Encerrar sessão enfileira `RESUMO` sempre e `EVENTOS` só se `consente_telemetria` (dependente: consentimento parental + flag).
- Worker a cada 30 s: backoff `min(2^tentativas, 60) min`; após 10 tentativas, `FALHOU` (reprocessável pelo admin).
- Importação: `POST /admin/integracao/importar-treinos` cria/atualiza treinos `origem=PLATAFORMA_MAE` (idempotente por `id_externo`).

### 5.6 Dispositivos (RF05, RNF Cibersegurança do IoT)

INICIAR com `dispositivoId` exige: dispositivo da mesma conta, não bloqueado, `firmware_versao ≥ compatibilidade_firmware` da versão, e nenhuma sessão em `PARADA_SEGURA` nele. Violação → 403/409 + auditoria `INCIDENTE`. O app reporta status com `PUT /dispositivos/:id/status`.

### 5.7 Autenticação (RF01, RNF Segurança)

- bcrypt (custo 12); senha mínima de 8 caracteres com letra e número.
- Login com limite de 5/min por IP+e-mail; resposta genérica para credenciais inválidas.
- Refresh rotativo por família; reuso de token revogado revoga a família e audita `INCIDENTE`.
- Guard global JWT (rotas públicas marcadas com `@Publico`) + `@Papeis`.

### 5.8 LGPD (RNF Privacidade, §3)

- Coleta mínima (faixa etária, sem nascimento; dependente sem e-mail).
- Finalidade explícita: `termos_versao` aceita no cadastro; consentimentos separados para telemetria.
- Retenção: job diário apaga `evento_sessao` acima do prazo (180 dias titular, 30 dependente), mantendo o resumo.
- Direitos do titular: `GET /me/exportar` (JSON dos próprios dados) e `DELETE /me` (anonimiza conta e remove praticantes).
- Autores veem só estatísticas agregadas dos seus treinos, sem identificar jogadores, e só quando há ao menos 3 praticantes distintos (abaixo disso o agregado poderia identificar alguém); sessões `DEMO` ficam fora dos indicadores.
- `DELETE /me` exige a senha no corpo antes de excluir.

## 6. API (resumo de rotas, prefixo `/api/v1`)

| Grupo | Rotas |
|---|---|
| Auth | `POST auth/cadastro`, `POST auth/login`, `POST auth/refresh`, `POST auth/logout`, `GET me`, `GET me/exportar`, `DELETE me` |
| Praticantes | `GET praticantes`, `PATCH praticantes/:id`, `POST praticantes/dependentes`, `DELETE praticantes/:id` |
| Catálogo | `GET treinos` (filtros: `publico`, `objetivo`, `nivel`, `duracaoMax`, `sensor`, `modoPublico`, `categoria`), `GET treinos/:slug` (ETag) |
| Autoria | `POST treinos`, `GET treinos/:slug/versoes`, `GET treinos/:slug/versoes/:n`, `POST treinos/:slug/versoes`, `PATCH treinos/:slug/versoes/:n`, `POST …/:n/validar`, `POST …/:n/ensaiar`, `POST …/:n/enviar-revisao`, `POST …/:n/devolver`, `POST …/:n/publicar`, `PUT treinos/:slug/marketplace`, `GET treinos/:slug/estatisticas` |
| Dispositivos | `POST dispositivos`, `GET dispositivos`, `PUT dispositivos/:id/status`, `DELETE dispositivos/:id` |
| Sessões | `POST sessoes`, `GET sessoes/:id`, `POST sessoes/:id/comandos`, `POST sessoes/:id/eventos`, `POST sessoes/sincronizar` |
| Histórico | `GET praticantes/:id/sessoes?de&ate&treino`, `GET praticantes/:id/indicadores?de&ate&treino` |
| Admin | `usuarios`, `categorias`, `dispositivos/:id/bloqueio`, `parametros`, `sessoes`, `auditoria`, `integracao/envios`, `integracao/envios/:id/reprocessar`, `integracao/processar`, `integracao/importar-treinos` (todas sob `admin/`) |
| Operação | `GET health`, `GET metrics` (exige `METRICS_TOKEN`), `GET docs` (Swagger UI) |
| Categorias | `GET categorias` |
| WebSocket | namespace `/maquina`: cliente `entrar {sessaoId}`; servidor `lancamento`, `estado`, `parada` |

Erros no formato `{ statusCode, codigo, mensagem, requestId }`.

**Indicadores (RF13)**: precisão = acertos/golpes; consistência = `max(0, 100 − CV% da força)`; cadência = média do intervalo entre golpes; volume = golpes; tempo = soma das durações; progressão = precisão e pontos do período comparados à média das 5 sessões anteriores do mesmo treino.

## 7. Segurança

OWASP Top 10: A01 guard que nega por padrão + checagem de posse; A02 TLS no deploy, `sslmode=require`, bcrypt, segredos em env; A03 Prisma parametrizado + DTO estrito; A04 máquina de estados e limites; A05 Helmet, CORS restrito, sem stack trace em produção; A06 `npm audit --audit-level=high` no CI; A07 rate limit + rotação/reuso de refresh; A08 versões imutáveis + idempotência; A09 auditoria + logs mascarados; A10 URL externa só do ambiente.

## 8. Testes, CI e deploy

- **Unitários (Jest):** pontuação (mesmos casos e valores de `SRC/app/src/sessao/regras.test.ts` + penalidade, conquistas, recomendações, indicadores); máquina de estados (tabela 5.2 inteira, válidas e inválidas); validação de `conteudo`; simulador com timers falsos, incluindo latência da emergência; refresh com reuso.
- **E2E (supertest + socket.io-client):** cenário de aceitação da §9 contra o schema `tennis_test` no Supabase (`DATABASE_URL_TEST`), resetado a cada execução: autor cria, valida e publica → app lista e busca → cadastra dispositivo → cria e inicia sessão → recebe ≥ 2 lançamentos → envia golpes (com um lote duplicado) → EMERGENCIA → PAUSAR rejeitado com 409 → REINICIAR → ENCERRAR → resumo correto → outbox entregue ao mock → sessão visível no histórico e na auditoria. Mais: sincronização offline idempotente e dependente bloqueado em treino `ADULTO`.
- **CI** (`.github/workflows/backend.yml`): `npm ci`, `tsc --noEmit`, testes unitários, `npm audit --omit=dev --audit-level=high`, build da imagem Docker; job E2E opcional, ligado por variável de repositório e segredos. Sem ESLint no MVP: a checagem estrita de tipos cobre a verificação estática.
- **Deploy:** Dockerfile multiestágio (Node 22 alpine, usuário não root, healthcheck), `.env.example`, `render.yaml` na raiz do repositório (o Render exige); `prisma migrate deploy` no start. Docker não está instalado na máquina de desenvolvimento: o build da imagem é verificado no CI.
- **Docs:** `SRC/backend/README.md` com passo a passo reproduzível; `SRC/backend/docs/openapi.json` gerado por `npm run openapi` (plugin do Swagger documenta DTOs a partir dos decorators e comentários).

## 9. Matriz de rastreabilidade

| Requisito | Atendido por |
|---|---|
| RF01 | 5.7, `auth` |
| RF02 | `praticante` |
| RF03 | `GET treinos` com filtros; importação da plataforma mãe |
| RF04 | `conteudo` (instruções, regras, equipamentos, riscos, parâmetros, pontuação) |
| RF05 | 5.6 |
| RF06 | 5.2 |
| RF07 | `evento_sessao` GOLPE com `ocorrido_em` |
| RF08 | firmware (fora do backend) |
| RF09 | 5.3 |
| RF10 | 5.4 (pontos, bônus, penalidade, sequência, conquistas) |
| RF11 | `modoPublico` + dependentes + limite infantil |
| RF12 | resumo com metas, conquistas, recomendações |
| RF13 | `historico`, indicadores |
| RF14 | `conteudo` editável em RASCUNHO |
| RF15 | validar + ensaiar |
| RF16 | 5.1, `notas_alteracao`, `compatibilidade_firmware`, auditoria |
| RF17 | `admin` |
| RF18 | REST + OpenAPI + importação |
| RF19 | 5.5 |
| RF20 | `marketplace_metadados` |
| RF21 | 5.4 sincronização |
| RF22 | 5.2 PARADA_SEGURA |
| RF23 | `auditoria` |
| RNF Segurança | 5.7, 7, papel `tennis_api`, schema `tennis` + RLS |
| RNF Cibersegurança IoT | 5.6, incidentes |
| RNF Segurança física | 5.2, 5.3 limites, falhas automáticas |
| RNF Desempenho | meta 200 ms p95, `/metrics` |
| RNF Disponibilidade | idempotência, outbox, degradação segura |
| RNF Interoperabilidade | `/api/v1`, OpenAPI, versão de treino |
| RNF Privacidade/LGPD | 5.8 |
| RNF Manutenibilidade | módulos, testes, README, CI |
| RNF Escalabilidade | API sem estado (exceto simulador, ver 10) |
| RNF Observabilidade | pino + `x-request-id` + `/metrics` + auditoria |
| §1 Restrição física | só simulador; sem engenharia reversa |
| §9 Cenário de aceitação | teste E2E |

## 10. Limitações declaradas (§12)

1. Link BLE raquete↔app sem autenticação no firmware atual (fora do backend; citar no relatório de Cibersegurança).
2. Modo offline executa sem simulador da máquina.
3. Simulador em instância única; escalar exige mover o estado em memória para armazenamento compartilhado.
4. App e site ainda não consomem a API.
5. Os papéis `tennis_owner` e `tennis_api` são criados uma vez por `prisma/sql/papeis.sql` (fora das migrations, porque envolvem senhas); as senhas ficam só no ambiente.
6. Um access token continua válido por até 15 min após a desativação da conta (o refresh é revogado na hora).
7. O pseudônimo do praticante enviado à plataforma mãe deriva do `JWT_SECRET`; trocar o segredo muda os pseudônimos.

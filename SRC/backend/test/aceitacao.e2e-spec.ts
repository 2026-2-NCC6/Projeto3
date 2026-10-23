import { randomUUID } from 'node:crypto';
import { Socket } from 'socket.io-client';
import { conteudoValido } from '../src/treinos/conteudo.fixture';
import { Contexto, clienteDono, conectarMaquina, esperarEventos, prepararBanco, subirApp } from './utilitarios';

// Cenário de aceitação da §9 do edital, de ponta a ponta, mais os casos da seção 8 da spec.
describe('Cenário de aceitação (§9)', () => {
  let ctx: Contexto;
  let tokenAdmin: string;
  let tokenAutor: string;
  let tokenJogador: string;
  let refreshJogador: string;
  let titularId: string;
  let dispositivoId: string;
  const slug = 'alternancia-e2e';
  const sessaoId = randomUUID();
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function cadastrar(email: string, faixaEtaria = 'DE_18_A_29') {
    const r = await ctx.http.post('/api/v1/auth/cadastro').send({
      email,
      senha: 'Senha123segura',
      nome: 'Pessoa Teste',
      declaraMaioridade: true,
      termosVersao: '2026-10',
      faixaEtaria,
      nivel: 'INTERMEDIARIO'
    });
    expect(r.status).toBe(201);
    return r.body as { accessToken: string; refreshToken: string; usuario: { id: string } };
  }

  async function login(email: string, senha: string) {
    const r = await ctx.http.post('/api/v1/auth/login').send({ email, senha });
    expect(r.status).toBe(200);
    return r.body as { accessToken: string; refreshToken: string };
  }

  beforeAll(async () => {
    await prepararBanco();
    ctx = await subirApp();
    tokenAdmin = (await login(process.env.ADMIN_EMAIL!, process.env.ADMIN_SENHA!)).accessToken;
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  it('admin promove um cadastro a autor (RF01, RF17)', async () => {
    const autor = await cadastrar('autor.e2e@exemplo.dev');
    const r = await ctx.http.patch(`/api/v1/admin/usuarios/${autor.usuario.id}`).set(auth(tokenAdmin)).send({ papel: 'AUTOR' });
    expect(r.status).toBe(200);
    tokenAutor = (await login('autor.e2e@exemplo.dev', 'Senha123segura')).accessToken;
  });

  it('jogador não cria treino (RF01)', async () => {
    const jogador = await cadastrar('jogador.e2e@exemplo.dev');
    tokenJogador = jogador.accessToken;
    refreshJogador = jogador.refreshToken;
    const r = await ctx.http.post('/api/v1/treinos').set(auth(tokenJogador)).send({ slug: 'x', nome: 'x', conteudo: conteudoValido() });
    expect(r.status).toBe(403);
  });

  it('autor cria, valida, ensaia e publica um treino (RF14, RF15, RF16, RF20)', async () => {
    const conteudo = conteudoValido();
    conteudo.exercicios[0] = {
      ...conteudo.exercicios[0],
      repeticoes: 3,
      golpeEsperado: 'ALTERNADO',
      lancamento: { ...conteudo.exercicios[0].lancamento, intervaloSeg: 1.5 }
    };
    conteudo.conclusao = { tipo: 'REPETICOES', valor: 3 };

    const criado = await ctx.http
      .post('/api/v1/treinos')
      .set(auth(tokenAutor))
      .send({ slug, nome: 'Alternância E2E', conteudo, notasAlteracao: 'Primeira versão' });
    expect(criado.status).toBe(201);
    expect(criado.body.versao).toMatchObject({ numero: 1, status: 'RASCUNHO' });

    const validacao = await ctx.http.post(`/api/v1/treinos/${slug}/versoes/1/validar`).set(auth(tokenAutor));
    expect(validacao.body).toEqual({ valido: true, erros: [] });

    const ensaio = await ctx.http.post(`/api/v1/treinos/${slug}/versoes/1/ensaiar`).set(auth(tokenAutor));
    expect(ensaio.status).toBe(200);
    expect(ensaio.body.lancamentos.map((l: { golpeEsperado: string }) => l.golpeEsperado)).toEqual(['Forehand', 'Backhand', 'Forehand']);

    expect((await ctx.http.post(`/api/v1/treinos/${slug}/versoes/1/publicar`).set(auth(tokenAutor))).status).toBe(409);
    expect((await ctx.http.post(`/api/v1/treinos/${slug}/versoes/1/enviar-revisao`).set(auth(tokenAutor))).status).toBe(200);
    const publicada = await ctx.http.post(`/api/v1/treinos/${slug}/versoes/1/publicar`).set(auth(tokenAutor));
    expect(publicada.body).toMatchObject({ status: 'PUBLICADA' });

    const editar = await ctx.http.patch(`/api/v1/treinos/${slug}/versoes/1`).set(auth(tokenAutor)).send({ notasAlteracao: 'mudança' });
    expect(editar.status).toBe(409);

    const mkt = await ctx.http.put(`/api/v1/treinos/${slug}/marketplace`).set(auth(tokenAutor)).send({
      descricaoComercial: 'Treino de alternância para intermediários',
      licenca: 'CC_BY',
      modeloRemuneracao: 'GRATUITO'
    });
    expect(mkt.status).toBe(200);
  });

  it('app encontra o treino no catálogo e baixa a versão com ETag (RF03, RF04, RF18, RF21)', async () => {
    const lista = await ctx.http.get('/api/v1/treinos?nivel=INTERMEDIARIO&sensor=IMU').set(auth(tokenJogador));
    expect(lista.body.map((t: { slug: string }) => t.slug)).toContain(slug);

    const detalhe = await ctx.http.get(`/api/v1/treinos/${slug}`).set(auth(tokenJogador));
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.conteudo.riscos.length).toBeGreaterThan(0);
    expect(detalhe.headers.etag).toBeDefined();
    const deNovo = await ctx.http.get(`/api/v1/treinos/${slug}`).set(auth(tokenJogador)).set('If-None-Match', detalhe.headers.etag);
    expect(deNovo.status).toBe(304);
  });

  it('praticante registra a raquete e reporta o status (RF05)', async () => {
    const praticantes = await ctx.http.get('/api/v1/praticantes').set(auth(tokenJogador));
    titularId = praticantes.body.find((p: { tipo: string }) => p.tipo === 'TITULAR').id;

    const d = await ctx.http
      .post('/api/v1/dispositivos')
      .set(auth(tokenJogador))
      .send({ nomeBle: 'ArduinoR4-IMU', identificador: 'AA:BB:CC:00:11:22', firmwareVersao: '1.2.0' });
    expect(d.status).toBe(201);
    dispositivoId = d.body.id;

    const status = await ctx.http
      .put(`/api/v1/dispositivos/${dispositivoId}/status`)
      .set(auth(tokenJogador))
      .send({ conectado: true, sensores: { imu: 'OK' }, bateriaPct: 80 });
    expect(status.status).toBe(200);
  });

  it('executa a sessão com simulador, parada segura e sincroniza o resultado (RF06–RF10, RF19, RF22, RF23)', async () => {
    const criada = await ctx.http
      .post('/api/v1/sessoes')
      .set(auth(tokenJogador))
      .send({ id: sessaoId, praticanteId: titularId, treinoSlug: slug, dispositivoId, origem: 'SENSOR' });
    expect(criada.status).toBe(201);
    expect(criada.body.estado).toBe('CRIADA');

    const socket: Socket = await conectarMaquina(ctx.url, tokenJogador);
    try {
      const entrada = await socket.emitWithAck('entrar', { sessaoId });
      expect(entrada).toMatchObject({ ok: true });

      const lancamentos = esperarEventos<{ seq: number }>(socket, 'lancamento', 2);
      const iniciar = await ctx.http.post(`/api/v1/sessoes/${sessaoId}/comandos`).set(auth(tokenJogador)).send({ comando: 'INICIAR' });
      expect(iniciar.body.estado).toBe('EM_EXECUCAO');
      expect((await lancamentos).map((l) => l.seq)).toEqual([1, 2]);

      const agora = Date.now();
      const lote = {
        eventos: [
          { id: randomUUID(), tipo: 'GOLPE', tMs: 1600, ocorridoEm: new Date(agora).toISOString(), dados: { lado: 'Forehand', forca: 2, picoG: 3.1, picoGiro: 9.2, seq: 1 } },
          { id: randomUUID(), tipo: 'GOLPE', tMs: 3100, ocorridoEm: new Date(agora + 1500).toISOString(), dados: { lado: 'Backhand', forca: 2, picoG: 2.8, picoGiro: 8.7, seq: 2 } }
        ]
      };
      const r1 = await ctx.http.post(`/api/v1/sessoes/${sessaoId}/eventos`).set(auth(tokenJogador)).send(lote);
      expect(r1.body).toMatchObject({ aceitos: 2, duplicados: 0, parcial: { golpes: 2, acertos: 2, pontos: 35 } });
      const r2 = await ctx.http.post(`/api/v1/sessoes/${sessaoId}/eventos`).set(auth(tokenJogador)).send(lote);
      expect(r2.body).toMatchObject({ aceitos: 0, duplicados: 2, parcial: { golpes: 2 } });

      const parada = esperarEventos<{ motivo: string }>(socket, 'parada', 1);
      const emergencia = await ctx.http
        .post(`/api/v1/sessoes/${sessaoId}/comandos`)
        .set(auth(tokenJogador))
        .send({ comando: 'EMERGENCIA', motivo: 'bola_na_quadra' });
      expect(emergencia.body.estado).toBe('PARADA_SEGURA');
      expect((await parada)[0].motivo).toBe('bola_na_quadra');
    } finally {
      socket.disconnect();
    }

    const bloqueado = await ctx.http.post(`/api/v1/sessoes/${sessaoId}/comandos`).set(auth(tokenJogador)).send({ comando: 'RETOMAR' });
    expect(bloqueado.status).toBe(409);

    const outra = await ctx.http
      .post('/api/v1/sessoes')
      .set(auth(tokenJogador))
      .send({ id: randomUUID(), praticanteId: titularId, treinoSlug: slug, dispositivoId, origem: 'SENSOR' });
    expect(outra.status).toBe(409);

    const semConfirmar = await ctx.http.post(`/api/v1/sessoes/${sessaoId}/comandos`).set(auth(tokenJogador)).send({ comando: 'REINICIAR' });
    expect(semConfirmar.status).toBe(422);
    const reiniciada = await ctx.http
      .post(`/api/v1/sessoes/${sessaoId}/comandos`)
      .set(auth(tokenJogador))
      .send({ comando: 'REINICIAR', areaSegura: true });
    expect(reiniciada.body.estado).toBe('PAUSADA');

    const encerrada = await ctx.http
      .post(`/api/v1/sessoes/${sessaoId}/comandos`)
      .set(auth(tokenJogador))
      .send({ comando: 'ENCERRAR', pontosCliente: 35 });
    expect(encerrada.body.estado).toBe('ENCERRADA');
    expect(encerrada.body.resumo).toMatchObject({ golpes: 2, acertos: 2, pontos: 35, precisao: 100, metaAtingida: true });
    expect(encerrada.body.resumo.conquistas).toContain('PRIMEIRA_SESSAO');
    expect(encerrada.body.divergencia).toBe(false);

    const processar = await ctx.http.post('/api/v1/admin/integracao/processar').set(auth(tokenAdmin));
    expect(processar.body).toMatchObject({ enviados: 1, falhas: 0 });
    const envios = await ctx.http.get('/api/v1/admin/integracao/envios').set(auth(tokenAdmin));
    expect(envios.body.find((e: { idempotencyKey: string }) => e.idempotencyKey === `${sessaoId}:RESUMO`)).toMatchObject({ status: 'ENVIADO' });
    // Sem consentimento de telemetria, os eventos brutos não saem (RF19 "quando autorizado").
    expect(envios.body.find((e: { idempotencyKey: string }) => e.idempotencyKey === `${sessaoId}:EVENTOS`)).toBeUndefined();

    const dono = clienteDono();
    const recebido = await dono.mockPlataformaResultado.findUnique({ where: { idempotencyKey: `${sessaoId}:RESUMO` } });
    await dono.$disconnect();
    expect(recebido).not.toBeNull();
    expect(JSON.stringify(recebido!.payload)).not.toContain(titularId);
  });

  it('resultado aparece no histórico e nos indicadores (RF12, RF13)', async () => {
    const hist = await ctx.http.get(`/api/v1/praticantes/${titularId}/sessoes`).set(auth(tokenJogador));
    expect(hist.body.map((s: { id: string }) => s.id)).toContain(sessaoId);
    const ind = await ctx.http.get(`/api/v1/praticantes/${titularId}/indicadores`).set(auth(tokenJogador));
    expect(ind.body).toMatchObject({ sessoes: 1, volume: 2, precisao: 100 });
  });

  it('auditoria registra emergência e o comando bloqueado como incidente (RF23)', async () => {
    const r = await ctx.http.get('/api/v1/admin/auditoria?severidade=INCIDENTE').set(auth(tokenAdmin));
    expect(r.body.itens.map((a: { acao: string }) => a.acao)).toContain('COMANDO_BLOQUEADO_PARADA_SEGURA');
    const e = await ctx.http.get('/api/v1/admin/auditoria?acao=SESSAO_EMERGENCIA').set(auth(tokenAdmin));
    expect(e.body.itens).toHaveLength(1);
    expect((await ctx.http.get('/api/v1/admin/auditoria').set(auth(tokenJogador))).status).toBe(403);
  });

  it('sincronização offline é idempotente (RF21)', async () => {
    const id = randomUUID();
    const corpo = {
      sessao: {
        id,
        praticanteId: titularId,
        treinoSlug: slug,
        versaoNumero: 1,
        origem: 'SENSOR',
        iniciadaEm: new Date(Date.now() - 60000).toISOString(),
        encerradaEm: new Date().toISOString(),
        pontosCliente: 999
      },
      eventos: [
        { id: randomUUID(), tipo: 'GOLPE', tMs: 2000, ocorridoEm: new Date().toISOString(), dados: { lado: 'Forehand', forca: 3, picoG: 4, picoGiro: 10, seq: 1 } }
      ]
    };
    const r1 = await ctx.http.post('/api/v1/sessoes/sincronizar').set(auth(tokenJogador)).send(corpo);
    expect(r1.status).toBe(200);
    expect(r1.body).toMatchObject({ estado: 'ENCERRADA', offline: true, divergencia: true, resumo: { pontos: 20 } });
    const r2 = await ctx.http.post('/api/v1/sessoes/sincronizar').set(auth(tokenJogador)).send(corpo);
    expect(r2.body.resumo).toEqual(r1.body.resumo);
    const hist = await ctx.http.get(`/api/v1/praticantes/${titularId}/sessoes`).set(auth(tokenJogador));
    expect(hist.body.filter((s: { id: string }) => s.id === id)).toHaveLength(1);
  });

  it('dependente só executa treinos infantis ou para todos (RF11, LGPD)', async () => {
    const semConsentimento = await ctx.http
      .post('/api/v1/praticantes/dependentes')
      .set(auth(tokenJogador))
      .send({ apelido: 'Pequeno', faixaEtaria: 'DE_10_A_13', consentimentoParental: false });
    expect(semConsentimento.status).toBe(422);

    const dep = await ctx.http
      .post('/api/v1/praticantes/dependentes')
      .set(auth(tokenJogador))
      .send({ apelido: 'Pequeno', faixaEtaria: 'DE_10_A_13', consentimentoParental: true });
    expect(dep.status).toBe(201);
    expect(dep.body.consenteTelemetria).toBe(false);

    const r = await ctx.http
      .post('/api/v1/sessoes')
      .set(auth(tokenJogador))
      .send({ id: randomUUID(), praticanteId: dep.body.id, treinoSlug: slug, origem: 'DEMO' });
    expect(r.status).toBe(403);

    const outroUsuario = await cadastrar('curioso.e2e@exemplo.dev');
    const alheio = await ctx.http.get(`/api/v1/praticantes/${dep.body.id}/sessoes`).set(auth(outroUsuario.accessToken));
    expect(alheio.status).toBe(404);
  });

  it('reuso de refresh token revoga a família (RNF Segurança)', async () => {
    const novo = await ctx.http.post('/api/v1/auth/refresh').send({ refreshToken: refreshJogador });
    expect(novo.status).toBe(200);
    const reuso = await ctx.http.post('/api/v1/auth/refresh').send({ refreshToken: refreshJogador });
    expect(reuso.status).toBe(401);
    const depois = await ctx.http.post('/api/v1/auth/refresh').send({ refreshToken: novo.body.refreshToken });
    expect(depois.status).toBe(401);
  });

  it('importa treinos da plataforma mãe sem duplicar (§1, RF03, RF18)', async () => {
    const r1 = await ctx.http.post('/api/v1/admin/integracao/importar-treinos').set(auth(tokenAdmin));
    expect(r1.status).toBe(200);
    expect(r1.body.criados).toBeGreaterThan(0);
    const r2 = await ctx.http.post('/api/v1/admin/integracao/importar-treinos').set(auth(tokenAdmin));
    expect(r2.body).toMatchObject({ criados: 0, atualizados: 0 });
    const lista = await ctx.http.get('/api/v1/treinos').set(auth(tokenJogador));
    expect(lista.body.some((t: { origem: string }) => t.origem === 'PLATAFORMA_MAE')).toBe(true);
  });

  it('expõe saúde e documentação da API', async () => {
    expect((await ctx.http.get('/api/v1/health')).body).toMatchObject({ status: 'ok', banco: 'ok' });
    expect((await ctx.http.get('/api/v1/metrics')).status).toBe(401);
  });
});

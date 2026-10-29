import { randomUUID } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import { RetencaoService } from '../src/privacidade/retencao.service';
import { Contexto, clienteDono, prepararBanco, subirApp } from './utilitarios';

// Testes de segurança do relatório de Redes (Entrega 2): cada caso reproduz um ataque e confere
// que ele é barrado. Os IDs S-xx são os do Plano de Respostas aos Riscos.
describe('Segurança da API', () => {
  let ctx: Contexto;
  const SENHA = 'Senha123segura';
  const DIA_MS = 86_400_000;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function cadastrar(email: string) {
    const r = await ctx.http.post('/api/v1/auth/cadastro').send({
      email,
      senha: SENHA,
      nome: 'Pessoa Teste',
      declaraMaioridade: true,
      termosVersao: '2026-10',
      faixaEtaria: 'DE_18_A_29',
      nivel: 'INICIANTE'
    });
    expect(r.status).toBe(201);
    return r.body as { accessToken: string; usuario: { id: string } };
  }

  async function titularDe(token: string): Promise<string> {
    const r = await ctx.http.get('/api/v1/praticantes').set(auth(token));
    return r.body.find((p: { tipo: string }) => p.tipo === 'TITULAR').id;
  }

  /** Nenhuma resposta de erro pode trazer stack trace ou caminho interno do servidor. */
  function semDetalhesInternos(corpo: string) {
    expect(corpo).not.toMatch(/node_modules|\bat \w+ \(|\.ts:\d+|\.js:\d+/);
  }

  beforeAll(async () => {
    await prepararBanco();
    ctx = await subirApp();
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  describe('S-17: acesso a dados de outra conta (A01)', () => {
    it('uma conta não lê, altera nem apaga o praticante de outra', async () => {
      const vitima = await cadastrar('vitima.seg@exemplo.dev');
      const atacante = await cadastrar('atacante.seg@exemplo.dev');
      const alvo = await titularDe(vitima.accessToken);

      const ler = await ctx.http.get(`/api/v1/praticantes/${alvo}/sessoes`).set(auth(atacante.accessToken));
      const alterar = await ctx.http.patch(`/api/v1/praticantes/${alvo}`).set(auth(atacante.accessToken)).send({ nivel: 'AVANCADO' });
      const indicadores = await ctx.http.get(`/api/v1/praticantes/${alvo}/indicadores`).set(auth(atacante.accessToken));
      // 404, e não 403: a resposta não confirma que o ID existe.
      expect([ler.status, alterar.status, indicadores.status]).toEqual([404, 404, 404]);

      const dono = await ctx.http.get('/api/v1/praticantes').set(auth(vitima.accessToken));
      expect(dono.body.find((p: { id: string }) => p.id === alvo).nivel).toBe('INICIANTE');
    });

    it('jogador não acessa rotas de administração', async () => {
      const jogador = await cadastrar('jogador.seg@exemplo.dev');
      expect((await ctx.http.get('/api/v1/admin/usuarios').set(auth(jogador.accessToken))).status).toBe(403);
      expect((await ctx.http.get('/api/v1/admin/auditoria').set(auth(jogador.accessToken))).status).toBe(403);
    });

    it('rota protegida sem token responde 401', async () => {
      expect((await ctx.http.get('/api/v1/me')).status).toBe(401);
    });
  });

  describe('S-18: tokens forjados e força bruta (A07)', () => {
    let usuarioId: string;

    beforeAll(async () => {
      usuarioId = (await cadastrar('alvo.token@exemplo.dev')).usuario.id;
    });

    it('token assinado com outro segredo é recusado', async () => {
      const forjado = jwt.sign({ sub: usuarioId, papel: 'ADMIN' }, 'segredo-adivinhado-pelo-atacante-0123456789', { algorithm: 'HS256', expiresIn: '15m' });
      expect((await ctx.http.get('/api/v1/me').set(auth(forjado))).status).toBe(401);
      expect((await ctx.http.get('/api/v1/admin/usuarios').set(auth(forjado))).status).toBe(401);
    });

    it('token sem assinatura (alg none) é recusado', async () => {
      const semAssinatura = jwt.sign({ sub: usuarioId, papel: 'ADMIN' }, '', { algorithm: 'none' });
      expect((await ctx.http.get('/api/v1/me').set(auth(semAssinatura))).status).toBe(401);
    });

    it('token expirado é recusado, mesmo com o segredo certo', async () => {
      const expirado = jwt.sign({ sub: usuarioId, papel: 'JOGADOR', exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET!, { algorithm: 'HS256' });
      expect((await ctx.http.get('/api/v1/me').set(auth(expirado))).status).toBe(401);
    });

    it('e-mail inexistente e senha errada recebem a mesma resposta', async () => {
      const inexistente = await ctx.http.post('/api/v1/auth/login').send({ email: 'ninguem.seg@exemplo.dev', senha: 'Qualquer123senha' });
      const senhaErrada = await ctx.http.post('/api/v1/auth/login').send({ email: 'alvo.token@exemplo.dev', senha: 'Errada123senha' });
      expect(inexistente.status).toBe(401);
      expect(senhaErrada.status).toBe(401);
      expect([inexistente.body.codigo, inexistente.body.mensagem]).toEqual([senhaErrada.body.codigo, senhaErrada.body.mensagem]);
    });

    it('a sexta tentativa de login em um minuto é bloqueada, mesmo com a senha certa', async () => {
      await cadastrar('forca.bruta@exemplo.dev');
      for (let i = 0; i < 5; i++) {
        const r = await ctx.http.post('/api/v1/auth/login').send({ email: 'forca.bruta@exemplo.dev', senha: `Errada${i}senha` });
        expect(r.status).toBe(401);
      }
      const sexta = await ctx.http.post('/api/v1/auth/login').send({ email: 'forca.bruta@exemplo.dev', senha: SENHA });
      expect(sexta.status).toBe(429);
      expect(sexta.body.codigo).toBe('MUITAS_REQUISICOES');
    });
  });

  describe('S-21: configuração HTTP (A05)', () => {
    it('envia os cabeçalhos de segurança e esconde a tecnologia do servidor', async () => {
      const r = await ctx.http.get('/api/v1/health');
      expect(r.headers['x-content-type-options']).toBe('nosniff');
      expect(r.headers['x-frame-options']).toBeDefined();
      expect(r.headers['content-security-policy']).toContain("default-src 'self'");
      expect(r.headers['strict-transport-security']).toMatch(/max-age=\d+/);
      expect(r.headers['x-powered-by']).toBeUndefined();
    });

    it('CORS: origem da lista recebe permissão; origem desconhecida, não', async () => {
      const permitida = await ctx.http.get('/api/v1/health').set('Origin', 'http://localhost:5173');
      expect(permitida.headers['access-control-allow-origin']).toBe('http://localhost:5173');

      const estranha = await ctx.http.get('/api/v1/health').set('Origin', 'https://site-malicioso.example');
      expect(estranha.headers['access-control-allow-origin']).toBeUndefined();

      const preflight = await ctx.http
        .options('/api/v1/auth/login')
        .set('Origin', 'https://site-malicioso.example')
        .set('Access-Control-Request-Method', 'POST');
      expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('campo não previsto no corpo é recusado', async () => {
      const r = await ctx.http.post('/api/v1/auth/cadastro').send({
        email: 'campo.extra@exemplo.dev',
        senha: SENHA,
        nome: 'Pessoa Teste',
        declaraMaioridade: true,
        termosVersao: '2026-10',
        faixaEtaria: 'DE_18_A_29',
        papel: 'ADMIN'
      });
      expect(r.status).toBe(400);
      expect(r.body.codigo).toBe('VALIDACAO');
    });

    it('JSON malformado responde 400 no formato da API, sem detalhes internos', async () => {
      const r = await ctx.http.post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"email": "x@y.dev", "senha":');
      expect(r.status).toBe(400);
      expect(r.headers['content-type']).toMatch(/application\/json/);
      expect(r.body.codigo).toBeDefined();
      semDetalhesInternos(r.text);
    });

    it('corpo acima do limite responde 413 no formato da API, sem detalhes internos', async () => {
      const r = await ctx.http
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ email: 'x@y.dev', senha: 'a'.repeat(200_000) }));
      expect(r.status).toBe(413);
      expect(r.headers['content-type']).toMatch(/application\/json/);
      semDetalhesInternos(r.text);
    });

    it('ID fora do formato UUID não chega ao banco', async () => {
      const u = await cadastrar('uuid.seg@exemplo.dev');
      const r = await ctx.http.get("/api/v1/praticantes/1' OR '1'='1/sessoes").set(auth(u.accessToken));
      expect(r.status).toBe(400);
      semDetalhesInternos(r.text);
    });
  });

  describe('S-07: direitos do titular e retenção (LGPD)', () => {
    it('exporta os dados da própria conta, sem senha e sem dados de outras contas', async () => {
      const outra = await cadastrar('outra.lgpd@exemplo.dev');
      const titular = await cadastrar('titular.lgpd@exemplo.dev');
      const r = await ctx.http.get('/api/v1/me/exportar').set(auth(titular.accessToken));
      expect(r.status).toBe(200);
      expect(r.body.conta.email).toBe('titular.lgpd@exemplo.dev');
      expect(r.text).not.toMatch(/senhaHash|senha_hash/);
      expect(r.text).not.toContain(outra.usuario.id);
    });

    it('exclui a conta só com a senha certa; depois disso o login falha e os praticantes somem', async () => {
      const u = await cadastrar('excluir.lgpd@exemplo.dev');
      const errada = await ctx.http.delete('/api/v1/me').set(auth(u.accessToken)).send({ senha: 'Errada123senha' });
      expect(errada.status).toBe(401);

      const certa = await ctx.http.delete('/api/v1/me').set(auth(u.accessToken)).send({ senha: SENHA });
      expect(certa.status).toBe(204);

      const login = await ctx.http.post('/api/v1/auth/login').send({ email: 'excluir.lgpd@exemplo.dev', senha: SENHA });
      expect(login.status).toBe(401);

      const dono = clienteDono();
      try {
        expect(await dono.praticante.count({ where: { contaId: u.usuario.id } })).toBe(0);
        const conta = await dono.usuario.findUniqueOrThrow({ where: { id: u.usuario.id } });
        expect(conta.email).not.toContain('excluir.lgpd');
        expect(conta.anonimizadoEm).not.toBeNull();
      } finally {
        await dono.$disconnect();
      }
    });

    it('a retenção apaga golpes antigos, com prazo menor para dependentes, e mantém o resumo', async () => {
      const u = await cadastrar('retencao.lgpd@exemplo.dev');
      const titular = await titularDe(u.accessToken);
      const dep = await ctx.http
        .post('/api/v1/praticantes/dependentes')
        .set(auth(u.accessToken))
        .send({ apelido: 'Pequeno', faixaEtaria: 'DE_10_A_13', consentimentoParental: true });
      expect(dep.status).toBe(201);

      const dono = clienteDono();
      try {
        const versao = await dono.treinoVersao.findFirstOrThrow({ where: { status: 'PUBLICADA' } });
        const sessao = async (praticanteId: string, diasAtras: number) => {
          const id = randomUUID();
          const fim = new Date(Date.now() - diasAtras * DIA_MS);
          await dono.sessao.create({
            data: { id, praticanteId, treinoVersaoId: versao.id, origem: 'SENSOR', estado: 'ENCERRADA', iniciadaEm: fim, encerradaEm: fim, resumo: { pontos: 10 } }
          });
          await dono.eventoSessao.create({ data: { id: randomUUID(), sessaoId: id, tipo: 'GOLPE', tMs: 1000, ocorridoEm: fim, dados: { lado: 'Forehand' } } });
          return id;
        };
        const titularAntiga = await sessao(titular, 200);
        const titularRecente = await sessao(titular, 40);
        const dependenteAntiga = await sessao(dep.body.id, 40);
        const dependenteRecente = await sessao(dep.body.id, 5);

        await ctx.app.get(RetencaoService).aplicar();

        const eventos = (sessaoId: string) => dono.eventoSessao.count({ where: { sessaoId } });
        // Padrões: 180 dias para titular, 30 para dependente.
        expect(await eventos(titularAntiga)).toBe(0);
        expect(await eventos(titularRecente)).toBe(1);
        expect(await eventos(dependenteAntiga)).toBe(0);
        expect(await eventos(dependenteRecente)).toBe(1);
        expect((await dono.sessao.findUniqueOrThrow({ where: { id: titularAntiga } })).resumo).toEqual({ pontos: 10 });
      } finally {
        await dono.$disconnect();
      }
    });
  });
});

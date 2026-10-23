import { HttpStatus, Injectable } from '@nestjs/common';
import { EstadoSessao, Praticante, Prisma, Sessao, TipoEvento, TreinoVersao } from '@prisma/client';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { ContextoRequisicao } from '../comum/contexto';
import { ErroApi, conflito, invalido, naoEncontrado } from '../comum/erros';
import { versaoAtende } from '../comum/versao';
import { DispositivosService } from '../dispositivos/dispositivos.service';
import { OutboxService } from '../integracao/outbox.service';
import { MaquinaService } from '../maquina/maquina.service';
import { sequenciaEsperada } from '../maquina/plano';
import { recomendar } from '../pontuacao/analise';
import { calcularConquistas, resumirSessao } from '../pontuacao/regras';
import { ParametrosService } from '../parametros/parametros.service';
import { PraticantesService } from '../praticantes/praticantes.service';
import { PrismaService } from '../prisma/prisma.service';
import { Metricas } from '../saude/metricas';
import type { ConteudoTreino, ModoPublico } from '../treinos/conteudo';
import { TreinosService } from '../treinos/treinos.service';
import { ComandoDto, CriarSessaoDto, DadosErroDto, DadosEstadoDto, DadosGolpeDto, EventoDto, LoteEventosDto, SincronizarDto } from './dto';
import { ESTADOS_ATIVOS, Gatilho, transicao } from './estado';
import { golpesDosEventos } from './golpes';

type SessaoCompleta = Sessao & { praticante: Praticante; versao: TreinoVersao & { treino: { slug: string } } };

const INCLUIR = { praticante: true, versao: { include: { treino: { select: { slug: true } } } } } as const;
const DADOS_POR_TIPO: Record<EventoDto['tipo'], ClassConstructor<object>> = { GOLPE: DadosGolpeDto, ERRO: DadosErroDto, ESTADO: DadosEstadoDto };
const TOLERANCIA_RELOGIO_MS = 5 * 60_000;

const modosDoPraticante = (p: Praticante): ModoPublico[] => (p.tipo === 'DEPENDENTE' ? ['INFANTIL', 'TODOS'] : ['INFANTIL', 'ADULTO', 'TODOS']);
const conteudoDe = (s: SessaoCompleta) => s.versao.conteudo as unknown as ConteudoTreino;

@Injectable()
export class SessoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly praticantes: PraticantesService,
    private readonly dispositivos: DispositivosService,
    private readonly treinos: TreinosService,
    private readonly maquina: MaquinaService,
    private readonly outbox: OutboxService,
    private readonly parametros: ParametrosService,
    private readonly auditoria: AuditoriaService,
    private readonly metricas: Metricas
  ) {}

  async criar(dto: CriarSessaoDto, ctx: ContextoRequisicao) {
    const praticante = await this.praticantes.garantirPosse(dto.praticanteId, ctx.usuario.id);
    const existente = await this.prisma.sessao.findUnique({ where: { id: dto.id }, include: INCLUIR });
    if (existente) {
      // Repetição da mesma criação (ex.: timeout no app): devolve a sessão em vez de falhar.
      if (existente.praticanteId === dto.praticanteId) return this.visao(existente);
      throw conflito('SESSAO_EXISTENTE', 'Já existe uma sessão com este id.');
    }

    const versao = await this.versaoExecutavel(dto.treinoSlug, dto.versaoNumero, ['PUBLICADA']);
    this.garantirPublico(praticante, versao);
    if (dto.origem === 'SENSOR' && !dto.dispositivoId) throw invalido('DISPOSITIVO_OBRIGATORIO', 'Sessões com sensor precisam da raquete pareada.');
    if (dto.dispositivoId) await this.garantirDispositivoApto(dto.dispositivoId, versao, ctx, dto.id);

    const sessao = await this.prisma.sessao.create({
      data: { id: dto.id, praticanteId: praticante.id, treinoVersaoId: versao.id, dispositivoId: dto.dispositivoId, origem: dto.origem },
      include: INCLUIR
    });
    await this.auditoria.registrar(ctx, { acao: 'SESSAO_CRIADA', alvoTipo: 'sessao', alvoId: sessao.id, detalhes: { treino: dto.treinoSlug, versao: versao.numero } });
    return this.visao(sessao);
  }

  async obter(id: string, ctx: ContextoRequisicao) {
    return this.visao(await this.carregar(id, ctx));
  }

  /** RF06/RF22: aplica um comando seguindo a máquina de estados (sessoes/estado.ts). */
  async comando(id: string, dto: ComandoDto, ctx: ContextoRequisicao) {
    const sessao = await this.carregar(id, ctx);
    const gatilho: Gatilho = dto.comando;
    const proximo = transicao(sessao.estado, gatilho);

    if (!proximo) {
      if (sessao.estado === 'PARADA_SEGURA') {
        await this.auditoria.registrar(ctx, {
          acao: 'COMANDO_BLOQUEADO_PARADA_SEGURA',
          alvoTipo: 'sessao',
          alvoId: id,
          severidade: 'INCIDENTE',
          detalhes: { comando: gatilho }
        });
      }
      throw conflito('COMANDO_INVALIDO', `O comando ${gatilho} não é aceito no estado ${sessao.estado}.`, { estado: sessao.estado });
    }
    if (gatilho === 'EMERGENCIA' && !dto.motivo) throw invalido('MOTIVO_OBRIGATORIO', 'Informe o motivo da parada de emergência.');
    if (gatilho === 'REINICIAR' && dto.areaSegura !== true) {
      throw invalido('AREA_SEGURA_NAO_CONFIRMADA', 'Confirme que a área está segura antes de reiniciar.');
    }

    // Parar a máquina vem antes de qualquer escrita: é o caminho crítico de latência (RNF Desempenho).
    let latenciaMs: number | undefined;
    if (gatilho === 'EMERGENCIA') latenciaMs = this.maquina.emergencia(id, dto.motivo!);
    if (gatilho === 'PAUSAR') this.maquina.pausar(id);

    if (gatilho === 'INICIAR' && sessao.dispositivoId) await this.garantirDispositivoApto(sessao.dispositivoId, sessao.versao, ctx, id);
    if (gatilho === 'ENCERRAR') {
      this.maquina.descartar(id);
      const final = await this.finalizar(sessao, { encerradaEm: new Date(), pontosCliente: dto.pontosCliente, offline: false });
      await this.registrarComando(sessao, gatilho, 'ENCERRADA', ctx);
      return final;
    }

    const dados: Prisma.SessaoUpdateManyMutationInput = { estado: proximo };
    if (gatilho === 'INICIAR') dados.iniciadaEm = new Date();
    if (gatilho === 'EMERGENCIA') dados.motivoInterrupcao = dto.motivo;
    const atualizada = await this.mudarEstado(sessao, dados);

    const limites = await this.parametros.limites();
    if (gatilho === 'INICIAR') this.maquina.iniciar(this.paraMaquina(atualizada), limites);
    if (gatilho === 'RETOMAR') this.maquina.retomar(this.paraMaquina(atualizada), limites);
    await this.registrarComando(sessao, gatilho, proximo, ctx, { motivo: dto.motivo, latenciaMs });
    return this.visao(atualizada);
  }

  /** RF07/RF21: lote de eventos do app. Reenviar o mesmo lote não duplica nada. */
  async registrarEventos(id: string, lote: LoteEventosDto, ctx: ContextoRequisicao) {
    const sessao = await this.carregar(id, ctx);
    if (!ESTADOS_ATIVOS.includes(sessao.estado)) throw conflito('SESSAO_NAO_ATIVA', `A sessão está em ${sessao.estado} e não recebe eventos.`);

    const { count } = await this.inserirEventos(id, lote.eventos);
    let estado: EstadoSessao = sessao.estado;
    if (count > 0 && lote.eventos.some((e) => e.tipo === 'ERRO' && e.dados.codigo === 'SENSOR_INCONSISTENTE')) {
      estado = (await this.falhaSensor(sessao, ctx)) ?? estado;
    }
    const parcial = await this.calcularResumo(sessao);
    return {
      aceitos: count,
      duplicados: lote.eventos.length - count,
      estado,
      parcial: { pontos: parcial.pontos, golpes: parcial.golpes, acertos: parcial.acertos, sequencia: parcial.sequenciaAtual, precisao: parcial.precisao }
    };
  }

  /** RF21: sessão executada sem conexão, enviada de uma vez quando a rede volta. Idempotente. */
  async sincronizar(dto: SincronizarDto, ctx: ContextoRequisicao) {
    const s = dto.sessao;
    if (s.encerradaEm < s.iniciadaEm || s.encerradaEm.getTime() > Date.now() + TOLERANCIA_RELOGIO_MS) {
      throw invalido('PERIODO_INVALIDO', 'Datas de início e fim da sessão são inconsistentes.');
    }
    const praticante = await this.praticantes.garantirPosse(s.praticanteId, ctx.usuario.id);
    let sessao = await this.prisma.sessao.findUnique({ where: { id: s.id }, include: INCLUIR });
    if (sessao && sessao.praticanteId !== s.praticanteId) throw conflito('SESSAO_EXISTENTE', 'Já existe uma sessão com este id.');
    if (sessao?.estado === 'ENCERRADA') return this.visao(sessao);
    if (sessao?.estado === 'PARADA_SEGURA') throw conflito('SESSAO_EM_PARADA_SEGURA', 'Reinicie a sessão explicitamente antes de sincronizar.');

    if (!sessao) {
      const versao = await this.versaoExecutavel(s.treinoSlug, s.versaoNumero, ['PUBLICADA', 'ARQUIVADA']);
      this.garantirPublico(praticante, versao);
      if (s.dispositivoId) await this.dispositivos.garantirPosse(s.dispositivoId, ctx.usuario.id);
      sessao = await this.prisma.sessao.create({
        data: {
          id: s.id,
          praticanteId: praticante.id,
          treinoVersaoId: versao.id,
          dispositivoId: s.dispositivoId,
          origem: s.origem,
          estado: 'EM_EXECUCAO',
          iniciadaEm: s.iniciadaEm,
          offline: true
        },
        include: INCLUIR
      });
    }
    this.maquina.descartar(sessao.id);
    await this.inserirEventos(sessao.id, dto.eventos);
    const final = await this.finalizar(sessao, {
      encerradaEm: s.encerradaEm,
      iniciadaEm: s.iniciadaEm,
      motivo: s.motivoInterrupcao,
      pontosCliente: s.pontosCliente,
      offline: true
    });
    await this.auditoria.registrar(ctx, { acao: 'SESSAO_SINCRONIZADA', alvoTipo: 'sessao', alvoId: sessao.id, detalhes: { eventos: dto.eventos.length } });
    return final;
  }

  /** WebSocket do app caiu durante a execução: para de lançar e pausa (degradação segura). */
  async conexaoPerdida(id: string) {
    const sessao = await this.prisma.sessao.findUnique({ where: { id }, include: INCLUIR });
    if (!sessao || !transicao(sessao.estado, 'CONEXAO_PERDIDA')) return;
    this.maquina.pausar(id);
    const atualizada = await this.mudarEstado(sessao, { estado: 'PAUSADA', motivoInterrupcao: 'conexao_perdida' }).catch(() => null);
    if (!atualizada) return;
    await this.registrarComando(sessao, 'CONEXAO_PERDIDA', 'PAUSADA', null);
  }

  private async falhaSensor(sessao: SessaoCompleta, ctx: ContextoRequisicao) {
    const proximo = transicao(sessao.estado, 'FALHA_SENSOR');
    if (!proximo) return null;
    this.maquina.emergencia(sessao.id, 'falha_sensor');
    const atualizada = await this.mudarEstado(sessao, { estado: proximo, motivoInterrupcao: 'falha_sensor' });
    await this.registrarComando(sessao, 'FALHA_SENSOR', proximo, ctx);
    return atualizada.estado;
  }

  /** Calcula o resumo, grava a sessão como ENCERRADA e enfileira o envio à plataforma mãe na mesma transação. */
  private async finalizar(
    sessao: SessaoCompleta,
    opcoes: { encerradaEm: Date; iniciadaEm?: Date; motivo?: string; pontosCliente?: number; offline: boolean }
  ) {
    const iniciadaEm = sessao.iniciadaEm ?? opcoes.iniciadaEm ?? opcoes.encerradaEm;
    const duracaoSeg = Math.max(0, Math.round((opcoes.encerradaEm.getTime() - iniciadaEm.getTime()) / 1000));
    const resumo = await this.calcularResumo(sessao, duracaoSeg);
    const anteriores = await this.prisma.sessao.count({ where: { praticanteId: sessao.praticanteId, estado: 'ENCERRADA', id: { not: sessao.id } } });
    const recomendacoes = recomendar(resumo, {
      nivel: sessao.praticante.nivel,
      treinoAtual: sessao.versao.treino.slug,
      catalogo: await this.treinos.catalogoParaRecomendacao(modosDoPraticante(sessao.praticante))
    });
    const resumoFinal = {
      ...resumo,
      conquistas: calcularConquistas(resumo, { primeiraSessao: anteriores === 0 }),
      recomendacoes,
      treino: { slug: sessao.versao.treino.slug, versao: sessao.versao.numero }
    };
    const divergencia = opcoes.pontosCliente !== undefined && opcoes.pontosCliente !== resumo.pontos;
    const envios = await this.enviosParaPlataforma(sessao, resumoFinal, opcoes);

    const atualizada = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.sessao.updateMany({
        where: { id: sessao.id, estado: sessao.estado },
        data: {
          estado: 'ENCERRADA',
          encerradaEm: opcoes.encerradaEm,
          iniciadaEm,
          duracaoSeg,
          motivoInterrupcao: opcoes.motivo ?? sessao.motivoInterrupcao,
          resumo: resumoFinal as unknown as Prisma.InputJsonValue,
          pontos: resumo.pontos,
          golpes: resumo.golpes,
          acertos: resumo.acertos,
          divergencia,
          offline: opcoes.offline || sessao.offline
        }
      });
      if (count === 0) throw estadoAlterado();
      await this.outbox.enfileirar(tx, sessao.id, envios);
      return tx.sessao.findUniqueOrThrow({ where: { id: sessao.id }, include: INCLUIR });
    });

    this.metricas.sessoesEncerradas.inc({ estado: 'ENCERRADA', offline: String(atualizada.offline) });
    return this.visao(atualizada);
  }

  /** RF19: resumo sempre; eventos brutos só com consentimento. O praticante vai pseudonimizado. */
  private async enviosParaPlataforma(sessao: SessaoCompleta, resumo: object, opcoes: { encerradaEm: Date; offline: boolean }) {
    const cabecalho = {
      sessaoId: sessao.id,
      praticante: this.outbox.pseudonimo(sessao.praticanteId),
      treino: { slug: sessao.versao.treino.slug, versao: sessao.versao.numero },
      origem: sessao.origem,
      encerradaEm: opcoes.encerradaEm.toISOString(),
      offline: opcoes.offline
    };
    const envios: { tipo: 'RESUMO' | 'EVENTOS'; payload: Prisma.InputJsonValue }[] = [
      { tipo: 'RESUMO', payload: { ...cabecalho, resumo } as unknown as Prisma.InputJsonValue }
    ];
    const autorizado = sessao.praticante.consenteTelemetria && (sessao.praticante.tipo === 'TITULAR' || sessao.praticante.consentimentoParentalEm);
    if (autorizado) {
      const eventos = await this.prisma.eventoSessao.findMany({
        where: { sessaoId: sessao.id, tipo: 'GOLPE' },
        orderBy: { tMs: 'asc' },
        select: { tMs: true, dados: true }
      });
      envios.push({ tipo: 'EVENTOS', payload: { ...cabecalho, eventos } as unknown as Prisma.InputJsonValue });
    }
    return envios;
  }

  private async calcularResumo(sessao: SessaoCompleta, duracaoSeg?: number) {
    const eventos = await this.prisma.eventoSessao.findMany({
      where: { sessaoId: sessao.id, tipo: 'GOLPE' },
      orderBy: [{ tMs: 'asc' }, { ocorridoEm: 'asc' }],
      select: { tMs: true, dados: true }
    });
    const conteudo = conteudoDe(sessao);
    const golpes = golpesDosEventos(eventos, sequenciaEsperada(conteudo));
    const duracao = duracaoSeg ?? (sessao.iniciadaEm ? Math.round((Date.now() - sessao.iniciadaEm.getTime()) / 1000) : 0);
    return resumirSessao(golpes, duracao, conteudo.pontuacao);
  }

  private async inserirEventos(sessaoId: string, eventos: EventoDto[]) {
    eventos.forEach((e, i) => {
      const dados = plainToInstance(DADOS_POR_TIPO[e.tipo], e.dados);
      const erros = validateSync(dados, { whitelist: true, forbidNonWhitelisted: true });
      if (erros.length) {
        throw new ErroApi(HttpStatus.BAD_REQUEST, 'EVENTO_INVALIDO', `Evento ${i} (${e.tipo}) com dados inválidos.`, erros.map((x) => x.constraints));
      }
    });
    return this.prisma.eventoSessao.createMany({
      data: eventos.map((e) => ({ id: e.id, sessaoId, tipo: e.tipo, tMs: e.tMs, ocorridoEm: e.ocorridoEm, dados: e.dados as Prisma.InputJsonValue })),
      skipDuplicates: true
    });
  }

  /** Troca de estado otimista: falha se outra requisição mudou a sessão no meio do caminho. */
  private async mudarEstado(sessao: SessaoCompleta, dados: Prisma.SessaoUpdateManyMutationInput) {
    const { count } = await this.prisma.sessao.updateMany({ where: { id: sessao.id, estado: sessao.estado }, data: dados });
    if (count === 0) throw estadoAlterado();
    return this.prisma.sessao.findUniqueOrThrow({ where: { id: sessao.id }, include: INCLUIR });
  }

  private async registrarComando(
    sessao: SessaoCompleta,
    gatilho: Gatilho,
    para: EstadoSessao,
    ctx: ContextoRequisicao | null,
    extra: { motivo?: string; latenciaMs?: number } = {}
  ) {
    const tMs = sessao.iniciadaEm ? Math.max(0, Date.now() - sessao.iniciadaEm.getTime()) : 0;
    const tipo: TipoEvento = ctx ? 'COMANDO' : 'ESTADO';
    await this.prisma.eventoSessao.create({
      data: { id: randomUUID(), sessaoId: sessao.id, tipo, tMs, ocorridoEm: new Date(), dados: { gatilho, de: sessao.estado, para, ...extra } }
    });
    await this.auditoria.registrar(ctx, {
      acao: `SESSAO_${gatilho}`,
      alvoTipo: 'sessao',
      alvoId: sessao.id,
      usuarioId: ctx?.usuario.id ?? null,
      detalhes: { de: sessao.estado, para, ...extra }
    });
    this.maquina.notificarEstado(sessao.id, para);
  }

  private async carregar(id: string, ctx: ContextoRequisicao): Promise<SessaoCompleta> {
    const sessao = await this.prisma.sessao.findUnique({ where: { id }, include: INCLUIR });
    if (!sessao || (sessao.praticante.contaId !== ctx.usuario.id && ctx.usuario.papel !== 'ADMIN')) throw naoEncontrado('Sessão');
    return sessao;
  }

  private async versaoExecutavel(slug: string, numero: number | undefined, status: ('PUBLICADA' | 'ARQUIVADA')[]) {
    const versao = await this.prisma.treinoVersao.findFirst({
      where: { treino: { slug }, numero, status: { in: numero ? status : ['PUBLICADA'] } },
      include: { treino: { select: { slug: true } } }
    });
    if (!versao) throw naoEncontrado('Versão publicada do treino');
    return versao;
  }

  /** RF11: dependentes só executam treinos infantis ou para todos. */
  private garantirPublico(praticante: Praticante, versao: TreinoVersao) {
    if (!modosDoPraticante(praticante).includes(versao.modoPublico)) {
      throw new ErroApi(HttpStatus.FORBIDDEN, 'TREINO_NAO_PERMITIDO_PARA_PERFIL', 'Este treino não é indicado para o perfil infantil.');
    }
  }

  /** RNF Cibersegurança do IoT: dispositivo da conta, não bloqueado, firmware compatível e sem parada segura pendente. */
  private async garantirDispositivoApto(dispositivoId: string, versao: TreinoVersao, ctx: ContextoRequisicao, sessaoId: string) {
    const d = await this.prisma.dispositivo.findUnique({ where: { id: dispositivoId } });
    const incidente = (acao: string) =>
      this.auditoria.registrar(ctx, { acao, alvoTipo: 'dispositivo', alvoId: dispositivoId, severidade: 'INCIDENTE', detalhes: { sessaoId } });

    if (!d || d.contaId !== ctx.usuario.id) {
      await incidente('DISPOSITIVO_NAO_AUTORIZADO');
      throw new ErroApi(HttpStatus.FORBIDDEN, 'DISPOSITIVO_NAO_AUTORIZADO', 'Esta raquete não está vinculada à sua conta.');
    }
    if (d.bloqueado) {
      await incidente('DISPOSITIVO_BLOQUEADO_USADO');
      throw new ErroApi(HttpStatus.FORBIDDEN, 'DISPOSITIVO_BLOQUEADO', 'Esta raquete foi bloqueada pelo administrador.');
    }
    if (!versaoAtende(d.firmwareVersao, versao.compatibilidadeFirmware)) {
      throw conflito('FIRMWARE_INCOMPATIVEL', `O treino exige firmware ${versao.compatibilidadeFirmware} ou superior (raquete: ${d.firmwareVersao}).`);
    }
    const travada = await this.prisma.sessao.findFirst({ where: { dispositivoId, estado: 'PARADA_SEGURA', id: { not: sessaoId } } });
    if (travada) {
      await incidente('DISPOSITIVO_EM_PARADA_SEGURA');
      throw conflito('DISPOSITIVO_EM_PARADA_SEGURA', 'Há uma parada segura pendente nesta raquete. Reinicie aquela sessão antes.', { sessaoId: travada.id });
    }
  }

  private paraMaquina(s: SessaoCompleta) {
    return { id: s.id, iniciadaEm: s.iniciadaEm, lancamentos: s.lancamentos, conteudo: conteudoDe(s) };
  }

  private visao(s: SessaoCompleta) {
    return {
      id: s.id,
      praticanteId: s.praticanteId,
      treino: { slug: s.versao.treino.slug, versao: s.versao.numero },
      dispositivoId: s.dispositivoId,
      origem: s.origem,
      estado: s.estado,
      iniciadaEm: s.iniciadaEm,
      encerradaEm: s.encerradaEm,
      motivoInterrupcao: s.motivoInterrupcao,
      duracaoSeg: s.duracaoSeg,
      lancamentos: s.lancamentos,
      pontos: s.pontos,
      golpes: s.golpes,
      acertos: s.acertos,
      divergencia: s.divergencia,
      offline: s.offline,
      resumo: s.resumo
    };
  }
}

const estadoAlterado = () => conflito('ESTADO_ALTERADO', 'A sessão mudou de estado durante a operação. Tente novamente.');

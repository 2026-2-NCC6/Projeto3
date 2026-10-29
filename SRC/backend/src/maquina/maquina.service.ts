import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { PrismaService } from '../prisma/prisma.service';
import { Metricas } from '../saude/metricas';
import type { ConteudoTreino, LimitesOperacao } from '../treinos/conteudo';
import { Lancamento, expandirLancamentos } from './plano';
import { Simulador } from './simulador';

export type EventoMaquina = 'lancamento' | 'estado' | 'parada';
export type Emissor = (sessaoId: string, evento: EventoMaquina, dados: Record<string, unknown>) => void;

/** O mínimo da sessão que o simulador precisa para (re)começar. */
export type SessaoParaMaquina = { id: string; iniciadaEm: Date | null; lancamentos: number; conteudo: ConteudoTreino };

/**
 * Um simulador por sessão em execução (RF09). O estado fica em memória e é espelhado no banco
 * (`sessao.lancamentos`), então após reinício do servidor a sessão retoma do ponto certo.
 * Limitação declarada: instância única.
 */
@Injectable()
export class MaquinaService implements OnModuleDestroy {
  private readonly log = new Logger('Maquina');
  private readonly ativas = new Map<string, Simulador>();
  private emissor: Emissor = () => undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly metricas: Metricas
  ) {}

  /** O gateway WebSocket se registra aqui; o serviço não depende dele. */
  definirEmissor(emissor: Emissor) {
    this.emissor = emissor;
  }

  iniciar(sessao: SessaoParaMaquina, limites: LimitesOperacao) {
    this.criar(sessao, limites).iniciar();
  }

  pausar(sessaoId: string) {
    this.ativas.get(sessaoId)?.pausar();
  }

  /** Retoma; se o simulador não existe mais (reinício da sessão ou do servidor), recria na posição salva. */
  retomar(sessao: SessaoParaMaquina, limites: LimitesOperacao) {
    const sim = this.ativas.get(sessao.id) ?? this.criar(sessao, limites);
    if (sim.estado === 'PRONTO') sim.iniciar();
    else sim.retomar();
  }

  /** RF22: corta os lançamentos antes de qualquer acesso a banco. Retorna a latência medida. */
  emergencia(sessaoId: string, motivo: string) {
    const inicio = performance.now();
    const sim = this.ativas.get(sessaoId);
    if (sim) sim.parar(motivo);
    else this.emissor(sessaoId, 'parada', { sessaoId, motivo });
    this.ativas.delete(sessaoId);
    const latenciaMs = performance.now() - inicio;
    this.metricas.emergencia.observe(latenciaMs);
    return latenciaMs;
  }

  descartar(sessaoId: string) {
    this.ativas.get(sessaoId)?.pausar();
    this.ativas.delete(sessaoId);
  }

  notificarEstado(sessaoId: string, estado: string) {
    this.emissor(sessaoId, 'estado', { sessaoId, estado });
  }

  onModuleDestroy() {
    this.ativas.forEach((sim) => sim.pausar());
    this.ativas.clear();
  }

  private criar(sessao: SessaoParaMaquina, limites: LimitesOperacao) {
    this.descartar(sessao.id);
    const sim = new Simulador(expandirLancamentos(sessao.conteudo, limites), {
      aoLancar: (l) => this.aoLancar(sessao, l),
      aoTerminar: () => this.emissor(sessao.id, 'estado', { sessaoId: sessao.id, maquina: 'CONCLUIDA' }),
      aoParar: (motivo) => this.emissor(sessao.id, 'parada', { sessaoId: sessao.id, motivo })
    });
    sim.posicionar(sessao.lancamentos);
    this.ativas.set(sessao.id, sim);
    return sim;
  }

  private aoLancar(sessao: SessaoParaMaquina, l: Lancamento) {
    this.emissor(sessao.id, 'lancamento', { sessaoId: sessao.id, ...l });
    const tMs = sessao.iniciadaEm ? Date.now() - sessao.iniciadaEm.getTime() : 0;
    this.prisma
      .$transaction([
        this.prisma.eventoSessao.create({
          data: { id: randomUUID(), sessaoId: sessao.id, tipo: 'LANCAMENTO', tMs, ocorridoEm: new Date(), dados: l as unknown as Prisma.InputJsonValue }
        }),
        this.prisma.sessao.update({ where: { id: sessao.id }, data: { lancamentos: l.seq } })
      ])
      .catch((erro) => this.log.error({ err: erro, sessaoId: sessao.id }, 'Falha ao registrar lançamento'));
  }
}

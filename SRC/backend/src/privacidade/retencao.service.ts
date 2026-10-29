import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Configuracao } from '../config/configuracao';
import { ParametrosService } from '../parametros/parametros.service';
import { PrismaService } from '../prisma/prisma.service';

const DIA_MS = 86_400_000;

/**
 * Retenção limitada (RNF Privacidade/LGPD): apaga os eventos brutos de sessões antigas e mantém
 * só o resumo. Dependentes têm prazo menor (proteção reforçada de menores).
 */
@Injectable()
export class RetencaoService {
  private readonly log = new Logger('Retencao');

  constructor(
    private readonly prisma: PrismaService,
    private readonly parametros: ParametrosService,
    private readonly auditoria: AuditoriaService,
    private readonly config: Configuracao
  ) {}

  @Cron('0 3 * * *')
  async diario() {
    if (!this.config.teste) await this.aplicar();
  }

  async aplicar() {
    const p = await this.parametros.todos();
    const agora = Date.now();
    const apagar = (tipo: 'TITULAR' | 'DEPENDENTE', dias: number) =>
      this.prisma.eventoSessao.deleteMany({
        where: { sessao: { encerradaEm: { lt: new Date(agora - dias * DIA_MS) }, praticante: { tipo } } }
      });
    const titulares = await apagar('TITULAR', p.retencao_eventos_dias);
    const dependentes = await apagar('DEPENDENTE', p.retencao_eventos_dependente_dias);
    this.log.log({ titulares: titulares.count, dependentes: dependentes.count }, 'Retenção aplicada');
    await this.auditoria.registrar(null, {
      acao: 'RETENCAO_APLICADA',
      detalhes: { eventosTitulares: titulares.count, eventosDependentes: dependentes.count }
    });
  }
}

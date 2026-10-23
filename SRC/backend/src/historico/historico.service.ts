import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SessaoParaIndicador, agregarIndicadores } from '../pontuacao/analise';
import type { ResumoCalculado } from '../pontuacao/regras';
import { PrismaService } from '../prisma/prisma.service';
import { FiltroHistoricoDto } from '../praticantes/dto';

const ANTERIORES_PARA_PROGRESSAO = 5;

/** RF13: sessões por período e treino, com precisão, consistência, tempo, volume e progressão. */
@Injectable()
export class HistoricoService {
  constructor(private readonly prisma: PrismaService) {}

  async sessoes(praticanteId: string, f: FiltroHistoricoDto) {
    const limite = f.limite ?? 20;
    const pagina = f.pagina ?? 1;
    const sessoes = await this.prisma.sessao.findMany({
      where: this.filtro(praticanteId, f),
      orderBy: { criadoEm: 'desc' },
      skip: (pagina - 1) * limite,
      take: limite,
      include: { versao: { select: { numero: true, treino: { select: { slug: true, nome: true } } } } }
    });
    return sessoes.map((s) => ({
      id: s.id,
      treino: { slug: s.versao.treino.slug, nome: s.versao.treino.nome, versao: s.versao.numero },
      origem: s.origem,
      estado: s.estado,
      iniciadaEm: s.iniciadaEm,
      encerradaEm: s.encerradaEm,
      duracaoSeg: s.duracaoSeg,
      pontos: s.pontos,
      golpes: s.golpes,
      acertos: s.acertos,
      motivoInterrupcao: s.motivoInterrupcao,
      offline: s.offline,
      resumo: s.resumo
    }));
  }

  /** Só sessões reais encerradas entram nos indicadores; demonstrações ficam fora (LGPD/§3). */
  async indicadores(praticanteId: string, f: FiltroHistoricoDto) {
    const reais: Prisma.SessaoWhereInput = { ...this.filtro(praticanteId, f), estado: 'ENCERRADA', origem: 'SENSOR' };
    const doPeriodo = await this.prisma.sessao.findMany({ where: reais, select: { resumo: true } });
    const anteriores = f.de
      ? await this.prisma.sessao.findMany({
          where: { ...reais, criadoEm: { lt: f.de } },
          orderBy: { criadoEm: 'desc' },
          take: ANTERIORES_PARA_PROGRESSAO,
          select: { resumo: true }
        })
      : [];
    return agregarIndicadores(doPeriodo.map(paraIndicador), anteriores.map(paraIndicador));
  }

  private filtro(praticanteId: string, f: FiltroHistoricoDto): Prisma.SessaoWhereInput {
    return {
      praticanteId,
      criadoEm: { gte: f.de, lte: f.ate },
      versao: f.treino ? { treino: { slug: f.treino } } : undefined
    };
  }
}

function paraIndicador(s: { resumo: Prisma.JsonValue }): SessaoParaIndicador {
  const r = s.resumo as unknown as ResumoCalculado;
  return { golpes: r.golpes, acertos: r.acertos, pontos: r.pontos, duracaoSeg: r.duracaoSeg, consistencia: r.consistencia, cadenciaSeg: r.cadenciaSeg };
}

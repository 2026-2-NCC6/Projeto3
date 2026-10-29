import { Injectable } from '@nestjs/common';
import { invalido } from '../comum/erros';
import { PrismaService } from '../prisma/prisma.service';
import type { LimitesOperacao } from '../treinos/conteudo';

/** Parâmetros gerais editáveis pelo admin (RF17). Todos numéricos e positivos. */
export const PARAMETROS_PADRAO = {
  retencao_eventos_dias: 180,
  retencao_eventos_dependente_dias: 30,
  limite_velocidade_adulto_kmh: 120,
  limite_velocidade_infantil_kmh: 50,
  intervalo_minimo_seg: 1.5
} as const;

export type ChaveParametro = keyof typeof PARAMETROS_PADRAO;

export function chaveValida(chave: string): chave is ChaveParametro {
  return chave in PARAMETROS_PADRAO;
}

@Injectable()
export class ParametrosService {
  constructor(private readonly prisma: PrismaService) {}

  async todos(): Promise<Record<ChaveParametro, number>> {
    const salvos = await this.prisma.parametroSistema.findMany();
    const valores: Record<string, number> = { ...PARAMETROS_PADRAO };
    salvos.forEach((p) => {
      if (chaveValida(p.chave) && typeof p.valor === 'number') valores[p.chave] = p.valor;
    });
    return valores as Record<ChaveParametro, number>;
  }

  async valor(chave: ChaveParametro) {
    return (await this.todos())[chave];
  }

  async limites(): Promise<LimitesOperacao> {
    const p = await this.todos();
    return {
      velocidadeAdultoKmh: p.limite_velocidade_adulto_kmh,
      velocidadeInfantilKmh: p.limite_velocidade_infantil_kmh,
      intervaloMinimoSeg: p.intervalo_minimo_seg
    };
  }

  async definir(chave: string, valor: unknown) {
    if (!chaveValida(chave)) throw invalido('PARAMETRO_DESCONHECIDO', `Parâmetro "${chave}" não existe.`, Object.keys(PARAMETROS_PADRAO));
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) {
      throw invalido('PARAMETRO_INVALIDO', 'O valor deve ser um número positivo.');
    }
    await this.prisma.parametroSistema.upsert({ where: { chave }, create: { chave, valor }, update: { valor } });
    return this.todos();
  }
}

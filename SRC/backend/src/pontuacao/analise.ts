import type { Lado, ResumoCalculado } from './regras';

export type Nivel = 'INICIANTE' | 'INTERMEDIARIO' | 'AVANCADO';
const ORDEM_NIVEL: Nivel[] = ['INICIANTE', 'INTERMEDIARIO', 'AVANCADO'];

export type TreinoCatalogo = { slug: string; nome: string; nivel: Nivel; duracaoMin: number; focoLado: Lado | null };

export type Recomendacao = {
  tipo: 'REFORCAR_LADO' | 'REDUZIR_CARGA' | 'AVANCAR_NIVEL';
  mensagem: string;
  treinoSlug: string | null;
};

const GOLPES_MIN_POR_LADO = 5;

export function recomendar(
  resumo: ResumoCalculado,
  contexto: { nivel: Nivel; treinoAtual: string; catalogo: TreinoCatalogo[] }
): Recomendacao[] {
  const outros = contexto.catalogo.filter((t) => t.slug !== contexto.treinoAtual);
  const atual = contexto.catalogo.find((t) => t.slug === contexto.treinoAtual);
  const recs: Recomendacao[] = [];

  (['Forehand', 'Backhand'] as Lado[]).forEach((lado) => {
    const { acertos, total } = resumo.porLadoEsperado[lado];
    if (total < GOLPES_MIN_POR_LADO || acertos / total >= 0.5) return;
    const alvo = outros.find((t) => t.focoLado === lado && t.nivel === contexto.nivel) ?? outros.find((t) => t.focoLado === lado);
    recs.push({
      tipo: 'REFORCAR_LADO',
      mensagem: `Precisão de ${lado.toLowerCase()} em ${Math.round((acertos / total) * 100)}%: vale reforçar esse golpe.`,
      treinoSlug: alvo?.slug ?? null
    });
  });

  if (resumo.quedaEmSeg !== null) {
    const limite = atual?.duracaoMin ?? Infinity;
    const alvo = outros
      .filter((t) => t.nivel === contexto.nivel && t.duracaoMin < limite)
      .sort((a, b) => a.duracaoMin - b.duracaoMin)[0];
    recs.push({
      tipo: 'REDUZIR_CARGA',
      mensagem: `A força caiu a partir de ${resumo.quedaEmSeg}s: experimente uma sessão mais curta.`,
      treinoSlug: alvo?.slug ?? null
    });
  }

  if (resumo.metaAtingida) {
    const proximo = ORDEM_NIVEL[ORDEM_NIVEL.indexOf(contexto.nivel) + 1];
    const alvo = proximo ? outros.find((t) => t.nivel === proximo) : undefined;
    recs.push({
      tipo: 'AVANCAR_NIVEL',
      mensagem: proximo ? 'Meta de precisão atingida: você está pronto para o próximo nível.' : 'Meta de precisão atingida no nível máximo.',
      treinoSlug: alvo?.slug ?? null
    });
  }

  return recs;
}

export type SessaoParaIndicador = {
  golpes: number;
  acertos: number;
  pontos: number;
  duracaoSeg: number;
  consistencia: number;
  cadenciaSeg: number | null;
};

export type Indicadores = {
  sessoes: number;
  precisao: number;
  consistencia: number;
  cadenciaSeg: number | null;
  volume: number;
  tempoSeg: number;
  pontosMedios: number;
  progressao: { precisaoDelta: number; pontosDelta: number } | null;
};

const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const arred1 = (n: number) => Math.round(n * 10) / 10;

function precisaoDe(sessoes: SessaoParaIndicador[]) {
  const golpes = soma(sessoes.map((s) => s.golpes));
  return golpes ? (soma(sessoes.map((s) => s.acertos)) / golpes) * 100 : 0;
}

function pontosMediosDe(sessoes: SessaoParaIndicador[]) {
  return sessoes.length ? soma(sessoes.map((s) => s.pontos)) / sessoes.length : 0;
}

/** `anteriores`: até 5 sessões do mesmo treino imediatamente antes do período, para a progressão. */
export function agregarIndicadores(sessoes: SessaoParaIndicador[], anteriores: SessaoParaIndicador[]): Indicadores {
  const volume = soma(sessoes.map((s) => s.golpes));
  const cadencias = sessoes.map((s) => s.cadenciaSeg).filter((c): c is number => c !== null);
  return {
    sessoes: sessoes.length,
    precisao: Math.round(precisaoDe(sessoes)),
    consistencia: volume ? Math.round(soma(sessoes.map((s) => s.consistencia * s.golpes)) / volume) : 0,
    cadenciaSeg: cadencias.length ? arred1(soma(cadencias) / cadencias.length) : null,
    volume,
    tempoSeg: soma(sessoes.map((s) => s.duracaoSeg)),
    pontosMedios: Math.round(pontosMediosDe(sessoes)),
    progressao:
      sessoes.length && anteriores.length
        ? {
            precisaoDelta: Math.round(precisaoDe(sessoes) - precisaoDe(anteriores)),
            pontosDelta: Math.round(pontosMediosDe(sessoes) - pontosMediosDe(anteriores))
          }
        : null
  };
}

import { ConteudoTreino, LimitesOperacao, limiteVelocidade } from './conteudo';

export type ErroValidacao = { campo: string; mensagem: string };

const ALTURA_MIN_M = 0.3;
const ALTURA_MAX_M = 3;

/**
 * Regras semânticas de uma versão de treino (RF15). A estrutura e os tipos já foram
 * conferidos pelo DTO; aqui entram os campos exigidos pela §3 e os limites de operação.
 */
export function validarConteudo(c: ConteudoTreino, limites: LimitesOperacao): ErroValidacao[] {
  const erros: ErroValidacao[] = [];
  const erro = (campo: string, mensagem: string) => erros.push({ campo, mensagem });

  if (!c.publicoAlvo?.trim()) erro('publicoAlvo', 'Informe o público-alvo.');
  if (!c.objetivo?.trim()) erro('objetivo', 'Informe o objetivo do treino.');
  if (!(c.duracaoMin > 0)) erro('duracaoMin', 'A duração estimada deve ser maior que zero.');
  if (!c.sensores?.length) erro('sensores', 'Informe ao menos um sensor necessário.');
  if (!c.exercicios?.length) erro('exercicios', 'O treino precisa de ao menos um exercício.');
  if (!c.instrucoes?.length) erro('instrucoes', 'Inclua ao menos uma instrução.');
  if (!c.equipamentos?.length) erro('equipamentos', 'Liste os equipamentos necessários.');
  if (!c.riscos?.length) erro('riscos', 'Liste os riscos e cuidados do exercício.');

  const p = c.pontuacao;
  if (p.metaPrecisao < 0 || p.metaPrecisao > 100) erro('pontuacao.metaPrecisao', 'A meta de precisão deve ficar entre 0 e 100.');
  if (p.penalidadeErro < 0) erro('pontuacao.penalidadeErro', 'A penalidade não pode ser negativa.');
  if (p.base < 0 || p.bonusSequencia < 0 || p.bonusForte < 0) erro('pontuacao', 'Pontos e bônus não podem ser negativos.');

  const teto = limiteVelocidade(c.modoPublico, limites);
  (c.exercicios ?? []).forEach((ex, i) => {
    const l = ex.lancamento;
    const prefixo = `exercicios[${i}].lancamento`;
    if (l.velocidadeKmh <= 0 || l.velocidadeKmh > teto) {
      erro(`${prefixo}.velocidadeKmh`, `Velocidade deve ficar entre 1 e ${teto} km/h para o modo ${c.modoPublico}.`);
    }
    if (l.intervaloSeg < limites.intervaloMinimoSeg) {
      erro(`${prefixo}.intervaloSeg`, `O intervalo mínimo entre bolas é ${limites.intervaloMinimoSeg}s.`);
    }
    if (l.alturaM < ALTURA_MIN_M || l.alturaM > ALTURA_MAX_M) {
      erro(`${prefixo}.alturaM`, `A altura deve ficar entre ${ALTURA_MIN_M} e ${ALTURA_MAX_M} m.`);
    }
  });

  const totalLancamentos = (c.exercicios ?? []).reduce((a, ex) => a + ex.repeticoes, 0);
  if (c.conclusao.tipo === 'REPETICOES' && c.conclusao.valor > totalLancamentos) {
    erro('conclusao.valor', `A conclusão pede ${c.conclusao.valor} repetições, mas o treino lança ${totalLancamentos} bolas.`);
  }

  return erros;
}

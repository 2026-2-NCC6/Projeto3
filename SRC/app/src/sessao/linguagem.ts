import type { Lado, ModoPublico, Praticante } from '../api/tipos';

// RF11: linguagem, feedback e recompensas adaptados ao público. Crianças recebem frases curtas,
// encorajadoras e com estrelas; adultos, informação técnica direta.

export type Publico = 'infantil' | 'adulto';

export function publicoDaSessao(praticante: Pick<Praticante, 'tipo'> | null, modo: ModoPublico): Publico {
  return praticante?.tipo === 'DEPENDENTE' || modo === 'INFANTIL' ? 'infantil' : 'adulto';
}

const ladoInfantil = (l: Lado) => (l === 'Forehand' ? 'do lado da raquete (forehand)' : 'do outro lado (backhand)');

export function textos(publico: Publico) {
  if (publico === 'infantil') {
    return {
      acerto: (_l: Lado) => 'Mandou bem! +1 estrela',
      erro: (esperado: Lado) => `Quase! Agora tente ${ladoInfantil(esperado)}`,
      aguardando: (l: Lado) => `Prepare o golpe ${ladoInfantil(l)}!`,
      sequencia: (n: number) => (n >= 3 ? `${n} seguidas! Você está voando!` : ''),
      metaOk: 'Missão cumprida! Você bateu a meta!',
      metaQuase: 'Muito bom! Na próxima você chega lá.',
      recompensa: (acertos: number) => '★'.repeat(Math.min(5, Math.ceil(acertos / 5)))
    };
  }
  return {
    acerto: (l: Lado) => `Acerto · ${l}`,
    erro: (esperado: Lado) => `Erro · o exercício pedia ${esperado}`,
    aguardando: (l: Lado) => `O exercício pede um ${l}.`,
    sequencia: (n: number) => (n >= 5 ? `Sequência de ${n}` : ''),
    metaOk: 'Meta de precisão atingida.',
    metaQuase: 'Meta de precisão não atingida nesta sessão.',
    recompensa: (_acertos: number) => ''
  };
}

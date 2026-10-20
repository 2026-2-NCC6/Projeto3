export type Nivel = 'Iniciante' | 'Intermediário' | 'Avançado';

export type ZonaAlvo = 'fundoEsq' | 'fundoCentro' | 'fundoDir' | 'curtaEsq' | 'curtaDir';

export type GolpeTutorial = {
  lado: 'FH' | 'BH';
  alvo: ZonaAlvo;
  /** 0 = bola reta, 1 = topspin com arco alto */
  arco: number;
};

export type Treino = {
  id: string;
  nome: string;
  autor: string;
  min: number;
  ex: number;
  nivel: Nivel;
  versao: string;
  peso: 1 | 2 | 3;
  tutorial: {
    golpes: GolpeTutorial[];
    /** duração de cada bola na animação, em segundos */
    segPorBola: number;
    passos: string[];
  };
};

export const TREINOS: Treino[] = [
  {
    id: 'cruzado-fundo',
    nome: 'Cruzado de fundo — consistência',
    autor: 'Téc. R. Almeida',
    min: 18,
    ex: 4,
    nivel: 'Intermediário',
    versao: 'v3',
    peso: 2,
    tutorial: {
      golpes: [{ lado: 'FH', alvo: 'fundoEsq', arco: 0.5 }],
      segPorBola: 1.7,
      passos: [
        'Posicione-se no lado direito da linha de base.',
        'Bata de forehand na diagonal, mirando o fundo da quadra adversária.',
        'Passe a bola com margem sobre a rede: consistência antes de potência.',
        'Volte ao centro depois de cada golpe.'
      ]
    }
  },
  {
    id: 'aquecimento',
    nome: 'Aquecimento progressivo',
    autor: 'Téc. M. Sato',
    min: 12,
    ex: 3,
    nivel: 'Iniciante',
    versao: 'v2',
    peso: 1,
    tutorial: {
      golpes: [
        { lado: 'FH', alvo: 'fundoCentro', arco: 0.6 },
        { lado: 'BH', alvo: 'fundoCentro', arco: 0.6 }
      ],
      segPorBola: 2.2,
      passos: [
        'Comece com golpes leves, sem buscar velocidade.',
        'Alterne forehand e backhand devolvendo sempre ao centro.',
        'Aumente a amplitude do movimento a cada série.'
      ]
    }
  },
  {
    id: 'alternancia',
    nome: 'Alternância FH/BH sob pressão',
    autor: 'Téc. R. Almeida',
    min: 22,
    ex: 5,
    nivel: 'Avançado',
    versao: 'v1',
    peso: 3,
    tutorial: {
      golpes: [
        { lado: 'FH', alvo: 'fundoEsq', arco: 0.4 },
        { lado: 'BH', alvo: 'fundoDir', arco: 0.4 }
      ],
      segPorBola: 1.15,
      passos: [
        'A máquina alterna os lados: forehand, depois backhand.',
        'Responda sempre na diagonal do golpe.',
        'Faça o split-step antes de cada bola para reagir mais rápido.',
        'Recupere o centro entre os golpes — o intervalo é curto.'
      ]
    }
  },
  {
    id: 'zona-curta',
    nome: 'Precisão em zona curta',
    autor: 'Téc. L. Ferraz',
    min: 15,
    ex: 4,
    nivel: 'Intermediário',
    versao: 'v4',
    peso: 2,
    tutorial: {
      golpes: [
        { lado: 'FH', alvo: 'curtaEsq', arco: 0.25 },
        { lado: 'BH', alvo: 'curtaDir', arco: 0.25 }
      ],
      segPorBola: 1.7,
      passos: [
        'Mire as zonas próximas à rede, nas laterais.',
        'Reduza a velocidade do braço e abra a face da raquete.',
        'Controle vale mais que força: a zona-alvo é pequena.'
      ]
    }
  },
  {
    id: 'ritmo-constante',
    nome: 'Ritmo constante — 6 s entre bolas',
    autor: 'Téc. M. Sato',
    min: 20,
    ex: 3,
    nivel: 'Iniciante',
    versao: 'v1',
    peso: 1,
    tutorial: {
      golpes: [{ lado: 'FH', alvo: 'fundoCentro', arco: 0.55 }],
      segPorBola: 2.6,
      passos: [
        'A máquina lança uma bola a cada 6 segundos.',
        'Use o intervalo para voltar à posição de espera.',
        'Repita o mesmo movimento: o objetivo é regularidade.'
      ]
    }
  },
  {
    id: 'topspin-cruzado',
    nome: 'Topspin cruzado em série longa',
    autor: 'Téc. L. Ferraz',
    min: 25,
    ex: 6,
    nivel: 'Avançado',
    versao: 'v2',
    peso: 3,
    tutorial: {
      golpes: [{ lado: 'FH', alvo: 'fundoEsq', arco: 1 }],
      segPorBola: 1.35,
      passos: [
        'Escove a bola de baixo para cima para gerar topspin.',
        'Mire alto sobre a rede: o efeito derruba a bola no fundo.',
        'Termine o movimento acima do ombro oposto.',
        'Mantenha o padrão durante toda a série.'
      ]
    }
  }
];

export function buscarTreino(id: string | undefined): Treino {
  return TREINOS.find((t) => t.id === id) ?? TREINOS[0];
}

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import type { ConteudoTreino, Direcao, GolpeEsperado, Rotacao } from '../src/treinos/conteudo';
import { LIMITES_PADRAO } from '../src/treinos/conteudo';
import { validarConteudo } from '../src/treinos/validacao';
import { colunasDoConteudo } from '../src/treinos/treinos.service';

// Dados iniciais. Autores e nomes são fictícios (anonimização de demonstrações, LGPD).
// Os treinos reproduzem SRC/app/src/data/treinos.ts com os mesmos slugs, para o app migrar sem quebrar.

type Nivel = ConteudoTreino['nivel'];
const META: Record<Nivel, number> = { INICIANTE: 40, INTERMEDIARIO: 60, AVANCADO: 75 };
const VELOCIDADE: Record<Nivel, number> = { INICIANTE: 45, INTERMEDIARIO: 65, AVANCADO: 85 };
const DIRECAO: Record<string, Direcao> = { fundoEsq: 'ESQ', fundoCentro: 'CENTRO', fundoDir: 'DIR', curtaEsq: 'ESQ', curtaDir: 'DIR' };

type Base = {
  slug: string;
  nome: string;
  autor: string;
  categoria: string;
  versao: number;
  nivel: Nivel;
  duracaoMin: number;
  exercicios: number;
  rotacao: Rotacao;
  intervaloSeg: number;
  objetivo: string;
  tutorial: NonNullable<ConteudoTreino['tutorial']>;
};

const TREINOS: Base[] = [
  {
    slug: 'cruzado-fundo', nome: 'Cruzado de fundo — consistência', autor: 'almeida', categoria: 'consistencia', versao: 3,
    nivel: 'INTERMEDIARIO', duracaoMin: 18, exercicios: 4, rotacao: 'TOPSPIN', intervaloSeg: 4, objetivo: 'Consistência no forehand cruzado',
    tutorial: {
      golpes: [{ lado: 'FH', alvo: 'fundoEsq', arco: 0.5 }], segPorBola: 1.7,
      passos: ['Posicione-se no lado direito da linha de base.', 'Bata de forehand na diagonal, mirando o fundo da quadra adversária.', 'Passe a bola com margem sobre a rede: consistência antes de potência.', 'Volte ao centro depois de cada golpe.']
    }
  },
  {
    slug: 'aquecimento', nome: 'Aquecimento progressivo', autor: 'sato', categoria: 'fundamentos', versao: 2,
    nivel: 'INICIANTE', duracaoMin: 12, exercicios: 3, rotacao: 'PLANO', intervaloSeg: 5, objetivo: 'Aquecer alternando forehand e backhand',
    tutorial: {
      golpes: [{ lado: 'FH', alvo: 'fundoCentro', arco: 0.6 }, { lado: 'BH', alvo: 'fundoCentro', arco: 0.6 }], segPorBola: 2.2,
      passos: ['Comece com golpes leves, sem buscar velocidade.', 'Alterne forehand e backhand devolvendo sempre ao centro.', 'Aumente a amplitude do movimento a cada série.']
    }
  },
  {
    slug: 'alternancia', nome: 'Alternância FH/BH sob pressão', autor: 'almeida', categoria: 'resistencia', versao: 1,
    nivel: 'AVANCADO', duracaoMin: 22, exercicios: 5, rotacao: 'TOPSPIN', intervaloSeg: 2.5, objetivo: 'Reação e troca de empunhadura sob pressão',
    tutorial: {
      golpes: [{ lado: 'FH', alvo: 'fundoEsq', arco: 0.4 }, { lado: 'BH', alvo: 'fundoDir', arco: 0.4 }], segPorBola: 1.15,
      passos: ['A máquina alterna os lados: forehand, depois backhand.', 'Responda sempre na diagonal do golpe.', 'Faça o split-step antes de cada bola para reagir mais rápido.', 'Recupere o centro entre os golpes — o intervalo é curto.']
    }
  },
  {
    slug: 'zona-curta', nome: 'Precisão em zona curta', autor: 'ferraz', categoria: 'precisao', versao: 4,
    nivel: 'INTERMEDIARIO', duracaoMin: 15, exercicios: 4, rotacao: 'SLICE', intervaloSeg: 4, objetivo: 'Controle e precisão perto da rede',
    tutorial: {
      golpes: [{ lado: 'FH', alvo: 'curtaEsq', arco: 0.25 }, { lado: 'BH', alvo: 'curtaDir', arco: 0.25 }], segPorBola: 1.7,
      passos: ['Mire as zonas próximas à rede, nas laterais.', 'Reduza a velocidade do braço e abra a face da raquete.', 'Controle vale mais que força: a zona-alvo é pequena.']
    }
  },
  {
    slug: 'ritmo-constante', nome: 'Ritmo constante — 6 s entre bolas', autor: 'sato', categoria: 'consistencia', versao: 1,
    nivel: 'INICIANTE', duracaoMin: 20, exercicios: 3, rotacao: 'PLANO', intervaloSeg: 6, objetivo: 'Regularidade do movimento',
    tutorial: {
      golpes: [{ lado: 'FH', alvo: 'fundoCentro', arco: 0.55 }], segPorBola: 2.6,
      passos: ['A máquina lança uma bola a cada 6 segundos.', 'Use o intervalo para voltar à posição de espera.', 'Repita o mesmo movimento: o objetivo é regularidade.']
    }
  },
  {
    slug: 'topspin-cruzado', nome: 'Topspin cruzado em série longa', autor: 'ferraz', categoria: 'resistencia', versao: 2,
    nivel: 'AVANCADO', duracaoMin: 25, exercicios: 6, rotacao: 'TOPSPIN', intervaloSeg: 3, objetivo: 'Topspin consistente em série longa',
    tutorial: {
      golpes: [{ lado: 'FH', alvo: 'fundoEsq', arco: 1 }], segPorBola: 1.35,
      passos: ['Escove a bola de baixo para cima para gerar topspin.', 'Mire alto sobre a rede: o efeito derruba a bola no fundo.', 'Termine o movimento acima do ombro oposto.', 'Mantenha o padrão durante toda a série.']
    }
  }
];

const AUTORES: Record<string, string> = { almeida: 'Téc. R. Almeida', sato: 'Téc. M. Sato', ferraz: 'Téc. L. Ferraz' };
const CATEGORIAS: Record<string, string> = {
  fundamentos: 'Fundamentos',
  consistencia: 'Consistência',
  precisao: 'Precisão',
  resistencia: 'Resistência'
};

export function conteudoDoTreino(t: Base): ConteudoTreino {
  const lados = new Set(t.tutorial.golpes.map((g) => g.lado));
  const golpeEsperado: GolpeEsperado = lados.size > 1 ? 'ALTERNADO' : t.tutorial.golpes[0].lado;
  const repeticoes = 10;
  const iniciante = t.nivel === 'INICIANTE';
  return {
    publicoAlvo: iniciante ? 'Todos os públicos' : 'Adultos',
    objetivo: t.objetivo,
    nivel: t.nivel,
    duracaoMin: t.duracaoMin,
    // Iniciantes ficam abertos a dependentes; por isso respeitam o limite infantil de velocidade.
    modoPublico: iniciante ? 'TODOS' : 'ADULTO',
    instrucoes: t.tutorial.passos,
    equipamentos: ['Raquete com sensor Tennis Analytics', 'Máquina lançadora (ou simulador)', 'Bolas de tênis'],
    riscos: [
      'Faça aquecimento articular antes de começar.',
      'Mantenha a área de lançamento livre de pessoas e bolas soltas.',
      'Use a parada de emergência a qualquer sinal de dor ou risco.'
    ],
    sensores: ['IMU'],
    pontuacao: { base: 10, bonusSequencia: 5, bonusForte: 5, penalidadeErro: 0, metaPrecisao: META[t.nivel] },
    exercicios: Array.from({ length: t.exercicios }, (_, i) => ({
      nome: `Série ${i + 1}`,
      repeticoes,
      golpeEsperado,
      lancamento: {
        velocidadeKmh: VELOCIDADE[t.nivel],
        rotacao: t.rotacao,
        direcao: DIRECAO[t.tutorial.golpes[0].alvo] ?? 'CENTRO',
        alturaM: 1.2,
        intervaloSeg: t.intervaloSeg
      }
    })),
    feedbacks: { acerto: 'Matriz de LEDs: check', erro: 'Matriz de LEDs: X', sequencia: 'Contador de sequência na matriz' },
    conclusao: { tipo: 'REPETICOES', valor: t.exercicios * repeticoes },
    tutorial: t.tutorial
  };
}

export async function semear(prisma: PrismaClient, opcoes: { adminEmail: string; adminSenha: string }) {
  const senhaInutilizavel = await hash(randomBytes(24).toString('hex'), 12);
  const termos = { declaraMaioridade: true, termosVersao: '2026-10', termosAceitosEm: new Date() };

  await prisma.usuario.upsert({
    where: { email: opcoes.adminEmail.toLowerCase() },
    update: {},
    create: { email: opcoes.adminEmail.toLowerCase(), senhaHash: await hash(opcoes.adminSenha, 12), nome: 'Administração', papel: 'ADMIN', ...termos }
  });

  const autores: Record<string, string> = {};
  for (const [chave, nome] of Object.entries(AUTORES)) {
    const u = await prisma.usuario.upsert({
      where: { email: `${chave}@autores.exemplo.dev` },
      update: {},
      create: { email: `${chave}@autores.exemplo.dev`, senhaHash: senhaInutilizavel, nome, papel: 'AUTOR', ...termos }
    });
    autores[chave] = u.id;
  }

  const categorias: Record<string, string> = {};
  for (const [slug, nome] of Object.entries(CATEGORIAS)) {
    categorias[slug] = (await prisma.categoria.upsert({ where: { slug }, update: {}, create: { slug, nome } })).id;
  }

  for (const t of TREINOS) {
    if (await prisma.treino.findUnique({ where: { slug: t.slug } })) continue;
    const conteudo = conteudoDoTreino(t);
    const erros = validarConteudo(conteudo, LIMITES_PADRAO);
    if (erros.length) throw new Error(`Seed inválido em ${t.slug}: ${JSON.stringify(erros)}`);
    await prisma.treino.create({
      data: {
        slug: t.slug,
        nome: t.nome,
        autorId: autores[t.autor],
        categoriaId: categorias[t.categoria],
        versoes: {
          create: {
            numero: t.versao,
            status: 'PUBLICADA',
            publicadoEm: new Date(),
            ...colunasDoConteudo(conteudo),
            notasAlteracao: 'Versão inicial migrada do app',
            criadoPorId: autores[t.autor]
          }
        },
        marketplace: {
          create: { descricaoComercial: `${t.nome}. ${t.objetivo}.`, licenca: 'USO_PESSOAL', modeloRemuneracao: 'GRATUITO' }
        }
      }
    });
  }
}

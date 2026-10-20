import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import type { GolpeTutorial, Treino, ZonaAlvo } from '../data/treinos';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

const VB_W = 200;
const VB_H = 340;
const REDE_Y = 170;
const MAQUINA = { x: 100, y: 14 };
const JOGADOR_Y = 328;
const CONTATO_Y = 318;
const QUIQUE_Y = 268;
const POS_X = { FH: 128, BH: 72 } as const;
const R_BOLA = 2.4;

const ZONAS: Record<ZonaAlvo, { x: number; y: number; w: number; h: number; nome: string }> = {
  fundoEsq: { x: 38, y: 28, w: 44, h: 44, nome: 'fundo esquerdo' },
  fundoCentro: { x: 78, y: 28, w: 44, h: 44, nome: 'fundo central' },
  fundoDir: { x: 118, y: 28, w: 44, h: 44, nome: 'fundo direito' },
  curtaEsq: { x: 38, y: 120, w: 54, h: 46, nome: 'curta esquerda' },
  curtaDir: { x: 108, y: 120, w: 54, h: 46, nome: 'curta direita' }
};

type Quadro = { t: number; x: number; y: number; r: number; op: number };

function opacidadeBola(u: number) {
  if (u < 0.03) return u / 0.03;
  if (u > 0.9) return Math.max(0, 1 - (u - 0.9) / 0.05);
  return 1;
}

// Altura da bola é representada pelo raio: cresce no meio do voo.
function trecho(
  quadros: Quadro[],
  i: number,
  u0: number,
  u1: number,
  de: { x: number; y: number },
  para: { x: number; y: number },
  altura: number,
  passos = 8
) {
  for (let k = quadros.length && quadros[quadros.length - 1].t >= i + u0 ? 1 : 0; k <= passos; k++) {
    const s = k / passos;
    const u = u0 + (u1 - u0) * s;
    quadros.push({
      t: i + u,
      x: de.x + (para.x - de.x) * s,
      y: de.y + (para.y - de.y) * s,
      r: R_BOLA + altura * Math.sin(Math.PI * s),
      op: opacidadeBola(u)
    });
  }
}

function contato(g: GolpeTutorial) {
  return { x: POS_X[g.lado] + (g.lado === 'FH' ? 10 : -10), y: CONTATO_Y };
}

function centro(z: ZonaAlvo) {
  const r = ZONAS[z];
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function interpolar(v: Animated.Value, entrada: number[], saida: number[]) {
  return v.interpolate({ inputRange: entrada, outputRange: saida, extrapolate: 'clamp' });
}

export function TutorialAnimacao({ treino }: { treino: Treino }) {
  const { golpes, segPorBola } = treino.tutorial;
  const n = golpes.length;
  const progresso = useRef(new Animated.Value(0)).current;
  const [atual, setAtual] = useState(0);

  useEffect(() => {
    progresso.setValue(0);
    setAtual(0);
    const id = progresso.addListener(({ value }) => {
      const idx = Math.min(n - 1, Math.floor(value));
      setAtual((a) => (a === idx ? a : idx));
    });
    const loop = Animated.loop(
      Animated.timing(progresso, {
        toValue: n,
        duration: n * segPorBola * 1000,
        easing: Easing.linear,
        useNativeDriver: false
      })
    );
    loop.start();
    return () => {
      loop.stop();
      progresso.removeListener(id);
    };
  }, [progresso, n, segPorBola]);

  const anim = useMemo(() => {
    const bola: Quadro[] = [];
    const anelT: number[] = [];
    const anelX: number[] = [];
    const anelR: number[] = [];
    const anelOp: number[] = [];
    const jogT: number[] = [];
    const jogX: number[] = [];

    golpes.forEach((g, i) => {
      const quique = { x: POS_X[g.lado], y: QUIQUE_Y };
      const c = contato(g);
      const pouso = centro(g.alvo);

      trecho(bola, i, 0, 0.36, MAQUINA, quique, 1.6);
      trecho(bola, i, 0.36, 0.46, quique, c, 0.6, 3);
      trecho(bola, i, 0.46, 0.8, c, pouso, 0.8 + 2.2 * g.arco);
      for (const u of [0.9, 0.95, 0.999]) {
        bola.push({ t: i + u, x: pouso.x, y: pouso.y, r: R_BOLA, op: opacidadeBola(u) });
      }

      for (const [u, r, op] of [[0, 1, 0], [0.44, 1, 0], [0.46, 3, 0.9], [0.6, 11, 0], [0.999, 11, 0]]) {
        anelT.push(i + u);
        anelX.push(c.x);
        anelR.push(r);
        anelOp.push(op);
      }

      const anterior = golpes[(i - 1 + n) % n];
      jogT.push(i, i + 0.25, i + 0.999);
      jogX.push(POS_X[anterior.lado], POS_X[g.lado], POS_X[g.lado]);
    });

    const zonasUsadas = Array.from(new Set(golpes.map((g) => g.alvo)));
    const brilho = zonasUsadas.map((z) => {
      const t: number[] = [];
      const op: number[] = [];
      golpes.forEach((g, i) => {
        if (g.alvo === z) {
          t.push(i, i + 0.79, i + 0.83, i + 0.999);
          op.push(0.25, 0.25, 1, 0.35);
        } else {
          t.push(i, i + 0.999);
          op.push(0.25, 0.25);
        }
      });
      return { zona: z, op: interpolar(progresso, t, op) };
    });

    const t = bola.map((q) => q.t);
    return {
      bolaX: interpolar(progresso, t, bola.map((q) => q.x)),
      bolaY: interpolar(progresso, t, bola.map((q) => q.y)),
      bolaR: interpolar(progresso, t, bola.map((q) => q.r)),
      bolaOp: interpolar(progresso, t, bola.map((q) => q.op)),
      anelX: interpolar(progresso, anelT, anelX),
      anelR: interpolar(progresso, anelT, anelR),
      anelOp: interpolar(progresso, anelT, anelOp),
      jogadorX: interpolar(progresso, jogT, jogX),
      brilho
    };
  }, [golpes, n, progresso]);

  const golpeAtual = golpes[atual];
  const linha = 'rgba(255,255,255,0.72)';

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={`Animação do treino: ${golpes
        .map((g) => `${g.lado === 'FH' ? 'forehand' : 'backhand'} para o ${ZONAS[g.alvo].nome}`)
        .join(', depois ')}`}
    >
      <View style={styles.quadra}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Rect x={0} y={0} width={VB_W} height={VB_H} fill="#0F2438" />
        <Rect x={14} y={24} width={172} height={292} fill="#173A5E" stroke={linha} strokeWidth={1.2} />
        <Line x1={34} y1={24} x2={34} y2={316} stroke={linha} strokeWidth={1} />
        <Line x1={166} y1={24} x2={166} y2={316} stroke={linha} strokeWidth={1} />
        <Line x1={34} y1={91} x2={166} y2={91} stroke={linha} strokeWidth={1} />
        <Line x1={34} y1={249} x2={166} y2={249} stroke={linha} strokeWidth={1} />
        <Line x1={100} y1={91} x2={100} y2={249} stroke={linha} strokeWidth={1} />

        {anim.brilho.map(({ zona, op }) => {
          const z = ZONAS[zona];
          return (
            <AnimatedRect
              key={zona}
              x={z.x}
              y={z.y}
              width={z.w}
              height={z.h}
              rx={4}
              fill={colors.primary}
              fillOpacity={0.35}
              stroke={colors.primary}
              strokeWidth={1.2}
              opacity={op}
            />
          );
        })}

        <Line x1={8} y1={REDE_Y} x2={192} y2={REDE_Y} stroke="#FFFFFF" strokeWidth={2} />

        <Rect x={88} y={4} width={24} height={9} rx={2} fill={colors.surfaceActive} stroke={colors.textSecondary} strokeWidth={0.8} />
        <SvgText x={118} y={11} fill={colors.textSecondary} fontSize={7}>máquina</SvgText>

        <AnimatedCircle cx={anim.jogadorX} cy={JOGADOR_Y} r={6} fill={colors.text} stroke={colors.bg} strokeWidth={1.5} />
        <AnimatedCircle
          cx={anim.anelX}
          cy={CONTATO_Y}
          r={anim.anelR}
          fill="none"
          stroke={colors.primary}
          strokeWidth={1.6}
          opacity={anim.anelOp}
        />
        <AnimatedCircle cx={anim.bolaX} cy={anim.bolaY} r={anim.bolaR} fill={colors.primary} opacity={anim.bolaOp} />
      </Svg>
      </View>

      <View style={styles.legenda}>
        <View style={styles.badge}>
          <Text style={styles.badgeTexto}>{golpeAtual.lado === 'FH' ? 'Forehand' : 'Backhand'}</Text>
        </View>
        <Text style={styles.legendaTexto}>
          → zona {ZONAS[golpeAtual.alvo].nome}
          {golpeAtual.arco >= 0.8 ? ' · topspin' : ''}
        </Text>
        {n > 1 && (
          <Text style={styles.contador}>
            {atual + 1}/{n}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: '#0F2438' },
  quadra: { height: 300, aspectRatio: VB_W / VB_H, alignSelf: 'center' },
  legenda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  badge: { paddingHorizontal: 8, height: 22, borderRadius: 999, backgroundColor: colors.primaryTintBg, borderWidth: 1, borderColor: colors.primaryTintBd, justifyContent: 'center' },
  badgeTexto: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.primary },
  legendaTexto: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  contador: { fontFamily: fonts.mono, fontSize: 11, color: colors.textTertiary }
});

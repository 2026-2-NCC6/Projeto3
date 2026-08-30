import React, { useMemo } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { PageHeader, PrimaryButton } from '../components/ui';
import { BouncingTennisBall } from '../components/TennisBall';
import { IconChevronRight } from '../components/Icons';
import { CornerWatermark } from '../components/Watermark';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Inicio'>,
  NativeStackScreenProps<RootStackParamList>
>;

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const PRECISAO_7D = [64, 68, 61, 72, 70, 75, 72];

const W = 264;
const H = 68;
const GAP = 5;

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function InicioScreen({ navigation }: Props) {
  const max = Math.max(...PRECISAO_7D);
  const min = Math.min(...PRECISAO_7D);
  const bw = (W - (PRECISAO_7D.length - 1) * GAP) / PRECISAO_7D.length;

  const barras = useMemo(
    () =>
      PRECISAO_7D.map((v, i) => {
        const alt = Math.max(((v - min * 0.55) / (max - min * 0.55)) * H, 8);
        return { x: i * (bw + GAP), y: H - alt, alt };
      }),
    [max, min, bw]
  );

  const ultimo = PRECISAO_7D[PRECISAO_7D.length - 1];
  const dif = ultimo - PRECISAO_7D[0];
  const sinal = dif > 0 ? '+' : '';
  const deltaCor = dif > 0 ? colors.primary : dif < 0 ? colors.danger : colors.textSecondary;

  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader eyebrow={saudacao()} title="Vitor" />

        <View style={styles.startCard}>
          <BouncingTennisBall size={30} />
          <Text style={styles.timerLabel}>Pronto para treinar</Text>
          <Text style={styles.timer}>00:00</Text>
          <PrimaryButton
            label="Iniciar sessão"
            onPress={() => navigation.navigate('Preparacao')}
            style={styles.startBtn}
          />
          <Text style={styles.startNote}>Escolha o treino, pareie o dispositivo e comece a jogar.</Text>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Desempenho · 7 dias</Text>
          <Pressable style={styles.linkRow} onPress={() => navigation.navigate('Historico')} hitSlop={8}>
            <Text style={styles.linkText}>Ver histórico</Text>
            <IconChevronRight size={12} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.chartHeadRow}>
            <View>
              <Text style={styles.chartValueRow}>
                <Text style={styles.chartValue}>{ultimo}</Text>
                <Text style={styles.chartUnit}>%</Text>
              </Text>
              <Text style={styles.chartCaption}>precisão na última sessão</Text>
            </View>
            <Text style={[styles.chartDelta, { color: deltaCor }]}>
              {sinal}{dif} p.p. na semana
            </Text>
          </View>

          <Svg width="100%" height={H + 22} viewBox={`0 0 ${W} ${H + 22}`} style={{ marginTop: 12 }}>
            <Line x1={0} y1={H + 0.5} x2={W} y2={H + 0.5} stroke={colors.border} strokeWidth={1} />
            {barras.map((b, i) => (
              <Rect
                key={i}
                x={b.x}
                y={b.y}
                width={bw}
                height={b.alt}
                rx={3}
                fill={i === barras.length - 1 ? colors.primary : colors.primaryTintBd}
              />
            ))}
          </Svg>
          <View style={styles.diasRow}>
            {DIAS.map((d) => (
              <Text key={d} style={styles.diaLabel}>{d}</Text>
            ))}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 26, marginBottom: 12 }]}>Resumo da semana</Text>
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statTileValue}>4</Text>
            <Text style={styles.statTileLabel}>sessões</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statTileValue}>72 min</Text>
            <Text style={styles.statTileLabel}>treinados</Text>
          </View>
          <View style={[styles.statTile, { backgroundColor: colors.primaryTintBgSoft, borderColor: colors.primaryTintBd }]}>
            <Text style={[styles.statTileValue, { color: colors.primary }]}>×5</Text>
            <Text style={styles.statTileLabel}>dias seguidos</Text>
          </View>
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipEyebrow}>Dica</Text>
          <Text style={styles.tipText}>
            Domine a empunhadura certa para cada golpe. Segurar a raquete do jeito errado limita a potência e o controle, além de poder ocasionar lesões
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 24 },

  startCard: {
    marginTop: 22,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 24,
    paddingHorizontal: 20
  },
  timerLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.textSecondary, marginTop: 12 },
  timer: { fontFamily: fonts.mono, fontSize: 40, color: colors.text, marginTop: 4, letterSpacing: 1 },
  startBtn: { marginTop: 18, minWidth: 220 },
  startNote: { marginTop: 12, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 17, color: colors.textTertiary, textAlign: 'center', maxWidth: 260 },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 28, marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.bodyMedium, fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.textSecondary },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.primary },

  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 16 },
  chartHeadRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  chartValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  chartValue: { fontFamily: fonts.displayBold, fontSize: 32, color: colors.text },
  chartUnit: { fontFamily: fonts.display, fontSize: 15, color: colors.text },
  chartCaption: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textTertiary, marginTop: 2 },
  chartDelta: { fontFamily: fonts.bodyMedium, fontSize: 12, maxWidth: 110, textAlign: 'right' },
  diasRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  diaLabel: { flex: 1, textAlign: 'center', fontFamily: fonts.body, fontSize: 9.5, color: colors.textTertiary },

  statsRow: { flexDirection: 'row', gap: 8 },
  statTile: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  statTileValue: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.text },
  statTileLabel: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textTertiary, marginTop: 4 },

  tipCard: {
    marginTop: 34,
    backgroundColor: colors.primaryTintBgSoft,
    borderWidth: 1,
    borderColor: colors.primaryTintBd,
    borderRadius: 10,
    padding: 16
  },
  tipEyebrow: { fontFamily: fonts.bodyMedium, fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.primary },
  tipText: { marginTop: 8, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary }
});

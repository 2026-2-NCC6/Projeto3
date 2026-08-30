import React, { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { PageHeader, Pill, SegmentTab } from '../components/ui';
import { CornerWatermark } from '../components/Watermark';

type MetricaId = 'precisao' | 'consistencia' | 'volume' | 'resistencia';
type PeriodoId = 'p7' | 'p30' | 'p90';

const SEMANAS = Array.from({ length: 12 }, (_, i) => `Sem. ${i + 1}`);
const DIAS_7 = ['21/08', '22/08', '23/08', '24/08', '25/08', '26/08', '27/08'];
const DIAS_30 = ['30/07', '02/08', '05/08', '08/08', '11/08', '14/08', '17/08', '20/08', '23/08', '27/08'];

const DADOS: Record<MetricaId, {
  nome: string; label: string; unidade: string; max: number; escala: string;
  p7: number[]; p30: number[]; p90: number[];
}> = {
  precisao: {
    nome: 'Precisão', label: 'Precisão', unidade: '%', max: 100, escala: 'Escala 0–100%',
    p7: [64, 68, 61, 72, 70, 75, 72],
    p30: [55, 58, 61, 59, 64, 62, 68, 66, 71, 72],
    p90: [48, 52, 50, 55, 53, 58, 60, 57, 63, 66, 69, 72]
  },
  consistencia: {
    nome: 'Consistência', label: 'Consist.', unidade: '%', max: 100, escala: 'Índice 0–100',
    p7: [58, 63, 55, 66, 69, 64, 71],
    p30: [50, 53, 49, 57, 55, 60, 58, 63, 66, 71],
    p90: [42, 45, 44, 48, 50, 49, 54, 57, 55, 61, 64, 71]
  },
  volume: {
    nome: 'Volume', label: 'Volume', unidade: 'golpes', max: 0, escala: 'Golpes por sessão',
    p7: [96, 110, 0, 132, 114, 124, 114],
    p30: [320, 286, 410, 388, 352, 430, 396, 455, 412, 468],
    p90: [860, 910, 780, 1020, 960, 1120, 1040, 1180, 1105, 1240, 1190, 1310]
  },
  resistencia: {
    nome: 'Resistência', label: 'Resist.', unidade: 'min', max: 0, escala: 'Minutos até queda de força',
    p7: [9, 11, 8, 13, 12, 15, 15],
    p30: [6, 7, 8, 7, 9, 9, 10, 11, 12, 15],
    p90: [4, 5, 5, 6, 6, 7, 8, 8, 9, 11, 13, 15]
  }
};

const LABELS: Record<PeriodoId, string[]> = { p7: DIAS_7, p30: DIAS_30, p90: SEMANAS };
const SESSOES_COUNT: Record<PeriodoId, number> = { p7: 6, p30: 14, p90: 41 };

const SESSOES = [
  { dia: '27', mes: 'ago', treino: 'Cruzado de fundo — consistência', golpes: 114, pontos: '1.480', precisao: 72 },
  { dia: '26', mes: 'ago', treino: 'Precisão em zona curta', golpes: 124, pontos: '1.610', precisao: 75 },
  { dia: '24', mes: 'ago', treino: 'Alternância FH/BH sob pressão', golpes: 132, pontos: '1.390', precisao: 72 }
];

const W = 318;
const H = 150;
const GAP = 3;

export function HistoricoScreen() {
  const [periodo, setPeriodo] = useState<PeriodoId>('p7');
  const [metrica, setMetrica] = useState<MetricaId>('precisao');
  const [indiceSel, setIndiceSel] = useState(-1);

  const conj = DADOS[metrica];
  const vals = conj[periodo];
  const labels = LABELS[periodo];
  const n = vals.length;
  const idx = indiceSel < 0 || indiceSel >= n ? n - 1 : indiceSel;
  const max = conj.max > 0 ? conj.max : Math.ceil(Math.max(...vals) / 100) * 100;
  const bw = (W - (n - 1) * GAP) / n;
  const r = Math.min(4, bw / 2);

  const barras = useMemo(
    () =>
      vals.map((v, i) => {
        const vazio = v <= 0;
        const alt = vazio ? 3 : Math.max((v / max) * H, 2);
        const x = i * (bw + GAP);
        const y = H - alt;
        const rr = vazio ? 1.5 : Math.min(r, alt);
        const d =
          `M${x},${H} L${x},${y + rr} Q${x},${y} ${x + rr},${y} ` +
          `L${x + bw - rr},${y} Q${x + bw},${y} ${x + bw},${y + rr} L${x + bw},${H} Z`;
        return { d, vazio, x };
      }),
    [vals, max, bw, r]
  );

  const dif = vals[n - 1] - vals[0];
  const sinal = dif > 0 ? '+' : '';
  const deltaCor = dif > 0 ? colors.success : dif < 0 ? colors.danger : colors.textSecondary;
  const valorSel = conj.unidade === '%' ? String(vals[idx]) : vals[idx].toLocaleString('pt-BR');
  const meio = Math.floor((n - 1) / 2);

  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader
          eyebrow="Seu progresso"
          title="Histórico"
          right={<Text style={styles.sessoesCount}>{SESSOES_COUNT[periodo]} sessões</Text>}
        />

        <View style={styles.pillRow}>
          {(['p7', 'p30', 'p90'] as PeriodoId[]).map((p) => (
            <Pill
              key={p}
              label={p === 'p7' ? '7 dias' : p === 'p30' ? '30 dias' : '90 dias'}
              active={periodo === p}
              onPress={() => {
                setPeriodo(p);
                setIndiceSel(-1);
              }}
            />
          ))}
        </View>

        <View style={styles.segmentRow}>
          {(Object.keys(DADOS) as MetricaId[]).map((m) => (
            <SegmentTab
              key={m}
              label={DADOS[m].label}
              active={metrica === m}
              onPress={() => {
                setMetrica(m);
                setIndiceSel(-1);
              }}
            />
          ))}
        </View>

        <View style={styles.headlineRow}>
          <View>
            <Text style={styles.headlineEyebrow}>{conj.nome} · {labels[idx]}</Text>
            <View style={styles.headlineValueRow}>
              <Text style={styles.headlineValue}>{valorSel}</Text>
              <Text style={styles.headlineUnit}>{conj.unidade}</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', paddingBottom: 6 }}>
            <Text style={[styles.delta, { color: deltaCor }]}>
              {sinal}{dif}{conj.unidade === '%' ? ' p.p.' : ` ${conj.unidade}`}
            </Text>
            <Text style={styles.deltaCaption}>no período</Text>
          </View>
        </View>

        <View style={styles.chartCard}>
          <Svg width="100%" height={176} viewBox={`0 0 ${W} 176`}>
            <Line x1={0} y1={75} x2={W} y2={75} stroke={colors.divider} strokeWidth={1} strokeDasharray="2 5" />
            <Line x1={0} y1={150.5} x2={W} y2={150.5} stroke={colors.border} strokeWidth={1} />
            {barras.map((b, i) => (
              <Path key={i} d={b.d} fill={b.vazio ? colors.border : i === idx ? colors.primary : 'rgba(203,232,31,0.30)'} />
            ))}
            <SvgText x={0} y={169} fill={colors.textTertiary} fontSize={10} textAnchor="start">{labels[0]}</SvgText>
            <SvgText x={W / 2} y={169} fill={colors.textTertiary} fontSize={10} textAnchor="middle">{labels[meio]}</SvgText>
            <SvgText x={W} y={169} fill={colors.textTertiary} fontSize={10} textAnchor="end">{labels[n - 1]}</SvgText>
            {barras.map((b, i) =>
              b.vazio ? null : (
                <Rect
                  key={`hit-${i}`}
                  x={b.x - GAP / 2}
                  y={0}
                  width={bw + GAP}
                  height={150}
                  fill="transparent"
                  onPress={() => setIndiceSel(i)}
                />
              )
            )}
          </Svg>
          <View style={styles.chartFooter}>
            <Text style={styles.chartFooterText}>{conj.escala}</Text>
            <Text style={styles.chartFooterText}>Toque numa barra</Text>
          </View>
        </View>

        <Text style={[styles.headlineEyebrow, { marginTop: 26, marginBottom: 6 }]}>Sessões recentes</Text>
        {SESSOES.map((s) => (
          <Pressable key={s.treino} style={styles.sessaoRow}>
            <View style={styles.sessaoData}>
              <Text style={styles.sessaoDia}>{s.dia}</Text>
              <Text style={styles.sessaoMes}>{s.mes}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.sessaoTreino} numberOfLines={1}>{s.treino}</Text>
              <Text style={styles.sessaoMeta}>{s.golpes} golpes · {s.pontos} pontos</Text>
            </View>
            <Text style={styles.sessaoPrecisao}>{s.precisao}%</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 18 },
  sessoesCount: { fontFamily: fonts.body, fontSize: 12, color: colors.textTertiary },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  segmentRow: { flexDirection: 'row', gap: 4, marginTop: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 4 },
  headlineRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginTop: 22 },
  headlineEyebrow: { fontFamily: fonts.bodyMedium, fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.textSecondary },
  headlineValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },
  headlineValue: { fontFamily: fonts.displayBold, fontSize: 56, lineHeight: 56, color: colors.primary },
  headlineUnit: { fontFamily: fonts.display, fontSize: 18, color: colors.primary },
  delta: { fontFamily: fonts.bodyMedium, fontSize: 15 },
  deltaCaption: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textTertiary, marginTop: 4 },
  chartCard: { marginTop: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 16 },
  chartFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  chartFooterText: { fontFamily: fonts.body, fontSize: 11, color: colors.textTertiary },
  sessaoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.divider },
  sessaoData: { width: 42 },
  sessaoDia: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.text },
  sessaoMes: { fontFamily: fonts.body, fontSize: 10, color: colors.textTertiary, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  sessaoTreino: { fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  sessaoMeta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textTertiary, marginTop: 4 },
  sessaoPrecisao: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.primary }
});

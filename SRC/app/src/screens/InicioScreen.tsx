import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { useFocusEffect, type CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import type { SessaoHistorico } from '../api/tipos';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { Aviso, PageHeader, PrimaryButton } from '../components/ui';
import { BouncingTennisBall } from '../components/TennisBall';
import { IconChevronRight } from '../components/Icons';
import { CornerWatermark } from '../components/Watermark';
import { useAuth } from '../auth/AuthContext';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Inicio'>,
  NativeStackScreenProps<RootStackParamList>
>;

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const W = 264;
const H = 68;
const GAP = 5;
const DIA_MS = 86_400_000;

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function InicioScreen({ navigation }: Props) {
  const { api, praticanteAtivo, pendentesSync, offline } = useAuth();
  const [sessoes, setSessoes] = useState<SessaoHistorico[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!praticanteAtivo) return;
      api
        .historico(praticanteAtivo.id, { de: new Date(Date.now() - 30 * DIA_MS).toISOString(), limite: 100 })
        .then((s) => setSessoes(s.filter((x) => x.estado === 'ENCERRADA' && x.origem === 'SENSOR')))
        .catch(() => undefined);
    }, [api, praticanteAtivo])
  );

  // Precisão média por dia nos últimos 7 dias (0 = sem treino).
  const semana = useMemo(() => {
    const hoje = inicioDoDia(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const dia = hoje - (6 - i) * DIA_MS;
      const doDia = sessoes.filter((s) => s.encerradaEm && inicioDoDia(new Date(s.encerradaEm)) === dia);
      const golpes = doDia.reduce((a, s) => a + (s.golpes ?? 0), 0);
      const acertos = doDia.reduce((a, s) => a + (s.acertos ?? 0), 0);
      return { rotulo: DIAS[new Date(dia).getDay()], precisao: golpes ? Math.round((acertos / golpes) * 100) : 0, sessoes: doDia.length, seg: doDia.reduce((a, s) => a + (s.duracaoSeg ?? 0), 0) };
    });
  }, [sessoes]);

  // Dias seguidos com treino, contando de hoje (ou de ontem, se ainda não treinou hoje) para trás.
  const sequenciaDias = useMemo(() => {
    const dias = new Set(sessoes.filter((s) => s.encerradaEm).map((s) => inicioDoDia(new Date(s.encerradaEm!))));
    let dia = inicioDoDia(new Date());
    if (!dias.has(dia)) dia -= DIA_MS;
    let n = 0;
    while (dias.has(dia)) {
      n++;
      dia -= DIA_MS;
    }
    return n;
  }, [sessoes]);

  const comTreino = semana.filter((d) => d.sessoes > 0);
  const ultimo = comTreino.length ? comTreino[comTreino.length - 1].precisao : null;
  const dif = comTreino.length > 1 ? comTreino[comTreino.length - 1].precisao - comTreino[0].precisao : 0;
  const deltaCor = dif > 0 ? colors.primary : dif < 0 ? colors.danger : colors.textSecondary;
  const bw = (W - 6 * GAP) / 7;
  const barras = semana.map((d, i) => {
    const alt = d.precisao > 0 ? Math.max((d.precisao / 100) * H, 8) : 3;
    return { x: i * (bw + GAP), y: H - alt, alt, vazio: d.precisao === 0 };
  });
  const sessoesSemana = semana.reduce((a, d) => a + d.sessoes, 0);
  const minutosSemana = Math.round(semana.reduce((a, d) => a + d.seg, 0) / 60);

  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader eyebrow={saudacao()} title={praticanteAtivo?.apelido ?? 'Olá'} />

        {(pendentesSync > 0 || offline) && (
          <View style={{ marginTop: 14 }}>
            <Aviso texto={offline ? 'Sem conexão. Você pode treinar com treinos já baixados; os resultados serão enviados depois.' : `${pendentesSync} sessão(ões) aguardando envio.`} />
          </View>
        )}

        <View style={styles.startCard}>
          <BouncingTennisBall size={30} />
          <Text style={styles.timerLabel}>Pronto para treinar</Text>
          <PrimaryButton label="Escolher treino" onPress={() => navigation.navigate('Treinos')} style={styles.startBtn} />
          <Text style={styles.startNote}>Escolha o treino, pareie a raquete e comece a jogar.</Text>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Precisão · 7 dias</Text>
          <Pressable style={styles.linkRow} onPress={() => navigation.navigate('Historico')} hitSlop={8}>
            <Text style={styles.linkText}>Ver histórico</Text>
            <IconChevronRight size={12} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.card} accessible accessibilityLabel={`Precisão por dia: ${semana.map((d) => `${d.rotulo} ${d.precisao}%`).join(', ')}`}>
          <View style={styles.chartHeadRow}>
            <View>
              <Text style={styles.chartValueRow}>
                <Text style={styles.chartValue}>{ultimo ?? '—'}</Text>
                {ultimo !== null && <Text style={styles.chartUnit}>%</Text>}
              </Text>
              <Text style={styles.chartCaption}>{ultimo !== null ? 'precisão no último dia de treino' : 'nenhuma sessão nesta semana'}</Text>
            </View>
            {comTreino.length > 1 && (
              <Text style={[styles.chartDelta, { color: deltaCor }]}>
                {dif > 0 ? '+' : ''}
                {dif} p.p. na semana
              </Text>
            )}
          </View>

          <Svg width="100%" height={H + 22} viewBox={`0 0 ${W} ${H + 22}`} style={{ marginTop: 12 }}>
            <Line x1={0} y1={H + 0.5} x2={W} y2={H + 0.5} stroke={colors.border} strokeWidth={1} />
            {barras.map((b, i) => (
              <Rect key={i} x={b.x} y={b.y} width={bw} height={b.alt} rx={3} fill={b.vazio ? colors.border : i === barras.length - 1 ? colors.primary : colors.primaryTintBd} />
            ))}
          </Svg>
          <View style={styles.diasRow}>
            {semana.map((d, i) => (
              <Text key={i} style={styles.diaLabel}>
                {d.rotulo}
              </Text>
            ))}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 26, marginBottom: 12 }]}>Resumo da semana</Text>
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statTileValue}>{sessoesSemana}</Text>
            <Text style={styles.statTileLabel}>sessões</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statTileValue}>{minutosSemana} min</Text>
            <Text style={styles.statTileLabel}>treinados</Text>
          </View>
          <View style={[styles.statTile, sequenciaDias > 1 && { backgroundColor: colors.primaryTintBgSoft, borderColor: colors.primaryTintBd }]}>
            <Text style={[styles.statTileValue, sequenciaDias > 1 && { color: colors.primary }]}>×{sequenciaDias}</Text>
            <Text style={styles.statTileLabel}>dias seguidos</Text>
          </View>
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipEyebrow}>Dica</Text>
          <Text style={styles.tipText}>
            Domine a empunhadura certa para cada golpe. Segurar a raquete do jeito errado limita a potência e o controle, além de poder ocasionar lesões.
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
  tipCard: { marginTop: 34, backgroundColor: colors.primaryTintBgSoft, borderWidth: 1, borderColor: colors.primaryTintBd, borderRadius: 10, padding: 16 },
  tipEyebrow: { fontFamily: fonts.bodyMedium, fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.primary },
  tipText: { marginTop: 8, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary }
});

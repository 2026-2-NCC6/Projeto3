import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import type { Indicadores, SessaoHistorico } from '../api/tipos';
import { ErroRede } from '../api/cliente';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { Aviso, GhostButton, PageHeader, Pill, SegmentTab, StatRow } from '../components/ui';
import { CornerWatermark } from '../components/Watermark';
import { useAuth } from '../auth/AuthContext';
import { armazenamentoApp } from '../armazenamento/aparelho';
import { lerJson } from '../armazenamento/chaveValor';

type MetricaId = 'precisao' | 'consistencia' | 'volume' | 'pontos';
type PeriodoId = 7 | 30 | 90;

const METRICAS: Record<MetricaId, { nome: string; unidade: string; max: number; valor: (s: SessaoHistorico) => number }> = {
  precisao: { nome: 'Precisão', unidade: '%', max: 100, valor: (s) => s.resumo?.precisao ?? 0 },
  consistencia: { nome: 'Consistência', unidade: '%', max: 100, valor: (s) => s.resumo?.consistencia ?? 0 },
  volume: { nome: 'Volume', unidade: 'golpes', max: 0, valor: (s) => s.golpes ?? 0 },
  pontos: { nome: 'Pontos', unidade: 'pts', max: 0, valor: (s) => s.pontos ?? 0 }
};

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const W = 318;
const H = 150;
const GAP = 3;
const MAX_BARRAS = 14;

type Dados = { sessoes: SessaoHistorico[]; indicadores: Indicadores };

/** RF13: sessões por período e treino, com precisão, consistência, tempo, volume e progressão. */
export function HistoricoScreen() {
  const { api, praticanteAtivo, pendentesSync, sincronizar } = useAuth();
  const [periodo, setPeriodo] = useState<PeriodoId>(30);
  const [metrica, setMetrica] = useState<MetricaId>('precisao');
  const [indiceSel, setIndiceSel] = useState(-1);
  const [dados, setDados] = useState<Dados | null>(null);
  const [offline, setOffline] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    if (!praticanteAtivo) return;
    const chave = `tennis.historico.${praticanteAtivo.id}.${periodo}`;
    const de = new Date(Date.now() - periodo * 86_400_000).toISOString();
    setCarregando(true);
    try {
      const [sessoes, indicadores] = await Promise.all([
        api.historico(praticanteAtivo.id, { de, limite: 100 }),
        api.indicadores(praticanteAtivo.id, { de })
      ]);
      const novo = { sessoes, indicadores };
      setDados(novo);
      setOffline(false);
      await armazenamentoApp.gravar(chave, JSON.stringify(novo));
    } catch (e) {
      if (!(e instanceof ErroRede)) throw e;
      setOffline(true);
      setDados(await lerJson<Dados | null>(armazenamentoApp, chave, null));
    } finally {
      setCarregando(false);
    }
  }, [api, praticanteAtivo, periodo]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  const reais = useMemo(
    () => (dados?.sessoes ?? []).filter((s) => s.estado === 'ENCERRADA' && s.origem === 'SENSOR').slice(0, MAX_BARRAS).reverse(),
    [dados]
  );
  const conj = METRICAS[metrica];
  const vals = reais.map(conj.valor);
  const n = vals.length;
  const idx = indiceSel < 0 || indiceSel >= n ? n - 1 : indiceSel;
  const max = conj.max > 0 ? conj.max : Math.max(10, Math.ceil(Math.max(0, ...vals) / 10) * 10);
  const bw = n ? (W - (n - 1) * GAP) / n : W;
  const r = Math.min(4, bw / 2);

  const barras = useMemo(
    () =>
      vals.map((v, i) => {
        const alt = v <= 0 ? 3 : Math.max((v / max) * H, 2);
        const x = i * (bw + GAP);
        const y = H - alt;
        const rr = v <= 0 ? 1.5 : Math.min(r, alt);
        const d = `M${x},${H} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + bw - rr},${y} Q${x + bw},${y} ${x + bw},${y + rr} L${x + bw},${H} Z`;
        return { d, x, vazio: v <= 0 };
      }),
    [vals, max, bw, r]
  );

  const dataCurta = (iso: string | null) => {
    const d = new Date(iso ?? Date.now());
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const ind = dados?.indicadores;
  const progressao = ind?.progressao;

  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} tintColor={colors.primary} />}>
        <PageHeader eyebrow={`Progresso de ${praticanteAtivo?.apelido ?? '—'}`} title="Histórico" right={<Text style={styles.sessoesCount}>{ind?.sessoes ?? 0} sessões</Text>} />

        {pendentesSync > 0 && (
          <View style={{ marginTop: 12, gap: 4 }}>
            <Aviso texto={`${pendentesSync} sessão(ões) feitas sem internet aguardando envio.`} />
            <GhostButton label="Enviar agora" onPress={() => void sincronizar().then(carregar).catch(() => undefined)} />
          </View>
        )}
        {offline && (
          <View style={{ marginTop: 12 }}>
            <Aviso texto="Sem conexão: mostrando o último histórico baixado." />
          </View>
        )}

        <View style={styles.pillRow}>
          {([7, 30, 90] as PeriodoId[]).map((p) => (
            <Pill
              key={p}
              label={`${p} dias`}
              active={periodo === p}
              onPress={() => {
                setPeriodo(p);
                setIndiceSel(-1);
              }}
            />
          ))}
        </View>

        {ind && (
          <View style={styles.indicadores}>
            <StatRow label="Precisão no período" value={`${ind.precisao}%`} />
            <StatRow label="Consistência" value={`${ind.consistencia}%`} />
            <StatRow label="Volume" value={`${ind.volume} golpes`} />
            <StatRow label="Tempo de treino" value={`${Math.round(ind.tempoSeg / 60)} min`} />
            {ind.cadenciaSeg !== null && <StatRow label="Cadência" value={`1 golpe/${ind.cadenciaSeg}s`} />}
            {progressao && (
              <Text style={[styles.progressao, { color: progressao.precisaoDelta >= 0 ? colors.success : colors.danger }]}>
                Progressão: {progressao.precisaoDelta >= 0 ? '+' : ''}
                {progressao.precisaoDelta} p.p. de precisão e {progressao.pontosDelta >= 0 ? '+' : ''}
                {progressao.pontosDelta} pontos por sessão em relação às sessões anteriores.
              </Text>
            )}
          </View>
        )}

        <View style={styles.segmentRow}>
          {(Object.keys(METRICAS) as MetricaId[]).map((m) => (
            <SegmentTab
              key={m}
              label={METRICAS[m].nome}
              active={metrica === m}
              onPress={() => {
                setMetrica(m);
                setIndiceSel(-1);
              }}
            />
          ))}
        </View>

        {carregando && !dados ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
        ) : n === 0 ? (
          <Text style={styles.vazio}>Nenhuma sessão com sensor neste período. Sessões de demonstração não entram nos indicadores.</Text>
        ) : (
          <>
            <View style={styles.headlineRow}>
              <View>
                <Text style={styles.headlineEyebrow}>
                  {conj.nome} · {dataCurta(reais[idx].encerradaEm)}
                </Text>
                <View style={styles.headlineValueRow}>
                  <Text style={styles.headlineValue}>{vals[idx].toLocaleString('pt-BR')}</Text>
                  <Text style={styles.headlineUnit}>{conj.unidade}</Text>
                </View>
                <Text style={styles.deltaCaption} numberOfLines={1}>
                  {reais[idx].treino.nome}
                </Text>
              </View>
            </View>

            <View style={styles.chartCard} accessible accessibilityLabel={`Gráfico de ${conj.nome} por sessão: ${vals.join(', ')}`}>
              <Svg width="100%" height={176} viewBox={`0 0 ${W} 176`}>
                <Line x1={0} y1={75} x2={W} y2={75} stroke={colors.divider} strokeWidth={1} strokeDasharray="2 5" />
                <Line x1={0} y1={150.5} x2={W} y2={150.5} stroke={colors.border} strokeWidth={1} />
                {barras.map((b, i) => (
                  <Path key={i} d={b.d} fill={b.vazio ? colors.border : i === idx ? colors.primary : 'rgba(203,232,31,0.30)'} />
                ))}
                <SvgText x={0} y={169} fill={colors.textTertiary} fontSize={10} textAnchor="start">
                  {dataCurta(reais[0].encerradaEm)}
                </SvgText>
                <SvgText x={W} y={169} fill={colors.textTertiary} fontSize={10} textAnchor="end">
                  {dataCurta(reais[n - 1].encerradaEm)}
                </SvgText>
                {barras.map((b, i) => (
                  <Rect key={`hit-${i}`} x={b.x - GAP / 2} y={0} width={bw + GAP} height={150} fill="transparent" onPress={() => setIndiceSel(i)} />
                ))}
              </Svg>
              <View style={styles.chartFooter}>
                <Text style={styles.chartFooterText}>Uma barra por sessão</Text>
                <Text style={styles.chartFooterText}>Toque numa barra</Text>
              </View>
            </View>
          </>
        )}

        <Text style={[styles.headlineEyebrow, { marginTop: 26, marginBottom: 6 }]}>Sessões</Text>
        {(dados?.sessoes ?? []).map((s) => {
          const d = new Date(s.encerradaEm ?? s.iniciadaEm ?? Date.now());
          const marcas = [s.origem === 'DEMO' && 'demo', s.offline && 'offline', s.motivoInterrupcao && 'interrompida', s.estado !== 'ENCERRADA' && s.estado.toLowerCase()].filter(Boolean);
          return (
            <View key={s.id} style={styles.sessaoRow}>
              <View style={styles.sessaoData}>
                <Text style={styles.sessaoDia}>{String(d.getDate()).padStart(2, '0')}</Text>
                <Text style={styles.sessaoMes}>{MESES[d.getMonth()]}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.sessaoTreino} numberOfLines={1}>
                  {s.treino.nome}
                </Text>
                <Text style={styles.sessaoMeta}>
                  {s.golpes ?? 0} golpes · {(s.pontos ?? 0).toLocaleString('pt-BR')} pontos{marcas.length ? ` · ${marcas.join(', ')}` : ''}
                </Text>
              </View>
              <Text style={styles.sessaoPrecisao}>{s.resumo ? `${s.resumo.precisao}%` : '—'}</Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 18 },
  sessoesCount: { fontFamily: fonts.body, fontSize: 12, color: colors.textTertiary },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  indicadores: { marginTop: 16, gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14 },
  progressao: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 4 },
  segmentRow: { flexDirection: 'row', gap: 4, marginTop: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 4 },
  vazio: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textTertiary, marginTop: 24, textAlign: 'center' },
  headlineRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginTop: 22 },
  headlineEyebrow: { fontFamily: fonts.bodyMedium, fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.textSecondary },
  headlineValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },
  headlineValue: { fontFamily: fonts.displayBold, fontSize: 56, lineHeight: 56, color: colors.primary },
  headlineUnit: { fontFamily: fonts.display, fontSize: 18, color: colors.primary },
  deltaCaption: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textTertiary, marginTop: 4, maxWidth: 300 },
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

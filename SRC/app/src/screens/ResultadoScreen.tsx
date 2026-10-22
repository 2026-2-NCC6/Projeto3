import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { PageHeader, PrimaryButton, OutlineButton, SegmentTab, StatRow } from '../components/ui';
import { IconCalendar, IconCheckCircle, IconLocked, IconTrophy } from '../components/Icons';
import { CornerWatermark } from '../components/Watermark';
import { buscarTreino } from '../data/treinos';
import { LIMIAR_RESISTENCIA, META_POR_NIVEL, mmss } from '../sessao/regras';
import { registrarSessao } from '../sessao/historicoSessoes';

type Props = NativeStackScreenProps<RootStackParamList, 'Resultado'>;

type Aba = 'resumo' | 'zonas' | 'resistencia';

// Dados de exemplo, usados só quando a tela abre sem uma sessão (modo apresentação).
const EXEMPLO = {
  golpes: 114,
  acertos: 82,
  pontos: 1480,
  melhorSequencia: 9,
  fortes: 41,
  duracaoSeg: 18 * 60,
  porLado: { Forehand: { acertos: 51, total: 69 }, Backhand: { acertos: 31, total: 45 } },
  quartisForca: [2.8, 2.6, 2.1, 1.7],
  quedaEmSeg: (14 * 60 + 52) as number | null
};

const ZONAS = [
  { rotulo: 'Fundo esq.', n: 11 },
  { rotulo: 'Fundo centro', n: 19 },
  { rotulo: 'Fundo dir.', n: 14 },
  { rotulo: 'Meio esq.', n: 8 },
  { rotulo: 'Meio centro', n: 22 },
  { rotulo: 'Meio dir.', n: 8 }
];

const ROTULOS_QUARTIS = ['1º quarto', '2º quarto', '3º quarto', '4º quarto'];

export function ResultadoScreen({ navigation, route }: Props) {
  const resumo = route.params?.resumo;
  const real = resumo !== undefined;
  const treino = buscarTreino(resumo?.treinoId);
  const dados = resumo ?? EXEMPLO;
  const [aba, setAba] = useState<Aba>('resumo');

  useEffect(() => {
    if (resumo && resumo.golpes > 0) registrarSessao(resumo);
  }, [resumo]);

  const precisao = dados.golpes ? Math.round((dados.acertos / dados.golpes) * 100) : 0;
  const meta = META_POR_NIVEL[treino.nivel];
  const bateuMeta = dados.golpes > 0 && precisao >= meta;

  const golpes = useMemo(
    () =>
      (['Forehand', 'Backhand'] as const).map((nome) => {
        const { acertos, total } = dados.porLado[nome];
        return { nome, acertos, total, pct: total ? Math.round((acertos / total) * 100) : 0 };
      }),
    [dados]
  );

  const maiorZona = Math.max(...ZONAS.map((z) => z.n));
  const zonas = ZONAS.map((z) => ({
    ...z,
    bg: `rgba(34,197,94,${(0.05 + (z.n / maiorZona) * 0.24).toFixed(3)})`,
    bd: `rgba(34,197,94,${(0.14 + (z.n / maiorZona) * 0.3).toFixed(3)})`,
    fg: z.n >= maiorZona * 0.6 ? colors.success : colors.text
  }));

  const baseQ = dados.quartisForca.find((f) => f > 0) ?? 0;
  const quartis = dados.quartisForca.map((forca, i) => ({
    rotulo: ROTULOS_QUARTIS[i],
    forca,
    altura: Math.max(forca > 0 ? 4 : 2, Math.round((forca / 3) * 56)),
    cor: forca === 0 ? colors.border : forca < baseQ * (LIMIAR_RESISTENCIA / 100) ? colors.danger : colors.success
  }));

  const hora = new Date(resumo?.terminadaEm ?? Date.now());
  const quando = `Hoje, ${String(hora.getHours()).padStart(2, '0')}:${String(hora.getMinutes()).padStart(2, '0')}`;
  const duracaoMin = Math.max(1, Math.round(dados.duracaoSeg / 60));

  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader eyebrow="Sessão concluída" title={treino.nome.replace(' — ', '\n')} />
        <Text style={styles.subMeta}>
          {quando} · {treino.nivel} · {duracaoMin} min{resumo?.origem === 'demo' ? ' · demonstração' : ''}
        </Text>

        <View style={styles.heroRow}>
          <View>
            <Text style={styles.statLabelSmall}>Precisão</Text>
            <View style={styles.heroValueRow}>
              <Text style={styles.heroValue}>{dados.golpes ? precisao : '—'}</Text>
              {dados.golpes > 0 && <Text style={styles.heroUnit}>%</Text>}
            </View>
          </View>
          <View style={styles.statsCol}>
            <StatRow label="Pontos" value={dados.pontos.toLocaleString('pt-BR')} />
            <View style={styles.divider} />
            <StatRow label="Golpes" value={String(dados.golpes)} />
            <View style={styles.divider} />
            <StatRow label="Melhor sequência" value={`×${dados.melhorSequencia}`} />
            <View style={styles.divider} />
            <StatRow label="Golpes fortes" value={String(dados.fortes)} />
          </View>
        </View>

        <View style={[styles.metaBanner, !bateuMeta && { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconCheckCircle size={16} color={bateuMeta ? colors.success : colors.textTertiary} />
          <Text style={[styles.metaBannerText, !bateuMeta && { color: colors.textSecondary }]}>
            {dados.golpes === 0
              ? 'Nenhum golpe registrado nesta sessão.'
              : bateuMeta
                ? `Meta do nível superada — ${precisao}% contra ${meta}% exigidos.`
                : `Meta do nível: ${meta}%. Você fez ${precisao}% — falta pouco.`}
          </Text>
        </View>

        <View style={styles.tabs}>
          <SegmentTab label="Resumo" active={aba === 'resumo'} onPress={() => setAba('resumo')} />
          {!real && <SegmentTab label="Zonas do alvo" active={aba === 'zonas'} onPress={() => setAba('zonas')} />}
          <SegmentTab label="Resistência" active={aba === 'resistencia'} onPress={() => setAba('resistencia')} />
        </View>

        {aba === 'resumo' && (
          <View style={{ gap: 16, marginTop: 20 }}>
            {golpes.map((g) => (
              <View key={g.nome}>
                <View style={styles.golpeRow}>
                  <Text style={styles.golpeNome}>{g.nome}</Text>
                  <Text style={styles.golpeMono}>{g.acertos}/{g.total} · {g.pct}%</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${g.pct}%` }]} />
                </View>
              </View>
            ))}
            <Text style={styles.footnote}>
              {real
                ? 'Lado identificado pela rotação da raquete (giroscópio). Acerto é o golpe no lado que o exercício pedia.'
                : 'Classificação por assinatura do giroscópio no momento do contato.'}
            </Text>
          </View>
        )}

        {aba === 'zonas' && !real && (
          <View style={{ marginTop: 20 }}>
            <View style={styles.zonasGrid}>
              {zonas.map((z) => (
                <View key={z.rotulo} style={[styles.zonaCell, { backgroundColor: z.bg, borderColor: z.bd }]}>
                  <Text style={[styles.zonaValue, { color: z.fg }]}>{z.n}</Text>
                  <Text style={styles.zonaLabel}>{z.rotulo}</Text>
                </View>
              ))}
            </View>
            <View style={styles.foraRow}>
              <Text style={styles.foraLabel}>Fora do alvo</Text>
              <Text style={styles.foraValue}>32</Text>
            </View>
            <Text style={styles.footnote}>Distribuição pelas zonas do alvo de contato. Tom mais claro indica mais acertos.</Text>
          </View>
        )}

        {aba === 'resistencia' && (
          <View style={{ marginTop: 20 }}>
            <View style={styles.resistHeroRow}>
              <View>
                <Text style={styles.statLabelSmall}>Resistência</Text>
                <Text style={[styles.resistHeroValue, dados.quedaEmSeg === null && { color: colors.success }]}>
                  {dados.quedaEmSeg === null ? 'Estável' : mmss(dados.quedaEmSeg)}
                </Text>
              </View>
              <Text style={styles.resistHeroCaption}>
                {dados.quedaEmSeg === null ? `força acima de ${LIMIAR_RESISTENCIA}%\na sessão inteira` : `até a força\ncair abaixo de ${LIMIAR_RESISTENCIA}%`}
              </Text>
            </View>
            <View style={styles.quartisRow}>
              {quartis.map((q) => (
                <View key={q.rotulo} style={styles.quartilCol}>
                  <View style={styles.quartilTrack}>
                    <View style={[styles.quartilBar, { height: q.altura, backgroundColor: q.cor }]} />
                  </View>
                  <Text style={styles.quartilLabel}>{q.rotulo}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.footnote}>
              Força estimada pelo pico de rotação do swing no punho da raquete — não pelo pico de impacto, que satura o sensor no contato.
            </Text>
          </View>
        )}

        <View style={styles.achievementsSection}>
          <Text style={styles.eyebrow}>Conquistas</Text>
          <View style={styles.achievementsGrid}>
            <View style={[styles.achievement, dados.melhorSequencia >= 5 ? { backgroundColor: colors.successTintBg, borderColor: colors.successTintBd } : { opacity: 0.5 }]}>
              {dados.melhorSequencia >= 5 ? <IconTrophy /> : <IconLocked />}
              <Text style={[styles.achievementLabel, dados.melhorSequencia >= 5 && { color: colors.success }]}>
                {dados.melhorSequencia >= 5 ? `Sequência de ${dados.melhorSequencia}` : 'Sequência de 5'}
              </Text>
            </View>
            <View style={[styles.achievement, !bateuMeta && { opacity: 0.5 }]}>
              {bateuMeta ? <IconCalendar /> : <IconLocked />}
              <Text style={styles.achievementLabel}>Meta do nível</Text>
            </View>
            <View style={[styles.achievement, precisao < 80 && { opacity: 0.5 }]}>
              {precisao >= 80 ? <IconTrophy /> : <IconLocked />}
              <Text style={[styles.achievementLabel, precisao < 80 && { color: colors.textTertiary }]}>80% na sessão</Text>
            </View>
          </View>
        </View>

        <View style={styles.syncRow}>
          <IconCheckCircle />
          <Text style={styles.syncText}>
            {real ? 'Sessão salva no histórico deste celular.' : 'Dados de exemplo — faça uma sessão para ver os seus.'}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <OutlineButton label="Repetir treino" onPress={() => navigation.popToTop()} style={{ flex: 1, height: 54 }} />
        <PrimaryButton
          label="Ver histórico"
          onPress={() => navigation.navigate('MainTabs', { screen: 'Historico' })}
          style={{ flex: 1.2, height: 54 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  eyebrow: { fontFamily: fonts.bodyMedium, fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.textSecondary },
  subMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textTertiary, marginTop: 9 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginTop: 26 },
  statLabelSmall: { fontFamily: fonts.bodyMedium, fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.textSecondary },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 2 },
  heroValue: { fontFamily: fonts.displayBold, fontSize: 72, lineHeight: 72, color: colors.primary },
  heroUnit: { fontFamily: fonts.display, fontSize: 24, color: colors.primary },
  statsCol: { flex: 1, gap: 8, paddingBottom: 4 },
  divider: { height: 1, backgroundColor: colors.divider },
  metaBanner: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 18, padding: 12, borderRadius: 8, backgroundColor: colors.successTintBg, borderWidth: 1, borderColor: colors.successTintBd },
  metaBannerText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: colors.success },
  tabs: { flexDirection: 'row', gap: 4, marginTop: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 4 },
  golpeRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  golpeNome: { fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  golpeMono: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.divider, marginTop: 9, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.success },
  footnote: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 17, color: colors.textTertiary, marginTop: 4 },
  zonasGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  zonaCell: { width: '31.8%', height: 72, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  zonaValue: { fontFamily: fonts.displayBold, fontSize: 26 },
  zonaLabel: { fontFamily: fonts.body, fontSize: 9.5, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textTertiary },
  foraRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  foraLabel: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary },
  foraValue: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.danger },
  resistHeroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  resistHeroValue: { fontFamily: fonts.displayBold, fontSize: 46, color: colors.danger, marginTop: 2 },
  resistHeroCaption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textSecondary, paddingBottom: 6 },
  quartisRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 20 },
  quartilCol: { flex: 1, alignItems: 'center', gap: 8 },
  quartilTrack: { width: '100%', height: 56, justifyContent: 'flex-end' },
  quartilBar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  quartilLabel: { fontFamily: fonts.body, fontSize: 9.5, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textTertiary, textAlign: 'center' },
  achievementsSection: { marginTop: 28 },
  achievementsGrid: { flexDirection: 'row', gap: 8, marginTop: 12 },
  achievement: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, alignItems: 'center', gap: 9 },
  achievementLabel: { fontFamily: fonts.body, fontSize: 10.5, textAlign: 'center', lineHeight: 14, color: colors.textSecondary },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 22 },
  syncText: { flex: 1, fontFamily: fonts.body, fontSize: 11.5, color: colors.textSecondary },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 26, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surfaceSunken }
});

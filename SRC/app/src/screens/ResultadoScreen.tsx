import React, { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Conquista, Recomendacao, ResumoServidor } from '../api/tipos';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { Aviso, PageHeader, PrimaryButton, OutlineButton, SegmentTab, StatRow } from '../components/ui';
import { IconCheckCircle, IconChevronRight, IconTrophy } from '../components/Icons';
import { CornerWatermark } from '../components/Watermark';
import { LIMIAR_RESISTENCIA, mmss } from '../sessao/regras';
import { useAuth } from '../auth/AuthContext';
import { publicoDaSessao, textos } from '../sessao/linguagem';

type Props = NativeStackScreenProps<RootStackParamList, 'Resultado'>;

type Aba = 'lados' | 'resistencia';

const ROTULOS_QUARTIS = ['1º quarto', '2º quarto', '3º quarto', '4º quarto'];
const CONQUISTAS: Record<Conquista, string> = {
  PRIMEIRA_SESSAO: 'Primeira sessão',
  SEQUENCIA_10: '10 acertos seguidos',
  META_PRECISAO: 'Meta de precisão',
  RESISTENCIA: 'Resistência: 20+ golpes sem queda'
};

/** RF12: resumo com desempenho, metas, conquistas, eventos relevantes e recomendações. */
export function ResultadoScreen({ navigation, route }: Props) {
  const { praticanteAtivo } = useAuth();
  const { sessao, resumoLocal, pendente, treinoNome } = route.params;
  // O resumo do servidor é o oficial (mesmas regras, calculado sobre todos os eventos recebidos).
  const dados: ResumoServidor = sessao?.resumo ?? { ...resumoLocal, conquistas: [], recomendacoes: [] };
  const [aba, setAba] = useState<Aba>('lados');
  const t = textos(publicoDaSessao(praticanteAtivo, 'ADULTO'));

  const lados = useMemo(
    () =>
      (['Forehand', 'Backhand'] as const).map((nome) => {
        const { acertos, total } = dados.porLadoEsperado?.[nome] ?? dados.porLado[nome];
        return { nome, acertos, total, pct: total ? Math.round((acertos / total) * 100) : 0 };
      }),
    [dados]
  );

  const baseQ = dados.quartisForca.find((f) => f > 0) ?? 0;
  const quartis = dados.quartisForca.map((forca, i) => ({
    rotulo: ROTULOS_QUARTIS[i],
    altura: Math.max(forca > 0 ? 4 : 2, Math.round((forca / 3) * 56)),
    cor: forca === 0 ? colors.border : forca < baseQ * (LIMIAR_RESISTENCIA / 100) ? colors.danger : colors.success
  }));

  const conquistas = dados.conquistas ?? [];
  const recomendacoes: Recomendacao[] = dados.recomendacoes ?? [];

  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader eyebrow="Sessão concluída" title={treinoNome.replace(' — ', '\n')} />
        <Text style={styles.subMeta}>
          {Math.max(1, Math.round(dados.duracaoSeg / 60))} min{resumoLocal.origem === 'demo' ? ' · demonstração (fora dos indicadores)' : ''}
          {sessao?.motivoInterrupcao ? ` · interrompida: ${sessao.motivoInterrupcao}` : ''}
        </Text>

        {pendente && (
          <View style={{ marginTop: 14 }}>
            <Aviso texto="Sem conexão: a sessão ficou salva neste aparelho e será enviada automaticamente quando a internet voltar. Os números abaixo são os calculados no celular." />
          </View>
        )}
        {sessao?.divergencia && (
          <View style={{ marginTop: 14 }}>
            <Aviso texto="A pontuação oficial do servidor diferiu da calculada no celular; vale a do servidor." />
          </View>
        )}

        <View style={styles.heroRow}>
          <View>
            <Text style={styles.statLabelSmall}>Precisão</Text>
            <View style={styles.heroValueRow}>
              <Text style={styles.heroValue}>{dados.golpes ? dados.precisao : '—'}</Text>
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
            <StatRow label="Consistência" value={`${dados.consistencia}%`} />
          </View>
        </View>

        <View style={[styles.metaBanner, !dados.metaAtingida && { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconCheckCircle size={16} color={dados.metaAtingida ? colors.success : colors.textTertiary} />
          <Text style={[styles.metaBannerText, !dados.metaAtingida && { color: colors.textSecondary }]}>
            {dados.golpes === 0
              ? 'Nenhum golpe registrado nesta sessão.'
              : `${dados.metaAtingida ? t.metaOk : t.metaQuase} Meta do treino: ${dados.metaPrecisao}%; você fez ${dados.precisao}%.`}
          </Text>
        </View>

        <View style={styles.tabs}>
          <SegmentTab label="Por lado pedido" active={aba === 'lados'} onPress={() => setAba('lados')} />
          <SegmentTab label="Resistência" active={aba === 'resistencia'} onPress={() => setAba('resistencia')} />
        </View>

        {aba === 'lados' && (
          <View style={{ gap: 16, marginTop: 20 }}>
            {lados.map((g) => (
              <View key={g.nome} accessible accessibilityLabel={`${g.nome}: ${g.acertos} de ${g.total}, ${g.pct}%`}>
                <View style={styles.golpeRow}>
                  <Text style={styles.golpeNome}>{g.nome}</Text>
                  <Text style={styles.golpeMono}>
                    {g.acertos}/{g.total} · {g.pct}%
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${g.pct}%` }]} />
                </View>
              </View>
            ))}
            <Text style={styles.footnote}>
              Acertos sobre as bolas que pediam cada lado. Lado identificado pela rotação da raquete (giroscópio).
              {dados.cadenciaSeg ? ` Cadência média: um golpe a cada ${dados.cadenciaSeg}s.` : ''}
            </Text>
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

        {conquistas.length > 0 && (
          <View style={styles.achievementsSection}>
            <Text style={styles.eyebrow}>Conquistas</Text>
            <View style={styles.achievementsGrid}>
              {conquistas.map((c) => (
                <View key={c} style={[styles.achievement, { backgroundColor: colors.successTintBg, borderColor: colors.successTintBd }]}>
                  <IconTrophy />
                  <Text style={[styles.achievementLabel, { color: colors.success }]}>{CONQUISTAS[c]}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {recomendacoes.length > 0 && (
          <View style={styles.achievementsSection}>
            <Text style={styles.eyebrow}>Recomendações</Text>
            {recomendacoes.map((r) => (
              <Pressable
                key={r.tipo}
                disabled={!r.treinoSlug}
                onPress={() => r.treinoSlug && navigation.navigate('Preparacao', { slug: r.treinoSlug })}
                style={styles.recomendacao}
                accessibilityRole={r.treinoSlug ? 'button' : 'text'}
              >
                <Text style={styles.recomendacaoTexto}>{r.mensagem}</Text>
                {r.treinoSlug && <IconChevronRight />}
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.syncRow}>
          <IconCheckCircle />
          <Text style={styles.syncText}>{pendente ? 'Aguardando conexão para enviar.' : 'Sessão registrada no seu histórico e enviada à plataforma SmartTennis.'}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <OutlineButton label="Repetir treino" onPress={() => navigation.replace('Preparacao', { slug: resumoLocal.treinoSlug })} style={{ flex: 1, height: 54 }} />
        <PrimaryButton label="Ver histórico" onPress={() => navigation.navigate('MainTabs', { screen: 'Historico' })} style={{ flex: 1.2, height: 54 }} />
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
  metaBannerText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.success },
  tabs: { flexDirection: 'row', gap: 4, marginTop: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 4 },
  golpeRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  golpeNome: { fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  golpeMono: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.divider, marginTop: 9, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.success },
  footnote: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 17, color: colors.textTertiary, marginTop: 4 },
  resistHeroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  resistHeroValue: { fontFamily: fonts.displayBold, fontSize: 46, color: colors.danger, marginTop: 2 },
  resistHeroCaption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textSecondary, paddingBottom: 6 },
  quartisRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 20 },
  quartilCol: { flex: 1, alignItems: 'center', gap: 8 },
  quartilTrack: { width: '100%', height: 56, justifyContent: 'flex-end' },
  quartilBar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  quartilLabel: { fontFamily: fonts.body, fontSize: 9.5, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textTertiary, textAlign: 'center' },
  achievementsSection: { marginTop: 28 },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  achievement: { minWidth: '30%', flexGrow: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, alignItems: 'center', gap: 9 },
  achievementLabel: { fontFamily: fonts.body, fontSize: 10.5, textAlign: 'center', lineHeight: 14, color: colors.textSecondary },
  recomendacao: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  recomendacaoTexto: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 18.5, color: colors.text },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 22 },
  syncText: { flex: 1, fontFamily: fonts.body, fontSize: 11.5, color: colors.textSecondary },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 26, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surfaceSunken }
});

import React, { useMemo, useState } from 'react';
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { DangerButton, GhostButton, OutlineButton } from '../components/ui';
import { IconAlert, IconPulse } from '../components/Icons';
import { CornerWatermark } from '../components/Watermark';

type Props = NativeStackScreenProps<RootStackParamList, 'Sessao'>;

type Golpe = { t: string; tipo: 'Forehand' | 'Backhand'; zona: string; ok: boolean; forca: 1 | 2 | 3 };

const LIMIAR_RESISTENCIA = 70;

function mmss(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m < 10 ? '0' + m : m}:${r < 10 ? '0' + r : r}`;
}

function media(arr: number[]) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function indiceResistencia(forcas: number[]) {
  const base = media(forcas.slice(0, Math.min(5, forcas.length)));
  const atual = media(forcas.slice(-6));
  const bruto = base > 0 ? (atual / base) * 100 : 100;
  return Math.max(0, Math.min(100, Math.round(bruto)));
}

export function SessaoScreen({ navigation }: Props) {
  const [pausado, setPausado] = useState(false);
  const [parado, setParado] = useState(false);
  const [sheetAberto, setSheetAberto] = useState(false);
  const [pontos, setPontos] = useState(1240);
  const [acertos, setAcertos] = useState(34);
  const [golpes, setGolpes] = useState(47);
  const [streak, setStreak] = useState(7);
  const [quedaEm, setQuedaEm] = useState<string | null>(null);
  const [forcas, setForcas] = useState<number[]>([3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 2, 3]);
  const [feed, setFeed] = useState<Golpe[]>([
    { t: '02:56', tipo: 'Forehand', zona: 'Zona 2', ok: true, forca: 3 },
    { t: '02:52', tipo: 'Backhand', zona: 'Fora', ok: false, forca: 2 },
    { t: '02:47', tipo: 'Forehand', zona: 'Zona 1', ok: true, forca: 3 },
    { t: '02:43', tipo: 'Forehand', zona: 'Zona 2', ok: true, forca: 2 }
  ]);

  const tempo = mmss(180 + (golpes - 47) * 4);
  const precisao = Math.round((acertos / golpes) * 100);
  const resistIndice = indiceResistencia(forcas);
  const resistOk = resistIndice >= LIMIAR_RESISTENCIA;
  const ultimo = feed[0];

  const liveLabel = parado ? 'Parada segura' : pausado ? 'Pausado' : 'Ao vivo';
  const liveCor = parado ? colors.danger : pausado ? colors.warning : colors.primary;

  function registrar(tipo: 'forte' | 'fraco' | 'erro') {
    if (parado) return;
    const ok = tipo !== 'erro';
    const forca: 1 | 2 | 3 = tipo === 'forte' ? 3 : tipo === 'fraco' ? 1 : 2;
    const tipoGolpe: Golpe['tipo'] = golpes % 2 === 1 ? 'Backhand' : 'Forehand';
    const zona = ok ? `Zona ${1 + (golpes % 2)}` : 'Fora';
    const novoStreak = ok ? streak + 1 : 0;
    const novoGolpes = golpes + 1;
    const t = mmss(180 + (novoGolpes - 47) * 4);
    const novasForcas = [...forcas, forca];
    const indice = indiceResistencia(novasForcas);
    const bonus = ok && forca === 3 ? 5 : 0;

    setGolpes(novoGolpes);
    setAcertos((a) => a + (ok ? 1 : 0));
    setPontos((p) => p + (ok ? 10 + novoStreak * 5 + bonus : 0));
    setStreak(novoStreak);
    setForcas(novasForcas);
    if (!quedaEm && indice < LIMIAR_RESISTENCIA) setQuedaEm(t);
    setFeed((f) => [{ t, tipo: tipoGolpe, zona, ok, forca }, ...f].slice(0, 4));
  }

  const series = useMemo(
    () => [0, 1, 2, 3, 4].map((i) => (i < 2 ? colors.primary : i === 2 ? 'rgba(203,232,31,0.45)' : colors.border)),
    []
  );

  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <View style={styles.header}>
        <View style={styles.liveRow}>
          <View style={styles.statusLeft}>
            <View style={[styles.liveDot, { backgroundColor: liveCor }]} />
            <Text style={[styles.liveLabel, { color: liveCor }]}>{liveLabel}</Text>
          </View>
          <Text style={styles.timer}>{tempo}</Text>
        </View>
        <View style={styles.tituloRow}>
          <Text style={styles.subtitulo}>Cruzado de fundo — consistência</Text>
          <Text style={styles.serie}>Série 3/5</Text>
        </View>
        <View style={styles.seriesBar}>
          {series.map((c, i) => (
            <View key={i} style={[styles.serieSeg, { backgroundColor: c }]} />
          ))}
        </View>
      </View>

      <View style={styles.heroRow}>
        <View>
          <Text style={styles.eyebrow}>Precisão</Text>
          <View style={styles.heroValueRow}>
            <Text style={styles.heroValue}>{precisao}</Text>
            <Text style={styles.heroUnit}>%</Text>
          </View>
          <Text style={styles.heroSub}>{acertos}/{golpes} golpes</Text>
        </View>
        <View style={styles.tilesCol}>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Pontos</Text>
            <Text style={styles.tileValue}>{pontos.toLocaleString('pt-BR')}</Text>
          </View>
          <View style={[styles.tile, streak >= 5 && { backgroundColor: colors.primaryTintBgSoft, borderColor: colors.primaryTintBd }]}>
            <Text style={styles.tileLabel}>Sequência</Text>
            <Text style={[styles.tileValue, streak >= 5 && { color: colors.primary }]}>×{streak}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.banner, { backgroundColor: ultimo.ok ? colors.successTintBg : colors.dangerTintBg, borderColor: ultimo.ok ? colors.successTintBd : colors.dangerTintBd }]}>
        <View style={{ gap: 4 }}>
          <View style={[styles.led, { backgroundColor: ultimo.ok ? colors.success : colors.border }]} />
          <View style={[styles.led, { backgroundColor: ultimo.ok ? colors.border : colors.danger }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: ultimo.ok ? colors.success : colors.danger }]}>
            {ultimo.ok ? 'Acerto' : 'Erro'} · {ultimo.tipo} · {ultimo.zona}
          </Text>
          <Text style={styles.bannerDetail}>
            {ultimo.ok ? 'LED verde + tom agudo no dispositivo · 38 ms' : 'LED vermelho + tom grave no dispositivo · 41 ms'}
          </Text>
        </View>
      </View>

      <View style={[styles.banner, { backgroundColor: resistOk ? colors.successTintBg : colors.dangerTintBg, borderColor: resistOk ? colors.successTintBd : colors.dangerTintBd }]}>
        <IconPulse size={20} color={resistOk ? colors.success : colors.danger} />
        <View style={{ flex: 1 }}>
          <Text style={styles.resistLabel}>Resistência</Text>
          <Text style={[styles.bannerDetail, { color: resistOk ? colors.success : colors.danger, marginTop: 3 }]}>
            {quedaEm ? `Queda detectada aos ${quedaEm}` : 'Força estável desde o início'}
          </Text>
        </View>
        <Text style={[styles.resistValue, { color: resistOk ? colors.success : colors.danger }]}>{resistIndice}%</Text>
      </View>

      <View style={styles.feedSection}>
        <Text style={styles.eyebrow}>Últimos golpes</Text>
        {feed.map((g, i) => (
          <View key={`${g.t}-${i}`} style={styles.feedRow}>
            <View style={[styles.feedDot, { backgroundColor: g.ok ? colors.success : colors.danger }]} />
            <Text style={styles.feedTipo}>{g.tipo}</Text>
            <Text style={styles.feedZona}>{g.zona}</Text>
            <View style={styles.feedBars}>
              <View style={[styles.feedBar, { height: 5, backgroundColor: colors.primary }]} />
              <View style={[styles.feedBar, { height: 9, backgroundColor: g.forca >= 2 ? colors.primary : colors.borderStrong }]} />
              <View style={[styles.feedBar, { height: 13, backgroundColor: g.forca >= 3 ? colors.primary : colors.borderStrong }]} />
            </View>
            <Text style={styles.feedTempo}>{g.t}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actionsRow}>
        <OutlineButton
          label={parado ? 'Parado' : pausado ? 'Retomar' : 'Pausar'}
          disabled={parado}
          onPress={() => setPausado((p) => !p)}
          style={{ flex: 1, height: 50 }}
        />
        <Pressable onPress={() => setSheetAberto(true)} style={styles.paradaBtn}>
          <Text style={styles.paradaLabel}>Parada segura</Text>
        </Pressable>
      </View>

      <View style={styles.demoRow}>
        <Text style={styles.demoLabel}>Demo do sensor</Text>
        <Pressable style={styles.demoBtn} onPress={() => registrar('forte')}>
          <Text style={styles.demoBtnLabel}>Forte</Text>
        </Pressable>
        <Pressable style={styles.demoBtn} onPress={() => registrar('fraco')}>
          <Text style={styles.demoBtnLabel}>Fraco</Text>
        </Pressable>
        <Pressable style={styles.demoBtn} onPress={() => registrar('erro')}>
          <Text style={styles.demoBtnLabel}>Erro</Text>
        </Pressable>
      </View>

      <Modal visible={sheetAberto} transparent animationType="slide" onRequestClose={() => setSheetAberto(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <IconAlert />
            <Text style={styles.sheetTitle}>Acionar parada segura?</Text>
            <Text style={styles.sheetBody}>
              A máquina lançadora para imediatamente e a sessão entra em estado bloqueado. Os dados coletados até aqui são preservados.
            </Text>
            <View style={{ gap: 10, marginTop: 22 }}>
              <DangerButton
                label="Parar agora"
                onPress={() => {
                  setSheetAberto(false);
                  setParado(true);
                  setPausado(true);
                  navigation.navigate('ParadaSegura');
                }}
              />
              <GhostButton label="Continuar treinando" onPress={() => setSheetAberto(false)} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 6 },
  liveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5 },
  liveLabel: { fontFamily: fonts.bodyMedium, fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase' },
  timer: { fontFamily: fonts.mono, fontSize: 14, color: colors.textSecondary, letterSpacing: 0.5 },
  tituloRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 16 },
  subtitulo: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  serie: { fontFamily: fonts.displayBold, fontSize: 17, letterSpacing: 0.5, color: colors.text, textTransform: 'uppercase' },
  seriesBar: { flexDirection: 'row', gap: 4, marginTop: 9 },
  serieSeg: { flex: 1, height: 4, borderRadius: 2 },
  heroRow: { paddingHorizontal: 20, paddingTop: 20, flexDirection: 'row', alignItems: 'flex-end', gap: 18 },
  eyebrow: { fontFamily: fonts.bodyMedium, fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.textSecondary },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 2 },
  heroValue: { fontFamily: fonts.displayBold, fontSize: 76, lineHeight: 76, color: colors.primary },
  heroUnit: { fontFamily: fonts.display, fontSize: 26, color: colors.primary },
  heroSub: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.textTertiary, marginTop: 7 },
  tilesCol: { flex: 1, gap: 8, paddingBottom: 4 },
  tile: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 },
  tileLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textTertiary },
  tileValue: { fontFamily: fonts.displayBold, fontSize: 26, color: colors.text, marginTop: 2 },
  banner: { marginHorizontal: 20, marginTop: 12, borderRadius: 10, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 13 },
  led: { width: 9, height: 9, borderRadius: 4.5 },
  bannerTitle: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  bannerDetail: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textTertiary, marginTop: 3 },
  resistLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textSecondary },
  resistValue: { fontFamily: fonts.displayBold, fontSize: 24 },
  feedSection: { flex: 1, paddingHorizontal: 20, paddingTop: 14 },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.divider },
  feedDot: { width: 7, height: 7, borderRadius: 3.5 },
  feedTipo: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  feedZona: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  feedBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2.5, height: 13 },
  feedBar: { width: 3.5, borderRadius: 1 },
  feedTempo: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.textQuaternary, width: 38, textAlign: 'right' },
  actionsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12 },
  paradaBtn: { flex: 1.25, height: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerTintBg, borderWidth: 1, borderColor: 'rgba(239,68,68,0.45)' },
  paradaLabel: { fontFamily: fonts.bodyBold, fontSize: 14, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.danger },
  demoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 12, marginBottom: 20, paddingTop: 11, borderTopWidth: 1, borderTopColor: colors.border, borderStyle: 'dashed' },
  demoLabel: { fontFamily: fonts.bodyMedium, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.textQuaternary, width: 54, lineHeight: 12 },
  demoBtn: { flex: 1, height: 42, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  demoBtnLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(9,11,9,0.86)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 22, paddingBottom: 30 },
  sheetTitle: { fontFamily: fonts.displayBold, fontSize: 28, color: colors.text, textTransform: 'uppercase', marginTop: 14 },
  sheetBody: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.textSecondary, marginTop: 10 }
});

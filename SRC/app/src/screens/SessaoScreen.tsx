import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { DangerButton, GhostButton, OutlineButton } from '../components/ui';
import { IconAlert, IconPulse } from '../components/Icons';
import { CornerWatermark } from '../components/Watermark';
import { useBle } from '../ble/BleContext';
import type { Comando, EstadoDispositivo } from '../ble/protocolo';
import { buscarTreino } from '../data/treinos';
import {
  GolpeRegistrado,
  LIMIAR_RESISTENCIA,
  Lado,
  golpesDeExemplo,
  ladoEsperado,
  mmss,
  resumirSessao
} from '../sessao/regras';

type Props = NativeStackScreenProps<RootStackParamList, 'Sessao'>;

type Fase = 'iniciando' | 'rodando' | 'pausado' | 'parado';
type Pendente = 'iniciar' | 'pausar' | 'retomar' | 'parar' | null;

const GOLPES_POR_SERIE = 20;
const SERIES = 5;
const SEG_DEMO_INICIAL = 188;

export function SessaoScreen({ navigation, route }: Props) {
  const treino = buscarTreino(route.params?.treinoId);
  const ble = useBle();
  const { enviarEAguardar, enviar, aoReceberGolpe } = ble;
  const sensorAtivo = ble.disponivel && ble.status === 'conectado';
  // Decide uma vez, na entrada da tela: sessão com sensor real ou demonstração.
  const [usouSensor] = useState(sensorAtivo);

  const [golpes, setGolpes] = useState<GolpeRegistrado[]>(() => (usouSensor ? [] : golpesDeExemplo(treino)));
  const [tempoSeg, setTempoSeg] = useState(usouSensor ? 0 : SEG_DEMO_INICIAL);
  const [fase, setFase] = useState<Fase>(usouSensor ? 'iniciando' : 'rodando');
  const [pendente, setPendente] = useState<Pendente>(null);
  const [erroCmd, setErroCmd] = useState<string | null>(null);
  const [sheetAberto, setSheetAberto] = useState(false);

  const faseRef = useRef(fase);
  faseRef.current = fase;
  const tempoRef = useRef(tempoSeg);
  tempoRef.current = tempoSeg;

  const resumo = useMemo(
    () => resumirSessao(treino.id, golpes, tempoSeg, usouSensor ? 'sensor' : 'demo'),
    [treino.id, golpes, tempoSeg, usouSensor]
  );
  const proximoEsperado = ladoEsperado(treino, golpes.length);

  useEffect(() => {
    if (fase !== 'rodando') return;
    const id = setInterval(() => setTempoSeg((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [fase]);

  const registrar = useCallback(
    (lado: Lado, forca: 1 | 2 | 3) => {
      if (faseRef.current !== 'rodando') return;
      setGolpes((anteriores) => {
        const esperado = ladoEsperado(treino, anteriores.length);
        return [...anteriores, { t: tempoRef.current, lado, esperado, ok: lado === esperado, forca }];
      });
    },
    [treino]
  );

  // Envia um comando e só muda de fase quando a placa confirma com o E: esperado.
  const comandar = useCallback(
    async (cmd: Comando, confirmacao: EstadoDispositivo, tipo: Exclude<Pendente, null>) => {
      setPendente(tipo);
      setErroCmd(null);
      const estado = await enviarEAguardar(cmd);
      setPendente(null);
      if (estado !== confirmacao) {
        setErroCmd(
          estado
            ? `A placa respondeu ${estado} em vez de ${confirmacao}. Tente de novo.`
            : 'A placa não confirmou o comando. Verifique a conexão e tente de novo.'
        );
        return false;
      }
      return true;
    },
    [enviarEAguardar]
  );

  const iniciarColeta = useCallback(async () => {
    if (await comandar('START', 'COLETANDO', 'iniciar')) setFase('rodando');
  }, [comandar]);

  useEffect(() => {
    if (!usouSensor) return;
    iniciarColeta();
    const parar = aoReceberGolpe((g) => registrar(g.lado, g.forca));
    return () => {
      parar();
      if (faseRef.current !== 'parado') enviar('STOP');
    };
  }, [usouSensor, iniciarColeta, aoReceberGolpe, registrar, enviar]);

  // A placa volta em AGUARDANDO depois de uma queda ou de ser religada: retoma a coleta sozinho.
  const statusAnterior = useRef(ble.status);
  useEffect(() => {
    const antes = statusAnterior.current;
    statusAnterior.current = ble.status;
    if (!usouSensor || ble.status !== 'conectado' || antes === 'conectado') return;
    if (faseRef.current === 'rodando' || faseRef.current === 'iniciando') iniciarColeta();
  }, [ble.status, usouSensor, iniciarColeta]);

  async function alternarPausa() {
    if (pendente) return;
    const pausar = fase === 'rodando';
    if (!usouSensor || !sensorAtivo) {
      setFase(pausar ? 'pausado' : 'rodando');
      return;
    }
    if (pausar) {
      if (await comandar('PAUSE', 'PAUSADO', 'pausar')) setFase('pausado');
      return;
    }
    // Depois de uma reconexão a placa está em AGUARDANDO, não em PAUSADO: aí o certo é START.
    const cmd: Comando = ble.estadoDispositivo === 'PAUSADO' ? 'RESUME' : 'START';
    if (await comandar(cmd, 'COLETANDO', 'retomar')) setFase('rodando');
  }

  function encerrar() {
    setFase('parado');
    setSheetAberto(false);
    navigation.navigate('ParadaSegura', { resumo: resumirSessao(treino.id, golpes, tempoSeg, usouSensor ? 'sensor' : 'demo') });
  }

  async function pararAgora() {
    if (pendente) return;
    // Sem conexão a placa já parou de coletar (ela volta a AGUARDANDO quando o app cai).
    if (!usouSensor || !sensorAtivo) {
      encerrar();
      return;
    }
    if (await comandar('STOP', 'PARADO', 'parar')) encerrar();
  }

  const reconectando = usouSensor && !sensorAtivo && fase !== 'parado';
  const { live, liveCor } =
    fase === 'parado'
      ? { live: 'Parada segura', liveCor: colors.danger }
      : reconectando
        ? { live: 'Sensor reconectando…', liveCor: colors.warning }
        : fase === 'iniciando'
          ? { live: 'Iniciando sensor…', liveCor: colors.warning }
          : fase === 'pausado'
            ? { live: 'Pausado', liveCor: colors.warning }
            : { live: 'Ao vivo', liveCor: colors.primary };

  const serieAtual = Math.min(SERIES, Math.floor(golpes.length / GOLPES_POR_SERIE) + 1);
  const series = Array.from({ length: SERIES }, (_, i) =>
    i < serieAtual - 1 ? colors.primary : i === serieAtual - 1 ? colors.primaryTintBd : colors.border
  );

  const precisao = resumo.golpes ? Math.round((resumo.acertos / resumo.golpes) * 100) : null;
  const resistOk = resumo.indiceResistencia >= LIMIAR_RESISTENCIA;
  const ultimo = golpes[golpes.length - 1];
  const recentes = golpes.slice(-4).reverse();

  const rotuloPausa =
    pendente === 'pausar' ? 'Pausando…' : pendente === 'retomar' ? 'Retomando…' : fase === 'pausado' ? 'Retomar' : 'Pausar';

  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <View style={styles.header}>
        <View style={styles.liveRow}>
          <View style={styles.statusLeft}>
            <View style={[styles.liveDot, { backgroundColor: liveCor }]} />
            <Text style={[styles.liveLabel, { color: liveCor }]}>{live}</Text>
          </View>
          <Text style={styles.timer}>{mmss(tempoSeg)}</Text>
        </View>
        <View style={styles.tituloRow}>
          <Text style={styles.subtitulo} numberOfLines={1}>{treino.nome}</Text>
          <Text style={styles.serie}>Série {serieAtual}/{SERIES}</Text>
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
            <Text style={styles.heroValue}>{precisao ?? '—'}</Text>
            {precisao !== null && <Text style={styles.heroUnit}>%</Text>}
          </View>
          <Text style={styles.heroSub}>{resumo.acertos}/{resumo.golpes} golpes</Text>
        </View>
        <View style={styles.tilesCol}>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Pontos</Text>
            <Text style={styles.tileValue}>{resumo.pontos.toLocaleString('pt-BR')}</Text>
          </View>
          <View style={[styles.tile, resumo.sequenciaAtual >= 5 && { backgroundColor: colors.primaryTintBgSoft, borderColor: colors.primaryTintBd }]}>
            <Text style={styles.tileLabel}>Sequência</Text>
            <Text style={[styles.tileValue, resumo.sequenciaAtual >= 5 && { color: colors.primary }]}>×{resumo.sequenciaAtual}</Text>
          </View>
        </View>
      </View>

      {ultimo ? (
        <View style={[styles.banner, { backgroundColor: ultimo.ok ? colors.successTintBg : colors.dangerTintBg, borderColor: ultimo.ok ? colors.successTintBd : colors.dangerTintBd }]}>
          <View style={{ gap: 4 }}>
            <View style={[styles.led, { backgroundColor: ultimo.ok ? colors.success : colors.border }]} />
            <View style={[styles.led, { backgroundColor: ultimo.ok ? colors.border : colors.danger }]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: ultimo.ok ? colors.success : colors.danger }]}>
              {ultimo.ok ? 'Acerto' : 'Erro'} · {ultimo.lado}
            </Text>
            <Text style={styles.bannerDetail}>
              {ultimo.ok ? 'Lado pedido pelo exercício' : `O exercício pedia ${ultimo.esperado}`} · próximo: {proximoEsperado}
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Aguardando o primeiro golpe</Text>
            <Text style={styles.bannerDetail}>O exercício pede um {proximoEsperado}.</Text>
          </View>
        </View>
      )}

      <View style={[styles.banner, { backgroundColor: resistOk ? colors.successTintBg : colors.dangerTintBg, borderColor: resistOk ? colors.successTintBd : colors.dangerTintBd }]}>
        <IconPulse size={20} color={resistOk ? colors.success : colors.danger} />
        <View style={{ flex: 1 }}>
          <Text style={styles.resistLabel}>Resistência</Text>
          <Text style={[styles.bannerDetail, { color: resistOk ? colors.success : colors.danger, marginTop: 3 }]}>
            {resumo.quedaEmSeg !== null ? `Queda detectada aos ${mmss(resumo.quedaEmSeg)}` : 'Força estável desde o início'}
          </Text>
        </View>
        <Text style={[styles.resistValue, { color: resistOk ? colors.success : colors.danger }]}>{resumo.indiceResistencia}%</Text>
      </View>

      <View style={styles.feedSection}>
        <Text style={styles.eyebrow}>Últimos golpes</Text>
        {recentes.length === 0 && <Text style={styles.feedVazio}>Nenhum golpe ainda.</Text>}
        {recentes.map((g, i) => (
          <View key={`${g.t}-${golpes.length - i}`} style={styles.feedRow}>
            <View style={[styles.feedDot, { backgroundColor: g.ok ? colors.success : colors.danger }]} />
            <Text style={styles.feedTipo}>{g.lado}</Text>
            <Text style={styles.feedZona}>{g.ok ? 'como pedido' : `pedia ${g.esperado === 'Forehand' ? 'FH' : 'BH'}`}</Text>
            <View style={styles.feedBars}>
              <View style={[styles.feedBar, { height: 5, backgroundColor: colors.primary }]} />
              <View style={[styles.feedBar, { height: 9, backgroundColor: g.forca >= 2 ? colors.primary : colors.borderStrong }]} />
              <View style={[styles.feedBar, { height: 13, backgroundColor: g.forca >= 3 ? colors.primary : colors.borderStrong }]} />
            </View>
            <Text style={styles.feedTempo}>{mmss(g.t)}</Text>
          </View>
        ))}
      </View>

      {erroCmd && !sheetAberto && (
        <View style={styles.erroRow}>
          <Text style={styles.erroTexto}>{erroCmd}</Text>
          {fase === 'iniciando' && sensorAtivo && <GhostButton label="Tentar de novo" onPress={iniciarColeta} style={{ height: 36 }} />}
        </View>
      )}

      <View style={styles.actionsRow}>
        <OutlineButton
          label={fase === 'parado' ? 'Parado' : rotuloPausa}
          disabled={fase === 'parado' || fase === 'iniciando' || pendente !== null}
          onPress={alternarPausa}
          style={{ flex: 1, height: 50 }}
        />
        <Pressable onPress={() => setSheetAberto(true)} style={styles.paradaBtn}>
          <Text style={styles.paradaLabel}>Parada segura</Text>
        </Pressable>
      </View>

      {usouSensor ? (
        <Pressable style={styles.demoRow} onLongPress={() => navigation.navigate('Debug')} delayLongPress={700}>
          <View style={[styles.liveDot, { backgroundColor: sensorAtivo ? colors.success : colors.warning }]} />
          <Text style={styles.sensorTexto} numberOfLines={1}>
            {sensorAtivo ? `Sensor BLE ativo · ${ble.nomeDispositivo ?? ''}` : 'Sensor fora do ar — reconectando sozinho'}
          </Text>
          <Text style={styles.sensorProximo}>próximo: {proximoEsperado === 'Forehand' ? 'FH' : 'BH'}</Text>
        </Pressable>
      ) : (
        <View style={styles.demoRow}>
          <Text style={styles.demoLabel}>Demo do sensor</Text>
          <Pressable style={styles.demoBtn} onPress={() => registrar(proximoEsperado, 3)}>
            <Text style={styles.demoBtnLabel}>Forte</Text>
          </Pressable>
          <Pressable style={styles.demoBtn} onPress={() => registrar(proximoEsperado, 1)}>
            <Text style={styles.demoBtnLabel}>Fraco</Text>
          </Pressable>
          <Pressable style={styles.demoBtn} onPress={() => registrar(proximoEsperado === 'Forehand' ? 'Backhand' : 'Forehand', 2)}>
            <Text style={styles.demoBtnLabel}>Lado errado</Text>
          </Pressable>
        </View>
      )}

      <Modal visible={sheetAberto} transparent animationType="slide" onRequestClose={() => setSheetAberto(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <IconAlert />
            <Text style={styles.sheetTitle}>Acionar parada segura?</Text>
            <Text style={styles.sheetBody}>
              A placa para de coletar e a sessão entra em estado bloqueado. Os dados coletados até aqui são preservados.
            </Text>
            {erroCmd && <Text style={[styles.erroTexto, { marginTop: 12 }]}>{erroCmd}</Text>}
            <View style={{ gap: 10, marginTop: 22 }}>
              <DangerButton label={pendente === 'parar' ? 'Aguardando a placa…' : 'Parar agora'} onPress={pararAgora} />
              <GhostButton
                label="Continuar treinando"
                onPress={() => {
                  setErroCmd(null);
                  setSheetAberto(false);
                }}
                style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8 }}
              />
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
  subtitulo: { flex: 1, marginRight: 12, fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
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
  bannerTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  bannerDetail: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textTertiary, marginTop: 3 },
  resistLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textSecondary },
  resistValue: { fontFamily: fonts.displayBold, fontSize: 24 },
  feedSection: { flex: 1, paddingHorizontal: 20, paddingTop: 14 },
  feedVazio: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textTertiary, paddingVertical: 12 },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.divider },
  feedDot: { width: 7, height: 7, borderRadius: 3.5 },
  feedTipo: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  feedZona: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  feedBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2.5, height: 13 },
  feedBar: { width: 3.5, borderRadius: 1 },
  feedTempo: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.textQuaternary, width: 38, textAlign: 'right' },
  erroRow: { marginHorizontal: 20, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  erroTexto: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.danger },
  actionsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12 },
  paradaBtn: { flex: 1.25, height: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerTintBg, borderWidth: 1, borderColor: 'rgba(239,68,68,0.45)' },
  paradaLabel: { fontFamily: fonts.bodyBold, fontSize: 14, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.danger },
  demoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 12, marginBottom: 20, paddingTop: 11, minHeight: 42, borderTopWidth: 1, borderTopColor: colors.border, borderStyle: 'dashed' },
  demoLabel: { fontFamily: fonts.bodyMedium, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.textQuaternary, width: 54, lineHeight: 12 },
  demoBtn: { flex: 1, height: 42, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  demoBtnLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  sensorTexto: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  sensorProximo: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.primary },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(9,11,9,0.86)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 22, paddingBottom: 30 },
  sheetTitle: { fontFamily: fonts.displayBold, fontSize: 28, color: colors.text, textTransform: 'uppercase', marginTop: 14 },
  sheetBody: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.textSecondary, marginTop: 10 }
});

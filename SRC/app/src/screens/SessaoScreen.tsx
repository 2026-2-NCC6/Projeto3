import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { io, Socket } from 'socket.io-client';
import type { RootStackParamList } from '../navigation/types';
import type { Lancamento, TreinoDetalhe } from '../api/tipos';
import { ORIGEM_API } from '../api/config';
import { ErroApi } from '../api/cliente';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { Aviso, DangerButton, GhostButton, OutlineButton, ScreenHeader } from '../components/ui';
import { IconAlert, IconPulse } from '../components/Icons';
import { CornerWatermark } from '../components/Watermark';
import { useBle } from '../ble/BleContext';
import type { Comando, EstadoDispositivo } from '../ble/protocolo';
import { useAuth } from '../auth/AuthContext';
import { armazenamentoApp } from '../armazenamento/aparelho';
import { chaveDispositivoDaConta } from './PareamentoScreen';
import { GolpeRegistrado, LIMIAR_RESISTENCIA, Lado, ladoEsperado, mmss, resumirSessao, sequenciaEsperada } from '../sessao/regras';
import { publicoDaSessao, textos } from '../sessao/linguagem';
import { SessaoRemota } from '../sessao/sessaoRemota';
import { sessaoAtiva } from '../sessao/sessaoAtiva';
import { gerarUuid } from '../util/uuid';

type Props = NativeStackScreenProps<RootStackParamList, 'Sessao'>;

type Fase = 'preparando' | 'iniciando' | 'rodando' | 'pausado' | 'parado';
type Pendente = 'iniciar' | 'pausar' | 'retomar' | 'parar' | 'encerrar' | null;

const MOTIVOS = ['Pessoa ou bola na área da máquina', 'Dor ou desconforto', 'Problema na máquina ou na raquete', 'Outro motivo'];
const INTERVALO_ENVIO_MS = 2000;

export function SessaoScreen({ navigation, route }: Props) {
  const { slug, demo } = route.params;
  const auth = useAuth();
  const ble = useBle();
  const { enviarEAguardar, enviar, aoReceberGolpe } = ble;
  const sensorAtivo = !demo && ble.disponivel && ble.status === 'conectado';
  // Decide uma vez, na entrada da tela: sessão com sensor real ou demonstração.
  const [usouSensor] = useState(sensorAtivo);

  const [treino, setTreino] = useState<TreinoDetalhe | null>(null);
  const [erroPreparo, setErroPreparo] = useState<string | null>(null);
  const [modo, setModo] = useState<'online' | 'offline'>('online');
  const [golpes, setGolpes] = useState<GolpeRegistrado[]>([]);
  const [tempoSeg, setTempoSeg] = useState(0);
  const [fase, setFase] = useState<Fase>('preparando');
  const [pendente, setPendente] = useState<Pendente>(null);
  const [erroCmd, setErroCmd] = useState<string | null>(null);
  const [sheetAberto, setSheetAberto] = useState(false);
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [lancamento, setLancamento] = useState<Lancamento | null>(null);
  const [maquinaConcluida, setMaquinaConcluida] = useState(false);

  const remota = useRef<SessaoRemota | null>(null);
  const socket = useRef<Socket | null>(null);
  const faseRef = useRef(fase);
  faseRef.current = fase;
  const tempoRef = useRef(tempoSeg);
  tempoRef.current = tempoSeg;
  const seqDemo = useRef(0);
  const golpesRef = useRef<GolpeRegistrado[]>([]);

  const conteudo = treino?.conteudo;
  const sequencia = useMemo(() => (conteudo ? sequenciaEsperada(conteudo) : ['Forehand' as Lado]), [conteudo]);
  const resumo = useMemo(() => resumirSessao(golpes, tempoSeg, conteudo?.pontuacao), [golpes, tempoSeg, conteudo]);
  const proximoEsperado = ladoEsperado(sequencia, golpes.length);
  const publico = publicoDaSessao(auth.praticanteAtivo, conteudo?.modoPublico ?? 'ADULTO');
  const t = textos(publico);

  // 1) Treino (API ou cópia offline) e sessão na API (ou offline).
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const r = await auth.repositorio.treino(slug);
        if (!r) throw new Error('Sem conexão e este treino ainda não foi baixado neste aparelho.');
        if (!auth.praticanteAtivo) throw new Error('Escolha um praticante no Perfil antes de treinar.');
        const dispositivoId = usouSensor && ble.idDispositivo ? ((await armazenamentoApp.ler(chaveDispositivoDaConta(ble.idDispositivo))) ?? undefined) : undefined;
        const s = new SessaoRemota(auth.api, auth.fila, {
          id: gerarUuid(),
          praticanteId: auth.praticanteAtivo.id,
          treinoSlug: slug,
          versaoNumero: r.treino.numero,
          dispositivoId,
          origem: usouSensor ? 'SENSOR' : 'DEMO'
        });
        await s.preparar();
        if (cancelado) return;
        remota.current = s;
        setTreino(r.treino);
        setModo(s.modo);
        setFase('iniciando');
      } catch (e) {
        if (!cancelado) setErroPreparo(e instanceof ErroApi ? e.message : (e as Error).message);
      }
    })();
    return () => {
      cancelado = true;
    };
    // Prepara uma única vez por entrada na tela.
  }, []);

  // 2) Simulador da máquina em tempo real (RF09): só com a sessão online.
  useEffect(() => {
    const s = remota.current;
    if (!treino || !s || s.modo !== 'online') return;
    const sock = io(`${ORIGEM_API}/maquina`, { auth: { token: auth.tokenAcesso() }, transports: ['websocket'] });
    sock.on('connect', () => sock.emit('entrar', { sessaoId: s.id }));
    sock.on('lancamento', (l: Lancamento) => setLancamento(l));
    sock.on('estado', (e: { maquina?: string }) => e.maquina === 'CONCLUIDA' && setMaquinaConcluida(true));
    socket.current = sock;
    return () => {
      sock.disconnect();
      socket.current = null;
    };
  }, [treino, auth]);

  // 3) Golpes em lote para a API a cada 2 s; sem rede, a sessão segue offline.
  useEffect(() => {
    if (fase === 'preparando') return;
    const id = setInterval(async () => {
      const s = remota.current;
      if (!s) return;
      await s.enviarPendentes();
      setModo(s.modo);
    }, INTERVALO_ENVIO_MS);
    return () => clearInterval(id);
  }, [fase]);

  useEffect(() => {
    if (fase !== 'rodando') return;
    const id = setInterval(() => setTempoSeg((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [fase]);

  const registrar = useCallback(
    (lado: Lado, forca: 1 | 2 | 3, dados?: { picoG: number; picoGiro: number; seq: number }) => {
      if (faseRef.current !== 'rodando') return;
      // Efeitos fora do setState: em modo estrito o atualizador roda duas vezes e duplicaria o golpe.
      const anteriores = golpesRef.current;
      const esperado = ladoEsperado(sequencia, anteriores.length);
      const ok = lado === esperado;
      // Retorno ao praticante: LED/tom na raquete (RF08) e vibração no celular, alternativa a sinais só visuais ou sonoros.
      if (usouSensor) void enviar(ok ? 'FB:1' : 'FB:0');
      Vibration.vibrate(ok ? 40 : [0, 90, 70, 90]);
      remota.current?.registrarGolpe({
        lado,
        forca,
        picoG: dados?.picoG ?? forca * 3,
        picoGiro: dados?.picoGiro ?? forca * 8,
        seq: dados?.seq ?? (seqDemo.current = (seqDemo.current % 9999) + 1)
      });
      golpesRef.current = [...anteriores, { t: tempoRef.current, lado, esperado, ok, forca }];
      setGolpes(golpesRef.current);
    },
    [sequencia, usouSensor, enviar]
  );

  // Envia um comando à placa e só confirma quando ela responde com o E: esperado.
  const comandarPlaca = useCallback(
    async (cmd: Comando, confirmacao: EstadoDispositivo) => {
      const estado = await enviarEAguardar(cmd);
      if (estado === confirmacao) return true;
      setErroCmd(estado ? `A placa respondeu ${estado} em vez de ${confirmacao}. Tente de novo.` : 'A placa não confirmou o comando. Verifique a conexão.');
      return false;
    },
    [enviarEAguardar]
  );

  const comandarApi = useCallback(async (...args: Parameters<SessaoRemota['comando']>) => {
    const s = remota.current;
    if (!s) return false;
    try {
      await s.comando(...args);
      setModo(s.modo);
      return true;
    } catch (e) {
      setErroCmd(e instanceof ErroApi ? e.message : 'Falha ao registrar o comando.');
      return false;
    }
  }, []);

  const iniciarColeta = useCallback(async () => {
    setPendente('iniciar');
    setErroCmd(null);
    const placaOk = !usouSensor || (await comandarPlaca('START', 'COLETANDO'));
    if (placaOk && (await comandarApi('INICIAR'))) setFase('rodando');
    setPendente(null);
  }, [usouSensor, comandarPlaca, comandarApi]);

  useEffect(() => {
    if (fase !== 'iniciando' || !treino) return;
    void iniciarColeta();
    // Só na primeira vez que a sessão fica pronta.
  }, [treino]);

  useEffect(() => {
    if (!usouSensor) return;
    const parar = aoReceberGolpe((g) => registrar(g.lado, g.forca, g));
    return () => {
      parar();
      if (faseRef.current !== 'parado') void enviar('STOP');
    };
  }, [usouSensor, aoReceberGolpe, registrar, enviar]);

  // A placa volta em AGUARDANDO depois de uma queda: retoma a coleta sozinho.
  const statusAnterior = useRef(ble.status);
  useEffect(() => {
    const antes = statusAnterior.current;
    statusAnterior.current = ble.status;
    if (!usouSensor || ble.status !== 'conectado' || antes === 'conectado') return;
    if (faseRef.current === 'rodando') void comandarPlaca('START', 'COLETANDO');
  }, [ble.status, usouSensor, comandarPlaca]);

  // Volta da Parada segura depois do reinício explícito (área confirmada): retoma.
  useFocusEffect(
    useCallback(() => {
      const ativa = sessaoAtiva.obter();
      if (!ativa?.retomarAoVoltar || ativa.remota !== remota.current) return;
      ativa.retomarAoVoltar = false;
      (async () => {
        setPendente('retomar');
        const placaOk = !usouSensor || (await comandarPlaca('START', 'COLETANDO'));
        if (placaOk && (await comandarApi('RETOMAR'))) setFase('rodando');
        else setFase('pausado');
        setPendente(null);
      })();
    }, [usouSensor, comandarPlaca, comandarApi])
  );

  async function alternarPausa() {
    if (pendente) return;
    setErroCmd(null);
    if (fase === 'rodando') {
      setPendente('pausar');
      const placaOk = !usouSensor || !sensorAtivo || (await comandarPlaca('PAUSE', 'PAUSADO'));
      if (placaOk && (await comandarApi('PAUSAR'))) setFase('pausado');
    } else {
      setPendente('retomar');
      // Depois de uma reconexão a placa está em AGUARDANDO, não em PAUSADO: aí o certo é START.
      const cmd: Comando = ble.estadoDispositivo === 'PAUSADO' ? 'RESUME' : 'START';
      const placaOk = !usouSensor || !sensorAtivo || (await comandarPlaca(cmd, 'COLETANDO'));
      if (placaOk && (await comandarApi('RETOMAR'))) setFase('rodando');
    }
    setPendente(null);
  }

  function snapshot() {
    if (!remota.current || !treino) return;
    sessaoAtiva.definir({ remota: remota.current, treino, golpes, tempoSeg, usouSensor, publico, retomarAoVoltar: false });
  }

  // RF22: a máquina para primeiro (é dela o risco físico), depois a raquete. O motivo fica registrado.
  async function pararAgora() {
    if (pendente) return;
    setPendente('parar');
    setErroCmd(null);
    const apiOk = await comandarApi('EMERGENCIA', { motivo });
    if (usouSensor && sensorAtivo) await comandarPlaca('STOP', 'PARADO');
    setPendente(null);
    if (!apiOk) return;
    setFase('parado');
    setSheetAberto(false);
    snapshot();
    navigation.navigate('ParadaSegura');
  }

  async function encerrar() {
    const s = remota.current;
    if (pendente || !s || !treino) return;
    setPendente('encerrar');
    setErroCmd(null);
    if (usouSensor && sensorAtivo) await enviarEAguardar('STOP');
    try {
      const final = await s.encerrar({ pontosCliente: resumo.pontos });
      setFase('parado');
      sessaoAtiva.limpar();
      void auth.sincronizar().catch(() => undefined);
      navigation.replace('Resultado', {
        sessao: final.sessao,
        resumoLocal: { ...resumo, treinoSlug: slug, origem: usouSensor ? 'sensor' : 'demo', terminadaEm: Date.now() },
        pendente: final.pendenteSincronizacao,
        treinoNome: treino.nome
      });
    } catch (e) {
      setErroCmd(e instanceof ErroApi ? e.message : 'Não foi possível encerrar. Tente de novo.');
    } finally {
      setPendente(null);
    }
  }

  if (!treino || erroPreparo) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScreenHeader title="Sessão" onBack={() => navigation.goBack()} />
        <View style={{ padding: 20, gap: 12 }}>
          {erroPreparo ? <Aviso texto={erroPreparo} tipo="erro" /> : <ActivityIndicator color={colors.primary} />}
          {!erroPreparo && <Text style={styles.feedVazio}>Preparando a sessão e a máquina…</Text>}
        </View>
      </SafeAreaView>
    );
  }

  const exercicios = treino.conteudo.exercicios;
  let acumulado = 0;
  const serieAtual = Math.max(
    1,
    exercicios.findIndex((e) => (acumulado += e.repeticoes) > golpes.length) + 1 || exercicios.length
  );
  const series = exercicios.map((_, i) => (i < serieAtual - 1 ? colors.primary : i === serieAtual - 1 ? colors.primaryTintBd : colors.border));

  const reconectando = usouSensor && !sensorAtivo && fase !== 'parado';
  const { live, liveCor } =
    fase === 'parado'
      ? { live: 'Encerrada', liveCor: colors.danger }
      : reconectando
        ? { live: 'Sensor reconectando…', liveCor: colors.warning }
        : fase === 'iniciando'
          ? { live: 'Iniciando…', liveCor: colors.warning }
          : fase === 'pausado'
            ? { live: 'Pausado', liveCor: colors.warning }
            : { live: 'Ao vivo', liveCor: colors.primary };

  const precisao = resumo.golpes ? Math.round((resumo.acertos / resumo.golpes) * 100) : null;
  const resistOk = resumo.indiceResistencia >= 70;
  const ultimo = golpes[golpes.length - 1];
  const recentes = golpes.slice(-4).reverse();
  const rotuloPausa = pendente === 'pausar' ? 'Pausando…' : pendente === 'retomar' ? 'Retomando…' : fase === 'pausado' ? 'Retomar' : 'Pausar';
  const estrelas = t.recompensa(resumo.acertos);

  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <View style={styles.header}>
        <View style={styles.liveRow}>
          <View style={styles.statusLeft}>
            <View style={[styles.liveDot, { backgroundColor: liveCor }]} />
            <Text style={[styles.liveLabel, { color: liveCor }]} accessibilityLiveRegion="polite">
              {live}
            </Text>
          </View>
          <Text style={styles.timer}>{mmss(tempoSeg)}</Text>
        </View>
        <View style={styles.tituloRow}>
          <Text style={styles.subtitulo} numberOfLines={1}>
            {treino.nome}
          </Text>
          <Text style={styles.serie}>
            Série {Math.min(serieAtual, exercicios.length)}/{exercicios.length}
          </Text>
        </View>
        <View style={styles.seriesBar}>
          {series.map((c, i) => (
            <View key={i} style={[styles.serieSeg, { backgroundColor: c }]} />
          ))}
        </View>
      </View>

      {modo === 'offline' && (
        <View style={{ marginHorizontal: 20, marginTop: 10 }}>
          <Aviso texto="Sem conexão: a sessão continua e será enviada quando a internet voltar. A máquina simulada só funciona online." />
        </View>
      )}

      <View style={styles.heroRow}>
        <View>
          <Text style={styles.eyebrow}>Precisão</Text>
          <View style={styles.heroValueRow}>
            <Text style={styles.heroValue}>{precisao ?? '—'}</Text>
            {precisao !== null && <Text style={styles.heroUnit}>%</Text>}
          </View>
          <Text style={styles.heroSub}>
            {resumo.acertos}/{resumo.golpes} golpes{estrelas ? `  ${estrelas}` : ''}
          </Text>
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

      {lancamento && modo === 'online' && (
        <View style={styles.maquinaRow} accessibilityLiveRegion="polite">
          <Text style={styles.maquinaTexto}>
            Máquina · bola {lancamento.seq}: {lancamento.velocidadeKmh} km/h, {lancamento.rotacao.toLowerCase()}, {lancamento.direcao.toLowerCase()} · pede{' '}
            {lancamento.golpeEsperado === 'Forehand' ? 'FH' : 'BH'}
          </Text>
        </View>
      )}
      {maquinaConcluida && <Text style={[styles.maquinaTexto, { marginHorizontal: 20, color: colors.primary }]}>A máquina lançou todas as bolas. Encerre para ver o resultado.</Text>}

      {ultimo ? (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.banner, { backgroundColor: ultimo.ok ? colors.successTintBg : colors.dangerTintBg, borderColor: ultimo.ok ? colors.successTintBd : colors.dangerTintBd }]}
        >
          <View style={{ gap: 4 }}>
            <View style={[styles.led, { backgroundColor: ultimo.ok ? colors.success : colors.border }]} />
            <View style={[styles.led, { backgroundColor: ultimo.ok ? colors.border : colors.danger }]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: ultimo.ok ? colors.success : colors.danger }]}>{ultimo.ok ? t.acerto(ultimo.lado) : t.erro(ultimo.esperado)}</Text>
            <Text style={styles.bannerDetail}>
              {t.sequencia(resumo.sequenciaAtual) || t.aguardando(proximoEsperado)}
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Aguardando o primeiro golpe</Text>
            <Text style={styles.bannerDetail}>{t.aguardando(proximoEsperado)}</Text>
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
          {fase === 'iniciando' && <GhostButton label="Tentar de novo" onPress={iniciarColeta} style={{ height: 36 }} />}
        </View>
      )}

      <View style={styles.actionsRow}>
        <OutlineButton label={rotuloPausa} disabled={fase === 'parado' || fase === 'iniciando' || pendente !== null} onPress={alternarPausa} style={{ flex: 1, height: 50 }} />
        <OutlineButton label={pendente === 'encerrar' ? 'Encerrando…' : 'Encerrar'} disabled={fase === 'iniciando' || pendente !== null} onPress={encerrar} style={{ flex: 1, height: 50 }} />
      </View>
      <Pressable onPress={() => setSheetAberto(true)} style={styles.paradaBtn} accessibilityRole="button" accessibilityLabel="Parada de emergência">
        <Text style={styles.paradaLabel}>Parada segura</Text>
      </Pressable>

      {usouSensor ? (
        <Pressable style={styles.demoRow} onLongPress={__DEV__ ? () => navigation.navigate('Debug') : undefined} delayLongPress={700}>
          <View style={[styles.liveDot, { backgroundColor: sensorAtivo ? colors.success : colors.warning }]} />
          <Text style={styles.sensorTexto} numberOfLines={1}>
            {sensorAtivo ? `Sensor ativo · ${ble.nomeDispositivo ?? ''} · v${ble.versaoFirmware ?? '?'}` : 'Sensor fora do ar — reconectando sozinho'}
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
              A máquina para imediatamente, a raquete para de coletar e a sessão fica bloqueada até você confirmar que a área está segura.
            </Text>
            <Text style={[styles.eyebrow, { marginTop: 16 }]}>Motivo</Text>
            <View style={{ gap: 6, marginTop: 8 }}>
              {MOTIVOS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMotivo(m)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: motivo === m }}
                  style={[styles.motivo, motivo === m && { borderColor: colors.danger, backgroundColor: colors.dangerTintBg }]}
                >
                  <Text style={[styles.motivoTexto, motivo === m && { color: colors.text }]}>{m}</Text>
                </Pressable>
              ))}
            </View>
            {erroCmd && <Text style={[styles.erroTexto, { marginTop: 12 }]}>{erroCmd}</Text>}
            <View style={{ gap: 10, marginTop: 18 }}>
              <DangerButton label={pendente === 'parar' ? 'Parando…' : 'Parar agora'} onPress={pararAgora} />
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
  heroRow: { paddingHorizontal: 20, paddingTop: 16, flexDirection: 'row', alignItems: 'flex-end', gap: 18 },
  eyebrow: { fontFamily: fonts.bodyMedium, fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.textSecondary },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 2 },
  heroValue: { fontFamily: fonts.displayBold, fontSize: 70, lineHeight: 72, color: colors.primary },
  heroUnit: { fontFamily: fonts.display, fontSize: 26, color: colors.primary },
  heroSub: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.textTertiary, marginTop: 7 },
  tilesCol: { flex: 1, gap: 8, paddingBottom: 4 },
  tile: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 },
  tileLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textTertiary },
  tileValue: { fontFamily: fonts.displayBold, fontSize: 26, color: colors.text, marginTop: 2 },
  maquinaRow: { marginHorizontal: 20, marginTop: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  maquinaTexto: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary },
  banner: { marginHorizontal: 20, marginTop: 10, borderRadius: 10, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 13 },
  led: { width: 9, height: 9, borderRadius: 4.5 },
  bannerTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  bannerDetail: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textTertiary, marginTop: 3 },
  resistLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textSecondary },
  resistValue: { fontFamily: fonts.displayBold, fontSize: 24 },
  feedSection: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  feedVazio: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textTertiary, paddingVertical: 12 },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.divider },
  feedDot: { width: 7, height: 7, borderRadius: 3.5 },
  feedTipo: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  feedZona: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  feedBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2.5, height: 13 },
  feedBar: { width: 3.5, borderRadius: 1 },
  feedTempo: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.textQuaternary, width: 38, textAlign: 'right' },
  erroRow: { marginHorizontal: 20, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  erroTexto: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.danger },
  actionsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 10 },
  paradaBtn: { marginHorizontal: 20, marginTop: 10, height: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerTintBg, borderWidth: 1, borderColor: 'rgba(239,68,68,0.45)' },
  paradaLabel: { fontFamily: fonts.bodyBold, fontSize: 14, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.danger },
  demoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 10, marginBottom: 16, paddingTop: 10, minHeight: 42, borderTopWidth: 1, borderTopColor: colors.border, borderStyle: 'dashed' },
  demoLabel: { fontFamily: fonts.bodyMedium, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.textQuaternary, width: 54, lineHeight: 12 },
  demoBtn: { flex: 1, height: 42, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  demoBtnLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  sensorTexto: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  sensorProximo: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.primary },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(9,11,9,0.86)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 22, paddingBottom: 30 },
  sheetTitle: { fontFamily: fonts.displayBold, fontSize: 28, color: colors.text, textTransform: 'uppercase', marginTop: 14 },
  sheetBody: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.textSecondary, marginTop: 10 },
  motivo: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 11, paddingHorizontal: 12 },
  motivoTexto: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary }
});

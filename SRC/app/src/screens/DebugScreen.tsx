import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { ScreenHeader } from '../components/ui';
import { Estatisticas, useAmostraAoVivo, useBle } from '../ble/BleContext';
import { Comando, GolpeSensor, interpretarMensagem, magnitude } from '../ble/protocolo';

type Props = NativeStackScreenProps<RootStackParamList, 'Debug'>;

// Mesmos limites do firmware (SRC/arduino/tennis_imu), em rad/s.
const GIRO_INICIO = 8;
const GIRO_PICO_MIN = 12;
const ESCALA_GIRO = 40;
const LINHAS_LOG = 30;

type Linha = { id: number; hora: string; texto: string; valida: boolean };

function horaAgora() {
  const d = new Date();
  return `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

export function DebugScreen({ navigation }: Props) {
  const ble = useBle();
  const { enviar, aoReceberBruto, estatisticas } = ble;
  const amostra = useAmostraAoVivo();
  const [log, setLog] = useState<Linha[]>([]);
  const [ultimoGolpe, setUltimoGolpe] = useState<{ bruto: string; golpe: GolpeSensor } | null>(null);
  const [stats, setStats] = useState<Estatisticas>(estatisticas());
  const [picoGiro, setPicoGiro] = useState(0);
  const proximoId = useRef(0);
  const conectado = ble.status === 'conectado';

  useEffect(() => {
    if (!conectado) return;
    enviar('DBG:1');
    return () => {
      enviar('DBG:0');
    };
  }, [conectado, enviar]);

  useEffect(
    () =>
      aoReceberBruto((texto) => {
        const msg = interpretarMensagem(texto);
        if (msg?.tipo === 'golpe') setUltimoGolpe({ bruto: texto, golpe: msg.golpe });
        // A telemetria chega a 10 Hz e já aparece nos números ao vivo; o log fica para o resto.
        if (msg?.tipo === 'acel' || msg?.tipo === 'giro') return;
        setLog((anterior) =>
          [{ id: proximoId.current++, hora: horaAgora(), texto, valida: msg !== null }, ...anterior].slice(0, LINHAS_LOG)
        );
      }),
    [aoReceberBruto]
  );

  useEffect(() => {
    const id = setInterval(() => setStats(estatisticas()), 500);
    return () => clearInterval(id);
  }, [estatisticas]);

  const giro = amostra ? magnitude(amostra.gx, amostra.gy, amostra.gz) : 0;
  const acel = amostra ? magnitude(amostra.ax, amostra.ay, amostra.az) : 0;

  useEffect(() => {
    if (giro > picoGiro) setPicoGiro(giro);
  }, [giro, picoGiro]);

  const comandos: Comando[] = ['PING', 'START', 'PAUSE', 'RESUME', 'STOP'];

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Diagnóstico do sensor" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.grid}>
          <Celula rotulo="Conexão" valor={ble.status} cor={conectado ? colors.success : colors.warning} />
          <Celula rotulo="Estado da placa" valor={ble.estadoDispositivo ?? '—'} />
          <Celula rotulo="Sensor" valor={ble.erroSensor ? 'ERR:MPU' : 'ok'} cor={ble.erroSensor ? colors.danger : undefined} />
          <Celula rotulo="Último seq" valor={stats.ultimoSeq === null ? '—' : String(stats.ultimoSeq)} />
          <Celula rotulo="Golpes recebidos" valor={String(stats.golpesRecebidos)} />
          <Celula rotulo="Perdidos (lacunas)" valor={String(stats.perdidos)} cor={stats.perdidos ? colors.warning : undefined} />
          <Celula rotulo="Duplicados ignorados" valor={String(stats.duplicados)} />
          <Celula rotulo="Reconexões" valor={String(stats.reconexoes)} />
        </View>
        {ble.erro && <Text style={styles.erro}>{ble.erro}</Text>}

        <Text style={styles.secao}>Último golpe (S:)</Text>
        <View style={styles.card}>
          {ultimoGolpe ? (
            <>
              <Text style={styles.mono}>{ultimoGolpe.bruto}</Text>
              <Text style={styles.detalhe}>
                {ultimoGolpe.golpe.lado} · força {ultimoGolpe.golpe.forca} · pico {ultimoGolpe.golpe.picoG.toFixed(1)} g ·{' '}
                {ultimoGolpe.golpe.picoGiro.toFixed(1)} rad/s · seq {ultimoGolpe.golpe.seq}
              </Text>
            </>
          ) : (
            <Text style={styles.detalhe}>Nenhum golpe ainda. Toque em START e balance a raquete.</Text>
          )}
        </View>

        <Text style={styles.secao}>Ao vivo (DBG:1, 10 Hz)</Text>
        <View style={styles.card}>
          {amostra ? (
            <>
              <Text style={styles.mono}>
                A {amostra.ax.toFixed(1)} {amostra.ay.toFixed(1)} {amostra.az.toFixed(1)} g  |a| {acel.toFixed(2)} g
              </Text>
              <Text style={styles.mono}>
                G {amostra.gx.toFixed(1)} {amostra.gy.toFixed(1)} {amostra.gz.toFixed(1)} rad/s
              </Text>
              <View style={styles.barraTrilho}>
                <View style={[styles.barra, { width: `${Math.min(100, (giro / ESCALA_GIRO) * 100)}%`, backgroundColor: giro >= GIRO_PICO_MIN ? colors.success : giro >= GIRO_INICIO ? colors.warning : colors.textTertiary }]} />
                <View style={[styles.marca, { left: `${(GIRO_INICIO / ESCALA_GIRO) * 100}%` }]} />
                <View style={[styles.marca, { left: `${(GIRO_PICO_MIN / ESCALA_GIRO) * 100}%` }]} />
              </View>
              <Text style={styles.detalhe}>
                |giro| {giro.toFixed(1)} rad/s · pico desde que abriu {picoGiro.toFixed(1)} · marcas: início {GIRO_INICIO}, golpe {GIRO_PICO_MIN}
              </Text>
              <Text style={styles.nota}>A 10 Hz o pico real do swing pode não aparecer aqui; a placa detecta a 100 Hz.</Text>
            </>
          ) : (
            <Text style={styles.detalhe}>{conectado ? 'Aguardando telemetria…' : 'Conecte o sensor no Pareamento.'}</Text>
          )}
        </View>

        <Text style={styles.secao}>Comandos</Text>
        <View style={styles.botoes}>
          {comandos.map((c) => (
            <Pressable key={c} style={[styles.botao, !conectado && { opacity: 0.4 }]} disabled={!conectado} onPress={() => enviar(c)}>
              <Text style={styles.botaoTexto}>{c}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.botao} onPress={() => { setLog([]); setPicoGiro(0); }}>
            <Text style={styles.botaoTexto}>Limpar</Text>
          </Pressable>
        </View>

        <Text style={styles.secao}>Mensagens recebidas</Text>
        <View style={styles.card}>
          {log.length === 0 && <Text style={styles.detalhe}>Nada ainda.</Text>}
          {log.map((l) => (
            <Text key={l.id} style={[styles.mono, styles.linhaLog, !l.valida && { color: colors.danger }]}>
              {l.hora}  {JSON.stringify(l.texto)}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Celula({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <View style={styles.celula}>
      <Text style={styles.celulaRotulo}>{rotulo}</Text>
      <Text style={[styles.celulaValor, cor ? { color: cor } : null]} numberOfLines={1}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 30 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  celula: { width: '48.5%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10 },
  celulaRotulo: { fontFamily: fonts.bodyMedium, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.textTertiary },
  celulaValor: { fontFamily: fonts.mono, fontSize: 14, color: colors.text, marginTop: 4 },
  erro: { marginTop: 10, fontFamily: fonts.body, fontSize: 12, color: colors.danger },
  secao: { fontFamily: fonts.bodyMedium, fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.textSecondary, marginTop: 22, marginBottom: 9 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, gap: 6 },
  mono: { fontFamily: fonts.mono, fontSize: 12, color: colors.text },
  detalhe: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
  nota: { fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.textTertiary },
  barraTrilho: { height: 10, borderRadius: 5, backgroundColor: colors.divider, overflow: 'hidden', marginTop: 4 },
  barra: { height: 10 },
  marca: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.text, opacity: 0.6 },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  botao: { paddingHorizontal: 14, height: 40, borderRadius: 6, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  botaoTexto: { fontFamily: fonts.mono, fontSize: 12, color: colors.text },
  linhaLog: { fontSize: 11 }
});

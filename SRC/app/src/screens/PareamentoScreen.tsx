import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { IconRacket, IconSignal, IconCheck } from '../components/Icons';
import { Aviso, CampoTexto, GhostButton, PrimaryButton, ScreenHeader } from '../components/ui';
import { CornerWatermark } from '../components/Watermark';
import { StatusBle, useBle } from '../ble/BleContext';
import { NOME_DISPOSITIVO, chaveValida } from '../ble/protocolo';
import { useAuth } from '../auth/AuthContext';
import { armazenamentoApp } from '../armazenamento/aparelho';
import { ErroApi } from '../api/cliente';

type Props = NativeStackScreenProps<RootStackParamList, 'Pareamento'>;

type Status = StatusBle;

/** id da raquete na conta (API), guardado por id BLE para a sessão funcionar também offline. */
export const chaveDispositivoDaConta = (idBle: string) => `tennis.dispositivo.${idBle}`;

const LABELS: Record<Status, string> = {
  desconectado: 'Desconectado',
  procurando: 'Procurando…',
  conectando: 'Autenticando…',
  conectado: 'Conectado',
  reconectando: 'Reconectando…'
};

const DESCRICOES: Record<Status, string> = {
  desconectado: 'Ligue o módulo preso ao cabo da raquete e toque em parear.',
  procurando: `Procurando o ${NOME_DISPOSITIVO} por Bluetooth.`,
  conectando: 'Raquete encontrada. Conferindo a chave de segurança dos dois lados.',
  conectado: 'Canal autenticado. LED e buzzer da raquete confirmam cada golpe.',
  reconectando: 'A conexão caiu. Tentando de novo sozinho a cada poucos segundos.'
};

export function PareamentoScreen({ navigation, route }: Props) {
  const ble = useBle();
  const { api, guardarChaveRaquete } = useAuth();
  const [statusDemo, setStatusDemo] = useState<Status>('desconectado');
  const [mostrarCadastro, setMostrarCadastro] = useState(false);
  const [chaveDigitada, setChaveDigitada] = useState('');
  const [cadastrando, setCadastrando] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const real = ble.disponivel;
  const status: Status = real ? ble.status : statusDemo;
  const buscando = status === 'procurando' || status === 'conectando' || status === 'reconectando';
  const conectado = status === 'conectado';

  useEffect(() => {
    if (!buscando) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [buscando, pulse]);

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  // Conectado: cadastra a raquete nova (a chave já foi posta à prova) e reporta o status (RF05).
  useEffect(() => {
    if (!real || !conectado || !ble.idDispositivo || !ble.versaoFirmware) return;
    const idBle = ble.idDispositivo;
    const sensores = { imu: ble.erroSensor ? ('FALHA' as const) : ('OK' as const) };
    (async () => {
      try {
        let d = (await api.dispositivos()).find((x) => x.identificador === idBle);
        if (cadastrando && chaveValida(chaveDigitada)) {
          d = await api.registrarDispositivo({ nomeBle: ble.nomeDispositivo ?? NOME_DISPOSITIVO, identificador: idBle, firmwareVersao: ble.versaoFirmware!, chave: chaveDigitada });
          await guardarChaveRaquete(idBle, chaveDigitada.toUpperCase());
          setMensagem({ texto: 'Raquete cadastrada na sua conta.', tipo: 'ok' });
          setCadastrando(false);
          setMostrarCadastro(false);
          setChaveDigitada('');
        }
        if (!d) return;
        await armazenamentoApp.gravar(chaveDispositivoDaConta(idBle), d.id);
        await api.statusDispositivo(d.id, { conectado: true, sensores, firmwareVersao: ble.versaoFirmware! });
      } catch (e) {
        if (e instanceof ErroApi) setMensagem({ texto: e.message, tipo: 'erro' });
        // Sem rede: segue com a raquete autenticada; o status volta a ser enviado na próxima conexão.
      }
    })();
  }, [real, conectado, ble.idDispositivo, ble.versaoFirmware, ble.erroSensor, ble.nomeDispositivo, api, cadastrando, chaveDigitada, guardarChaveRaquete]);

  const cor = conectado ? colors.success : buscando ? colors.warning : colors.textTertiary;

  function parear() {
    if (status !== 'desconectado') return;
    setMensagem(null);
    if (real) {
      void ble.conectar();
      return;
    }
    setStatusDemo('procurando');
    timer.current = setTimeout(() => setStatusDemo('conectado'), 1500);
  }

  function cadastrar() {
    if (!chaveValida(chaveDigitada)) {
      setMensagem({ texto: 'A chave tem 32 caracteres hexadecimais (0–9, A–F) e não pode ser a de exemplo.', tipo: 'erro' });
      return;
    }
    setMensagem(null);
    setCadastrando(true);
    void ble.conectar(chaveDigitada.toUpperCase());
  }

  function desconectar() {
    if (real) void ble.desconectar();
    else setStatusDemo('desconectado');
  }

  const sensorComFalha = real && ble.erroSensor;

  const itens = [
    { rotulo: 'Canal Bluetooth autenticado', valor: real ? 'HMAC' : 'demo', falha: false },
    { rotulo: 'Firmware da raquete', valor: real ? (ble.versaoFirmware ?? '—') : 'demo', falha: false },
    { rotulo: 'Sensor de movimento (IMU)', valor: sensorComFalha ? 'ERR:MPU' : 'ok', falha: sensorComFalha },
    { rotulo: 'Estado da placa', valor: real ? ble.estadoDispositivo ?? '—' : 'AGUARDANDO', falha: false }
  ];

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const opacity = pulse.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.55, 0.4, 0] });
  const erroBle = real && !conectado ? ble.erro : null;

  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <ScreenHeader title="Etapa 2 de 2" onBack={() => navigation.goBack()} />
      <Text style={styles.title}>Pareamento</Text>

      <ScrollView contentContainerStyle={styles.middle} keyboardShouldPersistTaps="handled">
        <View style={styles.ringWrap}>
          <Animated.View style={[styles.ring, { borderColor: cor, transform: [{ scale }], opacity }]} />
          <View style={styles.ringInner} />
          <View style={[styles.hub, { borderColor: cor }]}>
            <IconRacket size={40} color={cor} strokeWidth={1.5} />
          </View>
        </View>

        <View style={{ alignItems: 'center', gap: 12 }}>
          <View style={[styles.chip, { backgroundColor: conectado ? colors.successTintBg : colors.surface, borderColor: conectado ? colors.successTintBd : colors.border }]}>
            <View style={[styles.dot, { backgroundColor: cor }]} />
            <Text style={[styles.chipLabel, { color: cor }]}>{LABELS[status]}</Text>
          </View>
          <Text accessibilityLiveRegion="polite" style={[styles.descricao, erroBle ? { color: colors.danger } : null]}>
            {erroBle ?? DESCRICOES[status]}
          </Text>
        </View>

        {mensagem && <Aviso texto={mensagem.texto} tipo={mensagem.tipo} />}

        <Pressable
          style={styles.codeCard}
          onLongPress={real && __DEV__ ? () => navigation.navigate('Debug') : undefined}
          delayLongPress={700}
          accessibilityHint={real && __DEV__ ? 'Toque longo abre a tela de diagnóstico do sensor' : undefined}
        >
          <View>
            <Text style={styles.codeLabel}>Dispositivo</Text>
            <Text style={[styles.codeValue, { color: conectado ? colors.text : colors.textQuaternary }]}>
              {conectado ? (real ? ble.nomeDispositivo ?? NOME_DISPOSITIVO : 'Demonstração') : '— — — —'}
            </Text>
          </View>
          <IconSignal color={cor} op1={status === 'desconectado' ? 0.3 : 1} op2={status === 'desconectado' ? 0.3 : buscando ? 0.45 : 1} op3={conectado ? 1 : 0.3} />
        </Pressable>

        <View style={{ width: '100%' }}>
          {itens.map((item) => (
            <View key={item.rotulo} style={styles.checkRow}>
              <View
                style={[
                  styles.checkCircle,
                  item.falha
                    ? { borderColor: colors.danger, backgroundColor: colors.dangerTintBg }
                    : { borderColor: conectado ? colors.success : colors.border, backgroundColor: conectado ? colors.success : 'transparent' }
                ]}
              >
                {conectado && !item.falha && <IconCheck />}
              </View>
              <Text style={[styles.checkLabel, { color: conectado ? colors.text : colors.textTertiary }]}>{item.rotulo}</Text>
              <Text style={[styles.checkValue, item.falha && { color: colors.danger }]}>{conectado ? item.valor : '—'}</Text>
            </View>
          ))}
        </View>

        {real && !conectado && mostrarCadastro && (
          <View style={{ width: '100%', gap: 10 }}>
            <CampoTexto
              rotulo="Chave da raquete (32 caracteres)"
              value={chaveDigitada}
              onChangeText={(t) => setChaveDigitada(t.replace(/\s/g, ''))}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={32}
              placeholder="Etiqueta da raquete / segredo.h"
            />
            <Text style={styles.footerNote}>A chave é conferida com a raquete antes de ser salva. Ela fica cifrada na sua conta e só você a recebe.</Text>
            <PrimaryButton label={buscando ? LABELS[status] : 'Conferir e cadastrar raquete'} disabled={buscando} onPress={cadastrar} />
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {!(real && !conectado && mostrarCadastro) && (
          <PrimaryButton
            label={sensorComFalha && conectado ? 'Sensor com falha (ERR:MPU)' : conectado ? 'Iniciar sessão' : buscando ? LABELS[status] : 'Parear dispositivo'}
            disabled={buscando || (conectado && sensorComFalha)}
            onPress={conectado ? () => navigation.navigate('Sessao', { slug: route.params.slug, demo: !real }) : parear}
          />
        )}
        {(conectado || status === 'reconectando') && (
          <GhostButton label={conectado ? 'Desconectar dispositivo' : 'Parar de tentar'} onPress={desconectar} />
        )}
        {real && !conectado && !buscando && (
          <GhostButton
            label={mostrarCadastro ? 'Voltar' : 'Raquete nova? Cadastrar a chave'}
            onPress={() => {
              setMensagem(null);
              setMostrarCadastro(!mostrarCadastro);
            }}
          />
        )}
        {!conectado && !real && (
          <Text style={styles.footerNote}>Modo demonstração: o Bluetooth real só funciona no app instalado (build), não no Expo Go.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontFamily: fonts.displayBold, fontSize: 34, color: colors.text, textTransform: 'uppercase', paddingHorizontal: 20, marginTop: 14 },
  middle: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 16 },
  ringWrap: { width: 148, height: 148, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 148, height: 148, borderRadius: 74, borderWidth: 1.5 },
  ringInner: { position: 'absolute', width: 108, height: 108, borderRadius: 54, borderWidth: 1, borderColor: colors.border },
  hub: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 30, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipLabel: { fontFamily: fonts.bodyMedium, fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase' },
  descricao: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.textSecondary, textAlign: 'center', maxWidth: 300 },
  codeCard: { width: '100%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeLabel: { fontFamily: fonts.bodyMedium, fontSize: 10.5, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textTertiary },
  codeValue: { marginTop: 7, fontFamily: fonts.mono, fontSize: 20, letterSpacing: 1.5 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 11, paddingHorizontal: 2 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkLabel: { flex: 1, fontFamily: fonts.body, fontSize: 13.5 },
  checkValue: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.textTertiary },
  footer: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 22, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surfaceSunken, gap: 6 },
  footerNote: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.textTertiary, textAlign: 'center' }
});

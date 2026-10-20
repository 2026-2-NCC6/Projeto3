import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { IconRacket, IconSignal, IconCheck } from '../components/Icons';
import { GhostButton, PrimaryButton, ScreenHeader } from '../components/ui';
import { CornerWatermark } from '../components/Watermark';
import { useAmostraAoVivo, useBle } from '../ble/BleContext';
import { NOME_DISPOSITIVO, magnitude } from '../ble/protocolo';

type Props = NativeStackScreenProps<RootStackParamList, 'Pareamento'>;

type Status = 'desconectado' | 'procurando' | 'conectando' | 'conectado';

const LABELS: Record<Status, string> = {
  desconectado: 'Desconectado',
  procurando: 'Procurando…',
  conectando: 'Conectando…',
  conectado: 'Conectado'
};

const DESCRICOES: Record<Status, string> = {
  desconectado: 'Ligue o módulo preso ao cabo da raquete e toque em parear.',
  procurando: `Procurando o ${NOME_DISPOSITIVO} por Bluetooth.`,
  conectando: 'Dispositivo encontrado. Abrindo o canal de dados.',
  conectado: 'Módulo respondendo. Feedback local de LED e buzzer ativo.'
};

export function PareamentoScreen({ navigation, route }: Props) {
  const ble = useBle();
  const amostra = useAmostraAoVivo();
  const [statusDemo, setStatusDemo] = useState<Status>('desconectado');
  const pulse = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const real = ble.disponivel;
  const status: Status = real ? ble.status : statusDemo;
  const buscando = status === 'procurando' || status === 'conectando';
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

  const cor = conectado ? colors.success : buscando ? colors.warning : colors.textTertiary;

  function parear() {
    if (status !== 'desconectado') return;
    if (real) {
      ble.conectar();
      return;
    }
    setStatusDemo('procurando');
    timer.current = setTimeout(() => setStatusDemo('conectado'), 1500);
  }

  function desconectar() {
    if (real) ble.desconectar();
    else setStatusDemo('desconectado');
  }

  const leituraImu = real && conectado
    ? amostra
      ? `${(magnitude(amostra.ax, amostra.ay, amostra.az) / 9.81).toFixed(2)} g`
      : 'aguardando'
    : '10 Hz';

  const itens = [
    { rotulo: 'Sensor de movimento (IMU)', valor: leituraImu },
    { rotulo: 'Detecção de golpe no módulo', valor: '100 Hz' },
    { rotulo: 'Simulador da máquina lançadora', valor: 'pronto' }
  ];

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const opacity = pulse.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.55, 0.4, 0] });

  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <ScreenHeader title="Etapa 2 de 2" onBack={() => navigation.goBack()} />
      <Text style={styles.title}>Pareamento</Text>

      <View style={styles.middle}>
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
          <Text style={[styles.descricao, ble.erro && real && !conectado ? { color: colors.danger } : null]}>
            {ble.erro && real && !conectado ? ble.erro : DESCRICOES[status]}
          </Text>
        </View>

        <View style={styles.codeCard}>
          <View>
            <Text style={styles.codeLabel}>{real ? 'Dispositivo' : 'Código da sessão'}</Text>
            <Text style={[styles.codeValue, { color: conectado ? colors.text : colors.textQuaternary }]}>
              {conectado ? (real ? ble.nomeDispositivo ?? NOME_DISPOSITIVO : 'STA-7K42') : '— — — —'}
            </Text>
          </View>
          <IconSignal color={cor} op1={status === 'desconectado' ? 0.3 : 1} op2={status === 'desconectado' ? 0.3 : buscando ? 0.45 : 1} op3={conectado ? 1 : 0.3} />
        </View>

        <View style={{ width: '100%' }}>
          {itens.map((item) => (
            <View key={item.rotulo} style={styles.checkRow}>
              <View style={[styles.checkCircle, { borderColor: conectado ? colors.success : colors.border, backgroundColor: conectado ? colors.success : 'transparent' }]}>
                {conectado && <IconCheck />}
              </View>
              <Text style={[styles.checkLabel, { color: conectado ? colors.text : colors.textTertiary }]}>{item.rotulo}</Text>
              <Text style={styles.checkValue}>{conectado ? item.valor : '—'}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          label={conectado ? 'Iniciar sessão' : buscando ? `${LABELS[status]}` : 'Parear dispositivo'}
          disabled={buscando}
          onPress={conectado ? () => navigation.navigate('Sessao', route.params) : parear}
        />
        {conectado && <GhostButton label="Desconectar dispositivo" onPress={desconectar} />}
        {!conectado && (
          <Text style={styles.footerNote}>
            {real
              ? `Conexão Bluetooth LE direta com o módulo ${NOME_DISPOSITIVO}.`
              : 'Modo demonstração: o Bluetooth real só funciona no app instalado (build), não no Expo Go.'}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontFamily: fonts.displayBold, fontSize: 34, color: colors.text, textTransform: 'uppercase', paddingHorizontal: 20, marginTop: 14 },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, gap: 16 },
  ringWrap: { width: 148, height: 148, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 148, height: 148, borderRadius: 74, borderWidth: 1.5 },
  ringInner: { position: 'absolute', width: 108, height: 108, borderRadius: 54, borderWidth: 1, borderColor: colors.border },
  hub: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 30, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipLabel: { fontFamily: fonts.bodyMedium, fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase' },
  descricao: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.textSecondary, textAlign: 'center', maxWidth: 280 },
  codeCard: { width: '100%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeLabel: { fontFamily: fonts.bodyMedium, fontSize: 10.5, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textTertiary },
  codeValue: { marginTop: 7, fontFamily: fonts.mono, fontSize: 20, letterSpacing: 1.5 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 2 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkLabel: { flex: 1, fontFamily: fonts.body, fontSize: 13.5 },
  checkValue: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.textTertiary },
  footer: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 26, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surfaceSunken, gap: 10 },
  footerNote: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.textTertiary, textAlign: 'center' }
});

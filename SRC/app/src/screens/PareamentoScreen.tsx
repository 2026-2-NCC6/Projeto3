import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { IconRacket, IconSignal, IconCheck } from '../components/Icons';
import { GhostButton, PrimaryButton, ScreenHeader } from '../components/ui';
import { CornerWatermark } from '../components/Watermark';

type Props = NativeStackScreenProps<RootStackParamList, 'Pareamento'>;

type Status = 'desconectado' | 'procurando' | 'conectado';

const LABELS: Record<Status, string> = {
  desconectado: 'Desconectado',
  procurando: 'Procurando…',
  conectado: 'Conectado'
};

const DESCRICOES: Record<Status, string> = {
  desconectado: 'Ligue o módulo preso ao cabo da raquete e toque em parear.',
  procurando: 'Aguardando o dispositivo anunciar o código na API.',
  conectado: 'Módulo respondendo. Feedback local de LED e buzzer ativo.'
};

const ITENS = [
  { rotulo: 'Sensor de movimento (IMU)', valor: '104 Hz' },
  { rotulo: 'Alvo de contato (piezo)', valor: 'ADC1' },
  { rotulo: 'Simulador da máquina lançadora', valor: 'pronto' }
];

export function PareamentoScreen({ navigation }: Props) {
  const [status, setStatus] = useState<Status>('desconectado');
  const pulse = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (status !== 'procurando') {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [status, pulse]);

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  const conectado = status === 'conectado';
  const cor = conectado ? colors.success : status === 'procurando' ? colors.warning : colors.textTertiary;

  function parear() {
    if (status !== 'desconectado') return;
    setStatus('procurando');
    timer.current = setTimeout(() => setStatus('conectado'), 1500);
  }

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
          <View style={[styles.chip, { backgroundColor: conectado ? 'rgba(34,197,94,0.10)' : colors.surface, borderColor: conectado ? 'rgba(34,197,94,0.35)' : colors.border }]}>
            <View style={[styles.dot, { backgroundColor: cor }]} />
            <Text style={[styles.chipLabel, { color: cor }]}>{LABELS[status]}</Text>
          </View>
          <Text style={styles.descricao}>{DESCRICOES[status]}</Text>
        </View>

        <View style={styles.codeCard}>
          <View>
            <Text style={styles.codeLabel}>Código da sessão</Text>
            <Text style={[styles.codeValue, { color: conectado ? colors.text : colors.textQuaternary }]}>
              {conectado ? 'STA-7K42' : '— — — —'}
            </Text>
          </View>
          <IconSignal color={cor} op1={status === 'desconectado' ? 0.3 : 1} op2={status === 'desconectado' ? 0.3 : status === 'procurando' ? 0.45 : 1} op3={conectado ? 1 : 0.3} />
        </View>

        <View style={{ width: '100%' }}>
          {ITENS.map((item) => (
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
          label={conectado ? 'Iniciar sessão' : status === 'procurando' ? 'Procurando dispositivo…' : 'Parear dispositivo'}
          disabled={status === 'procurando'}
          onPress={conectado ? () => navigation.navigate('Sessao') : parear}
        />
        {conectado && <GhostButton label="Desconectar dispositivo" onPress={() => setStatus('desconectado')} />}
        {!conectado && (
          <Text style={styles.footerNote}>O pareamento é lógico: app e dispositivo se reconhecem pela API através do código da sessão.</Text>
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
  codeValue: { marginTop: 7, fontFamily: fonts.mono, fontSize: 22, letterSpacing: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 2 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkLabel: { flex: 1, fontFamily: fonts.body, fontSize: 13.5 },
  checkValue: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.textTertiary },
  footer: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 26, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surfaceSunken, gap: 10 },
  footerNote: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.textTertiary, textAlign: 'center' }
});

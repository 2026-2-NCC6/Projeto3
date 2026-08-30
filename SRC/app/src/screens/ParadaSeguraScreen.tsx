import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { GhostButton, OutlineButton, PrimaryButton } from '../components/ui';
import { IconAlert, IconCheckCircle, IconChevronRight } from '../components/Icons';
import { CornerWatermark } from '../components/Watermark';

type Props = NativeStackScreenProps<RootStackParamList, 'ParadaSegura'>;

export function ParadaSeguraScreen({ navigation }: Props) {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <View style={styles.hero}>
        <IconAlert />
        <Text style={styles.heroTitle}>Parada segura{'\n'}acionada</Text>
        <Text style={styles.heroBody}>
          A máquina lançadora foi interrompida e o dispositivo entrou em estado <Text style={styles.mono}>PARADO</Text>. Nenhum dado da sessão foi perdido.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.eyebrow}>Estado da sessão</Text>
        <View style={styles.statesRow}>
          <View style={styles.stateChip}>
            <Text style={styles.stateChipLabel}>EXECUTANDO</Text>
          </View>
          <IconChevronRight />
          <View style={[styles.stateChip, { flex: 1.25, borderColor: 'rgba(239,68,68,0.5)', backgroundColor: colors.dangerTintBg }]}>
            <Text style={[styles.stateChipLabel, { color: colors.danger }]}>PARADA_SEGURA</Text>
          </View>
          <IconChevronRight />
          <View style={[styles.stateChip, { flex: 0.85, borderStyle: 'dashed' }]}>
            <Text style={[styles.stateChipLabel, { color: colors.textQuaternary }]}>OCIOSO</Text>
          </View>
        </View>
        <Text style={styles.note}>
          A saída deste estado exige reinício explícito. Retomar direto para <Text style={styles.mono}>EXECUTANDO</Text> não é permitido.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.eyebrow}>Preservado da sessão</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>48</Text>
            <Text style={styles.statLabel}>golpes</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>1.290</Text>
            <Text style={styles.statLabel}>pontos</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>3:04</Text>
            <Text style={styles.statLabel}>decorrido</Text>
          </View>
        </View>
        <View style={styles.syncRow}>
          <IconCheckCircle />
          <Text style={styles.syncText}>Eventos enviados à API — nada pendente na fila local.</Text>
        </View>
      </View>

      <View style={{ flex: 1 }} />

      <View style={styles.footer}>
        {!confirmando ? (
          <View style={{ gap: 10 }}>
            <PrimaryButton label="Reiniciar sessão" onPress={() => setConfirmando(true)} />
            <GhostButton label="Encerrar e ver resultado" onPress={() => navigation.navigate('Resultado')} />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Text style={styles.confirmText}>Confirme que a quadra está livre e o praticante está pronto antes de liberar a máquina.</Text>
            <PrimaryButton label="Confirmar reinício" onPress={() => navigation.popToTop()} />
            <OutlineButton label="Cancelar" onPress={() => setConfirmando(false)} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  hero: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 26, backgroundColor: colors.dangerTintBg, borderBottomWidth: 1, borderBottomColor: 'rgba(239,68,68,0.22)' },
  heroTitle: { fontFamily: fonts.displayBold, fontSize: 36, lineHeight: 37, color: colors.danger, textTransform: 'uppercase', marginTop: 16 },
  heroBody: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.textSecondary, marginTop: 14 },
  mono: { fontFamily: fonts.mono, color: colors.text },
  section: { paddingHorizontal: 22, paddingTop: 24 },
  eyebrow: { fontFamily: fonts.bodyMedium, fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.textSecondary },
  statesRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  stateChip: { flex: 1, height: 34, borderRadius: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  stateChipLabel: { fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 0.5, color: colors.textTertiary },
  note: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 17, color: colors.textTertiary, marginTop: 11 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12 },
  statValue: { fontFamily: fonts.displayBold, fontSize: 26, color: colors.text },
  statLabel: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textTertiary, marginTop: 5 },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12 },
  syncText: { flex: 1, fontFamily: fonts.body, fontSize: 11.5, color: colors.textSecondary },
  footer: { paddingHorizontal: 22, paddingBottom: 30 },
  confirmText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textSecondary, paddingHorizontal: 2 }
});

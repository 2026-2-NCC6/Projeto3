import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { IconBack } from './Icons';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
};

export function PrimaryButton({ label, onPress, disabled, style }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryBtn,
        disabled && styles.disabledBtn,
        pressed && !disabled && { opacity: 0.85 },
        style
      ]}
    >
      <Text style={[styles.primaryBtnLabel, disabled && { color: colors.textTertiary }]}>{label}</Text>
    </Pressable>
  );
}

export function OutlineButton({ label, onPress, disabled, style }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.outlineBtn, pressed && !disabled && { opacity: 0.7 }, style]}
    >
      <Text style={styles.outlineBtnLabel}>{label}</Text>
    </Pressable>
  );
}

export function DangerButton({ label, onPress, style }: ButtonProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.dangerBtn, pressed && { opacity: 0.85 }, style]}>
      <Text style={styles.dangerBtnLabel}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({ label, onPress, style }: ButtonProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.6 }, style]}>
      <Text style={styles.ghostBtnLabel}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}
    >
      <Text style={[styles.pillLabel, { color: active ? colors.primaryInk : colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SegmentTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segment, active && { backgroundColor: colors.surfaceActive }]}>
      <Text style={[styles.segmentLabel, { color: active ? colors.text : colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statRowLabel}>{label}</Text>
      <Text style={styles.statRowValue}>{value}</Text>
    </View>
  );
}

export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={10} style={styles.headerBack}>
        <IconBack />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  );
}

export function CampoTexto({ rotulo, ...props }: TextInputProps & { rotulo: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.campoRotulo}>{rotulo}</Text>
      <TextInput placeholderTextColor={colors.textTertiary} accessibilityLabel={rotulo} {...props} style={[styles.campo, props.style]} />
    </View>
  );
}

/** Caixa de seleção com o texto clicável inteiro (alvo de toque grande, acessível). */
export function Caixa({ marcada, onPress, children }: { marcada: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: marcada }} style={styles.caixaLinha}>
      <View style={[styles.caixa, marcada && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
        {marcada && <Text style={styles.caixaMarca}>✓</Text>}
      </View>
      <Text style={styles.caixaTexto}>{children}</Text>
    </Pressable>
  );
}

export function Aviso({ texto, tipo = 'info' }: { texto: string; tipo?: 'info' | 'erro' | 'ok' }) {
  const cor = tipo === 'erro' ? colors.danger : tipo === 'ok' ? colors.success : colors.warning;
  return (
    <View accessibilityRole="alert" style={[styles.aviso, { borderColor: cor }]}>
      <Text style={[styles.avisoTexto, { color: cor }]}>{texto}</Text>
    </View>
  );
}

export function PageHeader({ eyebrow, title, right }: { eyebrow: string; title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.pageHeader}>
      <Text style={styles.pageHeaderEyebrow}>{eyebrow}</Text>
      <View style={styles.pageHeaderRow}>
        <Text style={styles.pageHeaderTitle}>{title}</Text>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  primaryBtn: {
    height: 54,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryBtnLabel: {
    color: colors.primaryInk,
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.2
  },
  disabledBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  outlineBtn: {
    height: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  outlineBtnLabel: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.bodyMedium
  },
  dangerBtn: {
    height: 54,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dangerBtnLabel: {
    color: colors.dangerInk,
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  ghostBtn: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center'
  },
  ghostBtnLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.body
  },
  pill: {
    height: 44,
    paddingHorizontal: 15,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillInactive: { backgroundColor: colors.surface, borderColor: colors.border },
  pillLabel: { fontSize: 13, fontFamily: fonts.bodyMedium },
  segment: {
    flex: 1,
    height: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  segmentLabel: { fontSize: 12.5, fontFamily: fonts.bodyMedium },
  statRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  statRowLabel: { fontSize: 12, color: colors.textSecondary, fontFamily: fonts.body },
  statRowValue: { fontSize: 22, fontFamily: fonts.displayBold, color: colors.text },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 30
  },
  headerBack: {
    width: 44,
    height: 44,
    marginLeft: -12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    fontSize: 10.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    fontFamily: fonts.bodyMedium
  },
  pageHeader: { paddingTop: 30 },
  pageHeaderEyebrow: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textSecondary
  },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 3
  },
  pageHeaderTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 34,
    color: colors.text,
    textTransform: 'uppercase'
  },
  campoRotulo: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textSecondary
  },
  campo: {
    height: 52,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15
  },
  caixaLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 6 },
  caixa: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1
  },
  caixaMarca: { color: colors.primaryInk, fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 16 },
  caixaTexto: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  aviso: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  avisoTexto: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 }
});

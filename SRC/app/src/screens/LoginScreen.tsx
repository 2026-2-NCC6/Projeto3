import React from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { LogoMark } from '../components/Icons';
import { GhostButton, OutlineButton, PrimaryButton } from '../components/ui';
import { CornerWatermark } from '../components/Watermark';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <View style={styles.content}>
        <View style={styles.brand}>
          <LogoMark />
          <View>
            <Text style={styles.brandLine}>Tennis</Text>
            <Text style={[styles.brandLine, { color: colors.primary }]}>Analytics</Text>
          </View>
          <Text style={styles.tagline}>Treino monitorado por sensor na raquete, com análise da sua performance em tempo real.</Text>
        </View>

        <View style={{ flex: 1, minHeight: 28 }} />

        <View style={styles.fields}>
          <View style={styles.field}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="voce@email.com"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor={colors.textTertiary} secureTextEntry />
          </View>
        </View>

        <View style={{ alignItems: 'flex-end', marginTop: 6 }}>
          <GhostButton label="Esqueci minha senha" onPress={() => {}} style={{ height: 44, paddingHorizontal: 4 }} />
        </View>

        <View style={{ gap: 12, marginTop: 14 }}>
          <PrimaryButton label="Entrar" onPress={() => navigation.replace('MainTabs')} />
          <OutlineButton label="Criar conta" onPress={() => navigation.replace('MainTabs')} />
        </View>

        <Text style={styles.legal}>Dados de treino tratados conforme a LGPD. Cadastro restrito a maiores de 18 anos.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 36, paddingBottom: 24 },
  brand: { gap: 20 },
  brandLine: {
    fontFamily: fonts.displayBold,
    fontSize: 40,
    lineHeight: 42,
    color: colors.text,
    textTransform: 'uppercase'
  },
  tagline: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.textSecondary, maxWidth: 260 },
  fields: { gap: 18 },
  field: { gap: 9 },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textSecondary
  },
  input: {
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
  legal: {
    marginTop: 22,
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 16.5,
    color: colors.textTertiary,
    textAlign: 'center'
  }
});

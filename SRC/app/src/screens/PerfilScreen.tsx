import React, { useState } from 'react';
import { ScrollView, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { DangerButton, GhostButton, PageHeader, StatRow } from '../components/ui';
import { IconShield } from '../components/Icons';
import { CornerWatermark } from '../components/Watermark';
import { PERFIL_DEMO } from '../data/perfilDemo';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Perfil'>,
  NativeStackScreenProps<RootStackParamList>
>;

type NivelId = 'ini' | 'inter' | 'ava';

const NIVEIS: Array<{ id: NivelId; label: string }> = [
  { id: 'ini', label: 'Iniciante' },
  { id: 'inter', label: 'Intermediário' },
  { id: 'ava', label: 'Avançado' }
];

export function PerfilScreen({ navigation }: Props) {
  const [nivel, setNivel] = useState<NivelId>('inter');

  function sair() {
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.reset({
      index: 0,
      routes: [{ name: 'Login' }]
    });
  }

  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader eyebrow="Sua conta" title="Perfil" />

        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLabel}>{PERFIL_DEMO.iniciais}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{PERFIL_DEMO.nome}</Text>
            <Text style={styles.email}>{PERFIL_DEMO.email}</Text>
          </View>
          <GhostButton label="Editar" onPress={() => {}} style={{ height: 36, paddingHorizontal: 8 }} />
        </View>

        <View style={styles.tagRow}>
          <View style={styles.tag}>
            <Text style={styles.tagLabel}>Jogador</Text>
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagLabel}>Adulto</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Nível de treino preferido</Text>
        <View style={styles.nivelRow}>
          {NIVEIS.map((n) => {
            const active = n.id === nivel;
            return (
              <Text
                key={n.id}
                onPress={() => setNivel(n.id)}
                style={[
                  styles.nivelBtn,
                  { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border, color: active ? colors.primaryInk : colors.textSecondary }
                ]}
              >
                {n.label}
              </Text>
            );
          })}
        </View>
        <Text style={styles.note}>
          Define o padrão ao abrir um treino novo. Você ainda pode ajustar o nível por sessão em Preparação.
        </Text>

        <Text style={styles.sectionTitle}>Estatísticas</Text>
        <View style={styles.card}>
          <View style={styles.statRowWrap}>
            <StatRow label="Sessões concluídas" value="41" />
          </View>
          <View style={styles.divider} />
          <View style={styles.statRowWrap}>
            <StatRow label="Tempo total treinado" value="14h 20min" />
          </View>
          <View style={styles.divider} />
          <View style={styles.statRowWrap}>
            <StatRow label="Melhor sequência" value="×9" />
          </View>
          <View style={styles.divider} />
          <View style={styles.statRowWrap}>
            <StatRow label="Precisão média" value="68%" />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Feedback do dispositivo</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>LED</Text>
              <Text style={styles.toggleNote}>Pisca na placa a cada golpe detectado.</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Buzzer</Text>
              <Text style={styles.toggleNote}>Tom mais agudo quanto mais forte o golpe — alternativa a sinal só visual.</Text>
            </View>
          </View>
        </View>
        <Text style={styles.note}>O feedback é decidido na própria placa, sem esperar o celular, e fica sempre ligado.</Text>

        <Text style={styles.sectionTitle}>Privacidade e dados</Text>
        <View style={styles.card}>
          <View style={styles.privacyRow}>
            <IconShield />
            <Text style={styles.privacyText}>
              Dados de treino tratados conforme a LGPD. Cadastro restrito a maiores de 18 anos.
            </Text>
          </View>
        </View>
        <View style={{ gap: 2, marginTop: 4 }}>
          <GhostButton label="Exportar meus dados" onPress={() => {}} />
          <GhostButton label="Política de privacidade" onPress={() => {}} />
        </View>

        <DangerButton label="Sair da conta" onPress={sair} style={{ marginTop: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 30 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 22 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryTintBg, borderWidth: 1, borderColor: colors.primaryTintBd, alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.primary },
  name: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.text },
  email: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textTertiary, marginTop: 3 },
  tagRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  tag: { paddingHorizontal: 12, height: 28, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  tagLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textSecondary },
  sectionTitle: { fontFamily: fonts.bodyMedium, fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.textSecondary, marginTop: 28, marginBottom: 11 },
  nivelRow: { flexDirection: 'row', gap: 8 },
  nivelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontFamily: fonts.bodyMedium,
    fontSize: 13
  },
  note: { marginTop: 10, fontFamily: fonts.body, fontSize: 11, lineHeight: 16.5, color: colors.textTertiary },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 16 },
  statRowWrap: { paddingVertical: 13 },
  divider: { height: 1, backgroundColor: colors.divider },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  toggleLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  toggleNote: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16.5, color: colors.textTertiary, marginTop: 4 },
  privacyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 16 },
  privacyText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18.5, color: colors.textSecondary }
});

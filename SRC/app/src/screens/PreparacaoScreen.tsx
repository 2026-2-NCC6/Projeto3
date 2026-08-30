import React, { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { PrimaryButton, ScreenHeader } from '../components/ui';
import { CornerWatermark } from '../components/Watermark';

type Props = NativeStackScreenProps<RootStackParamList, 'Preparacao'>;

type NivelId = 'ini' | 'inter' | 'ava';

const NIVEIS: Array<{ id: NivelId; label: string }> = [
  { id: 'ini', label: 'Iniciante' },
  { id: 'inter', label: 'Intermediário' },
  { id: 'ava', label: 'Avançado' }
];

const TABELA: Record<NivelId, {
  intervalo: string; velocidade: string; raio: string; meta: string; bonus: string; limiarResist: string; bolas: number; duracao: string;
}> = {
  ini: { intervalo: '6–8 s', velocidade: 'baixa', raio: 'grande', meta: '40%', bonus: 'a partir de 3', limiarResist: '55%', bolas: 90, duracao: '22 min' },
  inter: { intervalo: '4–5 s', velocidade: 'média', raio: 'médio', meta: '60%', bonus: 'a partir de 5', limiarResist: '65%', bolas: 114, duracao: '18 min' },
  ava: { intervalo: '2–3 s', velocidade: 'alta', raio: 'pequeno', meta: '75%', bonus: 'a partir de 8', limiarResist: '75%', bolas: 140, duracao: '15 min' }
};

const EXERCICIOS_BASE = [
  { nome: 'Aquecimento cruzado', detalhe: 'Forehand, ritmo livre' },
  { nome: 'Forehand paralelo', detalhe: 'Zona 1, alvo fixo' },
  { nome: 'Alternância FH/BH', detalhe: 'Zonas 1 e 2 alternadas' },
  { nome: 'Série final sob pressão', detalhe: 'Intervalo reduzido em 20%' }
];
const PESOS = [0.18, 0.26, 0.35, 0.21];

export function PreparacaoScreen({ navigation }: Props) {
  const [nivel, setNivel] = useState<NivelId>('inter');
  const t = TABELA[nivel];

  const linhas = useMemo(
    () => [
      ['Intervalo entre lançamentos', t.intervalo],
      ['Velocidade da bola', t.velocidade],
      ['Raio da zona-alvo', t.raio],
      ['Tolerância golpe–lançamento', nivel === 'ini' ? 'ampla' : nivel === 'inter' ? 'média' : 'estreita'],
      ['Meta de acerto da série', t.meta],
      ['Bônus por sequência', t.bonus],
      ['Limiar de queda de resistência', t.limiarResist]
    ],
    [nivel, t]
  );

  const exercicios = useMemo(() => {
    let atribuidas = 0;
    return EXERCICIOS_BASE.map((e, i) => {
      const ultimo = i === EXERCICIOS_BASE.length - 1;
      const qtd = ultimo ? t.bolas - atribuidas : Math.round(t.bolas * PESOS[i]);
      if (!ultimo) atribuidas += qtd;
      return { ...e, n: i + 1, bolas: qtd };
    });
  }, [t]);

  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <ScreenHeader title="Preparação da sessão" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Cruzado de fundo{'\n'}consistência</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Téc. R. Almeida</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaMono}>v3 · publicado</Text>
        </View>

        <Text style={styles.eyebrow}>Nível de dificuldade</Text>
        <View style={styles.nivelRow}>
          {NIVEIS.map((n) => {
            const active = n.id === nivel;
            return (
              <Pressable
                key={n.id}
                onPress={() => setNivel(n.id)}
                style={[styles.nivelBtn, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
              >
                <Text style={[styles.nivelLabel, { color: active ? colors.primaryInk : colors.textSecondary }]}>{n.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.paramsCard}>
          {linhas.map(([rotulo, valor], i) => (
            <View key={rotulo} style={[styles.paramRow, i < linhas.length - 1 && styles.paramRowBorder]}>
              <Text style={styles.paramLabel}>{rotulo}</Text>
              <Text style={styles.paramValue}>{valor}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.note}>Parâmetros aplicados ao motor de pontuação e ao simulador da máquina lançadora.</Text>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.eyebrow}>Sequência de exercícios</Text>
          <Text style={styles.totalBolas}>{t.bolas} bolas</Text>
        </View>

        <View style={{ gap: 8 }}>
          {exercicios.map((e) => (
            <View key={e.n} style={styles.exercicioRow}>
              <View style={styles.exercicioIndex}>
                <Text style={styles.exercicioIndexLabel}>{e.n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.exercicioNome}>{e.nome}</Text>
                <Text style={styles.exercicioDetalhe}>{e.detalhe}</Text>
              </View>
              <Text style={styles.exercicioBolas}>{e.bolas} bolas</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.durationRow}>
          <Text style={styles.durationLabel}>Duração estimada</Text>
          <Text style={styles.durationValue}>{t.duracao}</Text>
        </View>
        <PrimaryButton label="Continuar para pareamento" onPress={() => navigation.navigate('Pareamento')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  title: { fontFamily: fonts.displayBold, fontSize: 34, lineHeight: 35, color: colors.text, textTransform: 'uppercase' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  metaText: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  metaDot: { color: colors.textQuaternary },
  metaMono: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.5, color: colors.textSecondary },
  eyebrow: { fontFamily: fonts.bodyMedium, fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.textSecondary, marginTop: 26 },
  nivelRow: { flexDirection: 'row', gap: 8, marginTop: 11 },
  nivelBtn: { flex: 1, height: 46, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  nivelLabel: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  paramsCard: { marginTop: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 16 },
  paramRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 14 },
  paramRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  paramLabel: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 17.5, color: colors.textSecondary },
  paramValue: { fontFamily: fonts.mono, fontSize: 14, color: colors.text },
  note: { marginTop: 10, fontFamily: fonts.body, fontSize: 11, lineHeight: 16.5, color: colors.textTertiary },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 28, marginBottom: 12 },
  totalBolas: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textTertiary },
  exercicioRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14 },
  exercicioIndex: { width: 26, height: 26, borderRadius: 6, backgroundColor: colors.divider, alignItems: 'center', justifyContent: 'center' },
  exercicioIndexLabel: { fontFamily: fonts.mono, fontSize: 12, fontWeight: '700', color: colors.primary },
  exercicioNome: { fontFamily: fonts.body, fontSize: 14, color: colors.text },
  exercicioDetalhe: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textTertiary, marginTop: 4 },
  exercicioBolas: { fontFamily: fonts.mono, fontSize: 13, color: colors.textSecondary },
  footer: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 26, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surfaceSunken },
  durationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  durationLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  durationValue: { fontFamily: fonts.mono, fontSize: 15, color: colors.text }
});

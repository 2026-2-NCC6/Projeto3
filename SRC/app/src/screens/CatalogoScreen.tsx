import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { PageHeader, Pill } from '../components/ui';
import { CornerWatermark } from '../components/Watermark';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Treinos'>,
  NativeStackScreenProps<RootStackParamList>
>;

type Nivel = 'Iniciante' | 'Intermediário' | 'Avançado';

type Treino = {
  nome: string;
  autor: string;
  min: number;
  ex: number;
  nivel: Nivel;
  versao: string;
  peso: 1 | 2 | 3;
};

const TREINOS: Treino[] = [
  { nome: 'Cruzado de fundo — consistência', autor: 'Téc. R. Almeida', min: 18, ex: 4, nivel: 'Intermediário', versao: 'v3', peso: 2 },
  { nome: 'Aquecimento progressivo', autor: 'Téc. M. Sato', min: 12, ex: 3, nivel: 'Iniciante', versao: 'v2', peso: 1 },
  { nome: 'Alternância FH/BH sob pressão', autor: 'Téc. R. Almeida', min: 22, ex: 5, nivel: 'Avançado', versao: 'v1', peso: 3 },
  { nome: 'Precisão em zona curta', autor: 'Téc. L. Ferraz', min: 15, ex: 4, nivel: 'Intermediário', versao: 'v4', peso: 2 },
  { nome: 'Ritmo constante — 6 s entre bolas', autor: 'Téc. M. Sato', min: 20, ex: 3, nivel: 'Iniciante', versao: 'v1', peso: 1 },
  { nome: 'Topspin cruzado em série longa', autor: 'Téc. L. Ferraz', min: 25, ex: 6, nivel: 'Avançado', versao: 'v2', peso: 3 }
];

const FILTROS: Array<'Todos' | Nivel> = ['Todos', 'Iniciante', 'Intermediário', 'Avançado'];

export function CatalogoScreen({ navigation }: Props) {
  const [nivel, setNivel] = useState<'Todos' | Nivel>('Todos');

  const itens = useMemo(
    () => TREINOS.filter((t) => nivel === 'Todos' || t.nivel === nivel),
    [nivel]
  );

  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <View style={styles.headerBlock}>
        <PageHeader eyebrow="Treinos publicados" title="Catálogo" right={<Text style={styles.total}>{itens.length} treinos</Text>} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {FILTROS.map((f) => (
          <Pill key={f} label={f} active={nivel === f} onPress={() => setNivel(f)} />
        ))}
      </ScrollView>

      <FlatList
        data={itens}
        keyExtractor={(item) => item.nome}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Nenhum treino publicado neste nível ainda.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => navigation.navigate('Preparacao')}>
            <View style={styles.cardTop}>
              <Text style={styles.cardName}>{item.nome}</Text>
              <View style={styles.weightBars}>
                <View style={[styles.bar, { height: 6, backgroundColor: colors.primary }]} />
                <View style={[styles.bar, { height: 10, backgroundColor: item.peso >= 2 ? colors.primary : colors.borderStrong }]} />
                <View style={[styles.bar, { height: 14, backgroundColor: item.peso >= 3 ? colors.primary : colors.borderStrong }]} />
              </View>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{item.nivel}</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>{item.min} min</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>{item.ex} exercícios</Text>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.author}>{item.autor}</Text>
              <Text style={styles.version}>{item.versao}</Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headerBlock: { paddingHorizontal: 20 },
  total: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  chipRow: { gap: 8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  list: { paddingHorizontal: 20, paddingBottom: 16, gap: 10 },
  empty: { paddingVertical: 40, textAlign: 'center', color: colors.textTertiary, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  cardName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 19, color: colors.text },
  weightBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2.5, height: 14, paddingTop: 3 },
  bar: { width: 3.5, borderRadius: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 11 },
  metaText: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  metaDot: { color: colors.textQuaternary },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider
  },
  author: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textTertiary },
  version: { fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 0.5, color: colors.textSecondary }
});

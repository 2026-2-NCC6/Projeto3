import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, type CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import type { Nivel, TreinoResumo } from '../api/tipos';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { Aviso, PageHeader, Pill } from '../components/ui';
import { CornerWatermark } from '../components/Watermark';
import { useAuth } from '../auth/AuthContext';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Treinos'>,
  NativeStackScreenProps<RootStackParamList>
>;

export const NOME_NIVEL: Record<Nivel, string> = { INICIANTE: 'Iniciante', INTERMEDIARIO: 'Intermediário', AVANCADO: 'Avançado' };
const PESO: Record<Nivel, number> = { INICIANTE: 1, INTERMEDIARIO: 2, AVANCADO: 3 };
const NIVEIS: Array<'Todos' | Nivel> = ['Todos', 'INICIANTE', 'INTERMEDIARIO', 'AVANCADO'];
const DURACOES = [
  { rotulo: 'Qualquer duração', max: Infinity },
  { rotulo: 'Até 15 min', max: 15 },
  { rotulo: 'Até 25 min', max: 25 }
];
const SENSORES = ['Qualquer sensor', 'IMU', 'PIEZO'];

export function CatalogoScreen({ navigation }: Props) {
  const { repositorio, praticanteAtivo } = useAuth();
  const [treinos, setTreinos] = useState<TreinoResumo[]>([]);
  const [origem, setOrigem] = useState<'api' | 'cache' | 'indisponivel' | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [nivel, setNivel] = useState<'Todos' | Nivel>('Todos');
  const [duracao, setDuracao] = useState(0);
  const [sensor, setSensor] = useState(0);
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await repositorio.catalogo();
      setTreinos(r.treinos);
      setOrigem(r.origem);
    } finally {
      setCarregando(false);
    }
  }, [repositorio]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  const dependente = praticanteAtivo?.tipo === 'DEPENDENTE';
  const itens = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return treinos.filter(
      (t) =>
        (!dependente || t.modoPublico !== 'ADULTO') &&
        (nivel === 'Todos' || t.nivel === nivel) &&
        t.duracaoMin <= DURACOES[duracao].max &&
        (sensor === 0 || t.sensores.includes(SENSORES[sensor])) &&
        (!termo || [t.nome, t.objetivo, t.publicoAlvo].some((c) => c.toLowerCase().includes(termo)))
    );
  }, [treinos, dependente, nivel, duracao, sensor, busca]);

  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <View style={styles.headerBlock}>
        <PageHeader eyebrow="Treinos publicados" title="Catálogo" right={<Text style={styles.total}>{itens.length} treinos</Text>} />
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar por objetivo, público ou nome"
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Buscar treinos por objetivo, público ou nome"
          style={styles.busca}
        />
        {dependente && <Text style={styles.nota}>Mostrando treinos para {praticanteAtivo?.apelido}: infantis e para todos os públicos.</Text>}
        {origem === 'cache' && <Aviso texto="Sem conexão: mostrando os treinos baixados da última vez." />}
        {origem === 'indisponivel' && <Aviso texto="Sem conexão e nenhum treino baixado ainda." tipo="erro" />}
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {NIVEIS.map((n) => (
            <Pill key={n} label={n === 'Todos' ? 'Todos os níveis' : NOME_NIVEL[n]} active={nivel === n} onPress={() => setNivel(n)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, { paddingTop: 0 }]}>
          {DURACOES.map((d, i) => (
            <Pill key={d.rotulo} label={d.rotulo} active={duracao === i} onPress={() => setDuracao(i)} />
          ))}
          {SENSORES.map((s, i) => (
            <Pill key={s} label={s} active={sensor === i} onPress={() => setSensor(i)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={itens}
        keyExtractor={(item) => item.slug}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} tintColor={colors.primary} />}
        ListEmptyComponent={
          carregando ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : <Text style={styles.empty}>Nenhum treino com estes filtros.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            accessibilityRole="button"
            accessibilityLabel={`${item.nome}, ${NOME_NIVEL[item.nivel]}, ${item.duracaoMin} minutos`}
            onPress={() => navigation.navigate('Preparacao', { slug: item.slug })}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardName}>{item.nome}</Text>
              <View style={styles.weightBars}>
                {[1, 2, 3].map((p) => (
                  <View key={p} style={[styles.bar, { height: 2 + p * 4, backgroundColor: PESO[item.nivel] >= p ? colors.primary : colors.borderStrong }]} />
                ))}
              </View>
            </View>
            <Text style={styles.objetivo}>{item.objetivo}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{NOME_NIVEL[item.nivel]}</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>{item.duracaoMin} min</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>{item.publicoAlvo}</Text>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.author}>
                {item.autor}
                {item.origem === 'PLATAFORMA_MAE' ? ' · SmartTennis' : ''}
              </Text>
              <Text style={styles.version}>
                v{item.versao} · {item.sensores.join('+')}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headerBlock: { paddingHorizontal: 20, gap: 10 },
  total: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  busca: {
    height: 46,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    marginTop: 6
  },
  nota: { fontFamily: fonts.body, fontSize: 12, color: colors.primary },
  chipRow: { gap: 8, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  list: { paddingHorizontal: 20, paddingBottom: 16, gap: 10 },
  empty: { paddingVertical: 40, textAlign: 'center', color: colors.textTertiary, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  cardName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 19, color: colors.text },
  objetivo: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary, marginTop: 6 },
  weightBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2.5, height: 14, paddingTop: 3 },
  bar: { width: 3.5, borderRadius: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9, flexWrap: 'wrap' },
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

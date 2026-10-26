import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Exercicio, TreinoDetalhe } from '../api/tipos';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { Aviso, GhostButton, PrimaryButton, ScreenHeader } from '../components/ui';
import { CornerWatermark } from '../components/Watermark';
import { TutorialAnimacao } from '../components/TutorialAnimacao';
import { useAuth } from '../auth/AuthContext';
import { NOME_NIVEL } from './CatalogoScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Preparacao'>;

const GOLPE: Record<Exercicio['golpeEsperado'], string> = { FH: 'Forehand', BH: 'Backhand', ALTERNADO: 'FH/BH alternados' };
const ROTACAO = { TOPSPIN: 'topspin', SLICE: 'slice', PLANO: 'plana' } as const;
const DIRECAO = { ESQ: 'esquerda', CENTRO: 'centro', DIR: 'direita' } as const;
const MODO = { INFANTIL: 'Infantil', ADULTO: 'Adultos', TODOS: 'Todos os públicos' } as const;

export function PreparacaoScreen({ navigation, route }: Props) {
  const { repositorio, praticanteAtivo } = useAuth();
  const [treino, setTreino] = useState<TreinoDetalhe | null>(null);
  const [origem, setOrigem] = useState<'api' | 'cache' | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    repositorio
      .treino(route.params.slug)
      .then((r) => {
        if (!r) setErro('Sem conexão e este treino ainda não foi baixado neste aparelho.');
        else {
          setTreino(r.treino);
          setOrigem(r.origem);
        }
      })
      .catch((e: Error) => setErro(e.message));
  }, [repositorio, route.params.slug]);

  if (!treino) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScreenHeader title="Preparação da sessão" onBack={() => navigation.goBack()} />
        <View style={{ padding: 20 }}>{erro ? <Aviso texto={erro} tipo="erro" /> : <ActivityIndicator color={colors.primary} />}</View>
      </SafeAreaView>
    );
  }

  const c = treino.conteudo;
  const p = c.pontuacao;
  const totalBolas = c.exercicios.reduce((a, e) => a + e.repeticoes, 0);
  const bloqueadoParaPerfil = praticanteAtivo?.tipo === 'DEPENDENTE' && c.modoPublico === 'ADULTO';
  const regras: [string, string][] = [
    ['Pontos por acerto', String(p.base)],
    ['Bônus por golpe na sequência', `+${p.bonusSequencia} × sequência`],
    ['Bônus por golpe forte', `+${p.bonusForte}`],
    ['Penalidade por erro', p.penalidadeErro ? `−${p.penalidadeErro}` : 'nenhuma'],
    ['Meta de precisão', `${p.metaPrecisao}%`],
    ['Conclusão', c.conclusao.tipo === 'REPETICOES' ? `${c.conclusao.valor} bolas` : `${c.conclusao.valor} min`]
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <ScreenHeader title="Preparação da sessão" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{treino.nome.replace(' — ', '\n')}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{treino.autor}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaMono}>v{treino.numero} · publicado</Text>
        </View>
        {origem === 'cache' && (
          <View style={{ marginTop: 12 }}>
            <Aviso texto="Sem conexão: versão baixada neste aparelho. O resultado será enviado quando a conexão voltar." />
          </View>
        )}

        <View style={styles.tags}>
          {[NOME_NIVEL[c.nivel], `${c.duracaoMin} min`, MODO[c.modoPublico], c.objetivo].map((t) => (
            <View key={t} style={styles.tag}>
              <Text style={styles.tagTexto}>{t}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.publico}>Para: {c.publicoAlvo}</Text>

        <Text style={[styles.eyebrow, { marginBottom: 11 }]}>Como fazer</Text>
        {c.tutorial && c.tutorial.golpes.length > 0 && <TutorialAnimacao key={treino.slug} tutorial={c.tutorial} />}
        <View style={styles.passos}>
          {c.instrucoes.map((passo, i) => (
            <View key={passo} style={styles.passoRow}>
              <Text style={styles.passoNum}>{i + 1}</Text>
              <Text style={styles.passoTexto}>{passo}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.eyebrow}>Riscos e cuidados</Text>
        <View style={[styles.card, { borderColor: colors.dangerTintBd, backgroundColor: colors.dangerTintBg }]}>
          {c.riscos.map((r) => (
            <Text key={r} style={styles.linha}>
              • {r}
            </Text>
          ))}
        </View>

        <Text style={styles.eyebrow}>Equipamentos</Text>
        <View style={styles.card}>
          {c.equipamentos.map((e) => (
            <Text key={e} style={styles.linha}>
              • {e}
            </Text>
          ))}
          <Text style={[styles.linha, { color: colors.textTertiary }]}>Sensores necessários: {c.sensores.join(', ')}</Text>
        </View>

        <Text style={styles.eyebrow}>Regras de pontuação</Text>
        <View style={styles.paramsCard}>
          {regras.map(([rotulo, valor], i) => (
            <View key={rotulo} style={[styles.paramRow, i < regras.length - 1 && styles.paramRowBorder]}>
              <Text style={styles.paramLabel}>{rotulo}</Text>
              <Text style={styles.paramValue}>{valor}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.note}>
          Acerto é o golpe no lado que a bola pede{c.sensores.includes('PIEZO') ? ', confirmado pelo alvo' : ''}. Feedback: {c.feedbacks.acerto}.
        </Text>

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.eyebrow, { marginTop: 0 }]}>Sequência de exercícios</Text>
          <Text style={styles.totalBolas}>{totalBolas} bolas</Text>
        </View>
        <View style={{ gap: 8 }}>
          {c.exercicios.map((e, i) => (
            <View key={`${e.nome}-${i}`} style={styles.exercicioRow}>
              <View style={styles.exercicioIndex}>
                <Text style={styles.exercicioIndexLabel}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.exercicioNome}>
                  {e.nome} · {GOLPE[e.golpeEsperado]}
                </Text>
                <Text style={styles.exercicioDetalhe}>
                  {e.lancamento.velocidadeKmh} km/h · bola {ROTACAO[e.lancamento.rotacao]} · {DIRECAO[e.lancamento.direcao]} · {e.lancamento.alturaM} m · a cada{' '}
                  {e.lancamento.intervaloSeg} s
                </Text>
              </View>
              <Text style={styles.exercicioBolas}>{e.repeticoes}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.note}>Parâmetros enviados ao simulador da máquina lançadora, com os limites de segurança aplicados pelo servidor.</Text>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.durationRow}>
          <Text style={styles.durationLabel}>Duração estimada</Text>
          <Text style={styles.durationValue}>{c.duracaoMin} min</Text>
        </View>
        {bloqueadoParaPerfil ? (
          <Aviso texto={`Este treino é para adultos e não está disponível para ${praticanteAtivo?.apelido}.`} tipo="erro" />
        ) : (
          <>
            <PrimaryButton label="Continuar para pareamento" onPress={() => navigation.navigate('Pareamento', { slug: treino.slug })} />
            <GhostButton label="Treinar sem sensor (demonstração)" onPress={() => navigation.navigate('Sessao', { slug: treino.slug, demo: true })} />
          </>
        )}
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
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  tag: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tagTexto: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textSecondary },
  publico: { fontFamily: fonts.body, fontSize: 12, color: colors.textTertiary, marginTop: 10 },
  eyebrow: { fontFamily: fonts.bodyMedium, fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.textSecondary, marginTop: 26 },
  passos: { marginTop: 14, gap: 10 },
  passoRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  passoNum: { width: 20, height: 20, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.primaryTintBg, color: colors.primary, textAlign: 'center', lineHeight: 20, fontFamily: fonts.bodyBold, fontSize: 11 },
  passoTexto: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  card: { marginTop: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, gap: 6 },
  linha: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  paramsCard: { marginTop: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 16 },
  paramRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingVertical: 13 },
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
  exercicioDetalhe: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, color: colors.textTertiary, marginTop: 4 },
  exercicioBolas: { fontFamily: fonts.mono, fontSize: 13, color: colors.textSecondary },
  footer: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surfaceSunken, gap: 4 },
  durationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  durationLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  durationValue: { fontFamily: fonts.mono, fontSize: 15, color: colors.text }
});

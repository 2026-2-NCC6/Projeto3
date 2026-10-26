import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { Aviso, Caixa, OutlineButton, PrimaryButton } from '../components/ui';
import { IconAlert, IconCheckCircle, IconChevronRight } from '../components/Icons';
import { CornerWatermark } from '../components/Watermark';
import { mmss, resumirSessao } from '../sessao/regras';
import { sessaoAtiva } from '../sessao/sessaoAtiva';
import { useAuth } from '../auth/AuthContext';
import { ErroApi } from '../api/cliente';

type Props = NativeStackScreenProps<RootStackParamList, 'ParadaSegura'>;

/**
 * §3 do edital: a parada segura interrompe o treino e impede novos comandos até que o sistema
 * seja explicitamente reiniciado. Aqui o reinício exige confirmar que a área está segura.
 */
export function ParadaSeguraScreen({ navigation }: Props) {
  const { sincronizar } = useAuth();
  const ativa = sessaoAtiva.obter();
  const [areaSegura, setAreaSegura] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!ativa) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={{ padding: 22, gap: 12 }}>
          <Aviso texto="Nenhuma sessão em parada segura." />
          <OutlineButton label="Voltar ao início" onPress={() => navigation.navigate('MainTabs')} />
        </View>
      </SafeAreaView>
    );
  }

  const resumo = resumirSessao(ativa.golpes, ativa.tempoSeg, ativa.treino.conteudo.pontuacao);

  async function reiniciar() {
    setErro(null);
    setEnviando(true);
    try {
      await ativa!.remota.comando('REINICIAR', { areaSegura: true });
      return true;
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível reiniciar. Tente de novo.');
      return false;
    } finally {
      setEnviando(false);
    }
  }

  async function retomar() {
    if (!(await reiniciar())) return;
    ativa!.retomarAoVoltar = true;
    navigation.goBack();
  }

  async function encerrar() {
    if (!(await reiniciar())) return;
    setEnviando(true);
    try {
      const final = await ativa!.remota.encerrar({ pontosCliente: resumo.pontos });
      sessaoAtiva.limpar();
      void sincronizar().catch(() => undefined);
      navigation.replace('Resultado', {
        sessao: final.sessao,
        resumoLocal: { ...resumo, treinoSlug: ativa!.treino.slug, origem: ativa!.usouSensor ? 'sensor' : 'demo', terminadaEm: Date.now() },
        pendente: final.pendenteSincronizacao,
        treinoNome: ativa!.treino.nome
      });
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível encerrar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <ScrollView>
        <View style={styles.hero}>
          <IconAlert />
          <Text style={styles.heroTitle} accessibilityRole="header">
            Parada segura{'\n'}acionada
          </Text>
          <Text style={styles.heroBody}>
            A máquina parou e a raquete deixou de coletar. Nenhum comando é aceito até o reinício explícito. Os golpes da sessão foram preservados.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.eyebrow}>Estado da sessão</Text>
          <View style={styles.statesRow}>
            <View style={styles.stateChip}>
              <Text style={styles.stateChipLabel}>EM_EXECUCAO</Text>
            </View>
            <IconChevronRight />
            <View style={[styles.stateChip, { flex: 1.25, borderColor: 'rgba(239,68,68,0.5)', backgroundColor: colors.dangerTintBg }]}>
              <Text style={[styles.stateChipLabel, { color: colors.danger }]}>PARADA_SEGURA</Text>
            </View>
            <IconChevronRight />
            <View style={[styles.stateChip, { borderStyle: 'dashed' }]}>
              <Text style={[styles.stateChipLabel, { color: colors.textQuaternary }]}>PAUSADA</Text>
            </View>
          </View>
          <Text style={styles.note}>O reinício leva a PAUSADA: a partir daí você escolhe retomar o treino ou encerrar a sessão.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.eyebrow}>Preservado da sessão</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{resumo.golpes}</Text>
              <Text style={styles.statLabel}>golpes</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{resumo.pontos.toLocaleString('pt-BR')}</Text>
              <Text style={styles.statLabel}>pontos</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{mmss(ativa.tempoSeg)}</Text>
              <Text style={styles.statLabel}>decorrido</Text>
            </View>
          </View>
          <View style={styles.syncRow}>
            <IconCheckCircle />
            <Text style={styles.syncText}>
              {ativa.remota.modo === 'online' ? 'Parada e motivo registrados no servidor.' : 'Sem conexão: parada registrada no aparelho e enviada depois.'}
            </Text>
          </View>
        </View>

        <View style={[styles.section, { paddingBottom: 30, gap: 12 }]}>
          <Caixa marcada={areaSegura} onPress={() => setAreaSegura(!areaSegura)}>
            Confirmo que a área da máquina está livre e que o praticante está bem.
          </Caixa>
          {erro && <Aviso texto={erro} tipo="erro" />}
          <PrimaryButton label={enviando ? 'Aguarde…' : 'Reiniciar e retomar o treino'} disabled={!areaSegura || enviando} onPress={retomar} />
          <OutlineButton label="Reiniciar e encerrar a sessão" disabled={!areaSegura || enviando} onPress={encerrar} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  hero: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 26, backgroundColor: colors.dangerTintBg, borderBottomWidth: 1, borderBottomColor: 'rgba(239,68,68,0.22)' },
  heroTitle: { fontFamily: fonts.displayBold, fontSize: 36, lineHeight: 37, color: colors.danger, textTransform: 'uppercase', marginTop: 16 },
  heroBody: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.textSecondary, marginTop: 14 },
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
  syncText: { flex: 1, fontFamily: fonts.body, fontSize: 11.5, color: colors.textSecondary }
});

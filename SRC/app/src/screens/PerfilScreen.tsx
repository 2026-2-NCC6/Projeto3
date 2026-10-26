import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, type CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import type { FaixaEtaria, Indicadores, Nivel, Praticante } from '../api/tipos';
import { ErroApi, ErroRede } from '../api/cliente';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { Aviso, CampoTexto, Caixa, DangerButton, GhostButton, OutlineButton, PageHeader, Pill, PrimaryButton, StatRow } from '../components/ui';
import { IconShield } from '../components/Icons';
import { CornerWatermark } from '../components/Watermark';
import { useAuth } from '../auth/AuthContext';
import { NOME_NIVEL } from './CatalogoScreen';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Perfil'>,
  NativeStackScreenProps<RootStackParamList>
>;

const NIVEIS: Nivel[] = ['INICIANTE', 'INTERMEDIARIO', 'AVANCADO'];
const FAIXAS_MENORES: { id: FaixaEtaria; rotulo: string }[] = [
  { id: 'ATE_9', rotulo: 'Até 9' },
  { id: 'DE_10_A_13', rotulo: '10–13' },
  { id: 'DE_14_A_17', rotulo: '14–17' }
];
const FAIXA: Record<FaixaEtaria, string> = {
  ATE_9: 'até 9 anos',
  DE_10_A_13: '10 a 13 anos',
  DE_14_A_17: '14 a 17 anos',
  DE_18_A_29: '18 a 29 anos',
  DE_30_A_44: '30 a 44 anos',
  DE_45_A_59: '45 a 59 anos',
  DE_60_MAIS: '60 anos ou mais'
};
const PAPEL = { JOGADOR: 'Jogador', AUTOR: 'Treinador / autor', ADMIN: 'Administrador' } as const;

const msgErro = (e: unknown) => (e instanceof ErroRede ? 'Sem conexão. Tente de novo quando a internet voltar.' : e instanceof ErroApi ? e.message : 'Algo deu errado.');

export function PerfilScreen({ navigation }: Props) {
  const { usuario, praticantes, praticanteAtivo, escolherPraticante, api, recarregar, sair } = useAuth();
  const [indicadores, setIndicadores] = useState<Indicadores | null>(null);
  const [objetivos, setObjetivos] = useState('');
  const [restricoes, setRestricoes] = useState('');
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);
  const [novoDep, setNovoDep] = useState(false);
  const [dep, setDep] = useState({ apelido: '', faixa: null as FaixaEtaria | null, nivel: 'INICIANTE' as Nivel, parental: false, telemetria: false });
  const [excluindo, setExcluindo] = useState(false);
  const [senhaExclusao, setSenhaExclusao] = useState('');

  useEffect(() => {
    setObjetivos(praticanteAtivo?.objetivos.join(', ') ?? '');
    setRestricoes(praticanteAtivo?.restricoes ?? '');
  }, [praticanteAtivo]);

  useFocusEffect(
    useCallback(() => {
      if (!praticanteAtivo) return;
      api.indicadores(praticanteAtivo.id).then(setIndicadores).catch(() => setIndicadores(null));
    }, [api, praticanteAtivo])
  );

  async function atualizar(p: Partial<Pick<Praticante, 'nivel' | 'objetivos' | 'restricoes' | 'consenteTelemetria'>>, ok = 'Perfil atualizado.') {
    if (!praticanteAtivo) return;
    setAviso(null);
    try {
      await api.atualizarPraticante(praticanteAtivo.id, p);
      await recarregar();
      setAviso({ texto: ok, tipo: 'ok' });
    } catch (e) {
      setAviso({ texto: msgErro(e), tipo: 'erro' });
    }
  }

  async function criarDependente() {
    if (!dep.apelido.trim() || !dep.faixa) return setAviso({ texto: 'Informe o apelido e a faixa etária.', tipo: 'erro' });
    if (!dep.parental) return setAviso({ texto: 'O consentimento do responsável é obrigatório para cadastrar um menor.', tipo: 'erro' });
    try {
      const novo = await api.criarDependente({ apelido: dep.apelido.trim(), faixaEtaria: dep.faixa, nivel: dep.nivel, consentimentoParental: true, consenteTelemetria: dep.telemetria });
      await recarregar();
      escolherPraticante(novo.id);
      setNovoDep(false);
      setDep({ apelido: '', faixa: null, nivel: 'INICIANTE', parental: false, telemetria: false });
      setAviso({ texto: `${novo.apelido} cadastrado. Os treinos dele ficam separados dos seus.`, tipo: 'ok' });
    } catch (e) {
      setAviso({ texto: msgErro(e), tipo: 'erro' });
    }
  }

  async function removerDependente() {
    if (!praticanteAtivo || praticanteAtivo.tipo !== 'DEPENDENTE') return;
    try {
      await api.removerPraticante(praticanteAtivo.id);
      const titular = praticantes.find((p) => p.tipo === 'TITULAR');
      if (titular) escolherPraticante(titular.id);
      await recarregar();
      setAviso({ texto: 'Dependente e as sessões dele foram apagados.', tipo: 'ok' });
    } catch (e) {
      setAviso({ texto: msgErro(e), tipo: 'erro' });
    }
  }

  // LGPD art. 18: portabilidade — todos os dados da conta em JSON, pelo compartilhamento do sistema.
  async function exportar() {
    try {
      const dados = await api.exportarDados();
      await Share.share({ title: 'Meus dados do Tennis Analytics', message: JSON.stringify(dados, null, 2) });
    } catch (e) {
      setAviso({ texto: msgErro(e), tipo: 'erro' });
    }
  }

  async function excluirConta() {
    try {
      await api.excluirConta(senhaExclusao);
      await sair();
    } catch (e) {
      setAviso({ texto: e instanceof ErroApi && e.status === 401 ? 'Senha incorreta.' : msgErro(e), tipo: 'erro' });
    }
  }

  if (!usuario) return null;
  const iniciais = usuario.nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <PageHeader eyebrow="Sua conta" title="Perfil" />

        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLabel}>{iniciais}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{usuario.nome}</Text>
            <Text style={styles.email}>{usuario.email}</Text>
          </View>
        </View>
        <View style={styles.tagRow}>
          <View style={styles.tag}>
            <Text style={styles.tagLabel}>{PAPEL[usuario.papel]}</Text>
          </View>
        </View>

        {aviso && (
          <View style={{ marginTop: 14 }}>
            <Aviso texto={aviso.texto} tipo={aviso.tipo} />
          </View>
        )}

        <Text style={styles.sectionTitle}>Quem está treinando</Text>
        <View style={{ gap: 8 }}>
          {praticantes.map((p) => {
            const ativo = p.id === praticanteAtivo?.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => escolherPraticante(p.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: ativo }}
                style={[styles.praticante, ativo && { borderColor: colors.primary, backgroundColor: colors.primaryTintBgSoft }]}
              >
                <Text style={styles.praticanteNome}>{p.apelido}</Text>
                <Text style={styles.praticanteMeta}>
                  {p.tipo === 'TITULAR' ? 'você' : 'dependente'} · {FAIXA[p.faixaEtaria]} · {NOME_NIVEL[p.nivel]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {!novoDep ? (
          <GhostButton label="Adicionar dependente (menor de idade)" onPress={() => setNovoDep(true)} />
        ) : (
          <View style={[styles.card, { padding: 16, gap: 12, marginTop: 10 }]}>
            <CampoTexto rotulo="Apelido do dependente" value={dep.apelido} onChangeText={(apelido) => setDep({ ...dep, apelido })} maxLength={30} />
            <Text style={styles.subtitulo}>Faixa etária</Text>
            <View style={styles.pills}>
              {FAIXAS_MENORES.map((f) => (
                <Pill key={f.id} label={f.rotulo} active={dep.faixa === f.id} onPress={() => setDep({ ...dep, faixa: f.id })} />
              ))}
            </View>
            <Text style={styles.subtitulo}>Nível</Text>
            <View style={styles.pills}>
              {NIVEIS.map((n) => (
                <Pill key={n} label={NOME_NIVEL[n]} active={dep.nivel === n} onPress={() => setDep({ ...dep, nivel: n })} />
              ))}
            </View>
            <Caixa marcada={dep.parental} onPress={() => setDep({ ...dep, parental: !dep.parental })}>
              Sou o responsável legal e consinto com o tratamento dos dados de treino deste menor (só apelido, faixa etária e sessões).
            </Caixa>
            <Caixa marcada={dep.telemetria} onPress={() => setDep({ ...dep, telemetria: !dep.telemetria })}>
              Autorizo enviar os golpes detalhados à plataforma SmartTennis (opcional; o resumo é sempre enviado sem identificar a criança).
            </Caixa>
            <PrimaryButton label="Cadastrar dependente" onPress={criarDependente} />
            <GhostButton label="Cancelar" onPress={() => setNovoDep(false)} />
          </View>
        )}

        {praticanteAtivo && (
          <>
            <Text style={styles.sectionTitle}>Perfil de {praticanteAtivo.apelido}</Text>
            <View style={styles.pills}>
              {NIVEIS.map((n) => (
                <Pill key={n} label={NOME_NIVEL[n]} active={praticanteAtivo.nivel === n} onPress={() => atualizar({ nivel: n }, 'Nível atualizado.')} />
              ))}
            </View>
            <View style={{ gap: 12, marginTop: 14 }}>
              <CampoTexto rotulo="Objetivos (separados por vírgula)" value={objetivos} onChangeText={setObjetivos} placeholder="consistência, backhand, resistência" />
              <CampoTexto rotulo="Restrições ou cuidados" value={restricoes} onChangeText={setRestricoes} placeholder="ex.: dor no ombro direito" multiline style={{ height: 76, paddingTop: 12 }} />
              <OutlineButton
                label="Salvar perfil"
                onPress={() =>
                  atualizar({
                    objetivos: objetivos.split(',').map((o) => o.trim()).filter(Boolean).slice(0, 10),
                    restricoes: restricoes.trim() || null
                  })
                }
              />
            </View>

            <Text style={styles.sectionTitle}>Compartilhamento</Text>
            <Caixa
              marcada={praticanteAtivo.consenteTelemetria}
              onPress={() =>
                atualizar(
                  { consenteTelemetria: !praticanteAtivo.consenteTelemetria },
                  praticanteAtivo.consenteTelemetria ? 'Autorização de telemetria revogada.' : 'Telemetria autorizada.'
                )
              }
            >
              Enviar os golpes detalhados (telemetria) à plataforma SmartTennis. Sem esta autorização, só o resumo da sessão é enviado, sem identificar você.
            </Caixa>
            {praticanteAtivo.tipo === 'DEPENDENTE' && praticanteAtivo.consentimentoParentalEm && (
              <Text style={styles.note}>Consentimento do responsável registrado em {new Date(praticanteAtivo.consentimentoParentalEm).toLocaleDateString('pt-BR')}.</Text>
            )}

            <Text style={styles.sectionTitle}>Estatísticas de {praticanteAtivo.apelido}</Text>
            <View style={styles.card}>
              {(
                [
                  ['Sessões concluídas', String(indicadores?.sessoes ?? '—')],
                  ['Tempo total treinado', indicadores ? `${Math.round(indicadores.tempoSeg / 60)} min` : '—'],
                  ['Golpes registrados', String(indicadores?.volume ?? '—')],
                  ['Precisão média', indicadores ? `${indicadores.precisao}%` : '—']
                ] as const
              ).map(([rotulo, valor], i) => (
                <View key={rotulo}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.statRowWrap}>
                    <StatRow label={rotulo} value={valor} />
                  </View>
                </View>
              ))}
            </View>

            {praticanteAtivo.tipo === 'DEPENDENTE' && <GhostButton label={`Remover ${praticanteAtivo.apelido} e as sessões dele`} onPress={removerDependente} />}
          </>
        )}

        <Text style={styles.sectionTitle}>Feedback durante o treino</Text>
        <View style={styles.card}>
          <Text style={[styles.toggleNote, { paddingVertical: 14 }]}>
            Raquete: LED e tom pela força em cada golpe e, logo depois, tom agudo para acerto ou grave para erro. Celular: vibração curta no acerto e dupla no erro, como
            alternativa a sinais só visuais ou sonoros.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Privacidade e dados</Text>
        <View style={styles.card}>
          <View style={styles.privacyRow}>
            <IconShield />
            <Text style={styles.privacyText}>Você pode baixar uma cópia de todos os seus dados ou excluir a conta a qualquer momento.</Text>
          </View>
        </View>
        <View style={{ gap: 2, marginTop: 4 }}>
          <GhostButton label="Exportar meus dados (JSON)" onPress={exportar} />
          <GhostButton label="Política de privacidade" onPress={() => navigation.navigate('Privacidade')} />
          {!excluindo ? (
            <GhostButton label="Excluir minha conta" onPress={() => setExcluindo(true)} />
          ) : (
            <View style={{ gap: 10, marginTop: 8 }}>
              <Text style={styles.note}>Isso apaga praticantes, sessões e raquetes da conta e não pode ser desfeito. Confirme com sua senha.</Text>
              <CampoTexto rotulo="Senha" value={senhaExclusao} onChangeText={setSenhaExclusao} secureTextEntry />
              <DangerButton label="Excluir definitivamente" onPress={excluirConta} />
              <GhostButton label="Cancelar" onPress={() => setExcluindo(false)} />
            </View>
          )}
        </View>

        <DangerButton label="Sair da conta" onPress={() => void sair()} style={{ marginTop: 24 }} />
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
  subtitulo: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textSecondary },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  praticante: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 10, padding: 14 },
  praticanteNome: { fontFamily: fonts.bodyMedium, fontSize: 14.5, color: colors.text },
  praticanteMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textTertiary, marginTop: 3 },
  note: { marginTop: 10, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16.5, color: colors.textTertiary },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 16 },
  statRowWrap: { paddingVertical: 13 },
  divider: { height: 1, backgroundColor: colors.divider },
  toggleNote: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17.5, color: colors.textSecondary },
  privacyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 16 },
  privacyText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18.5, color: colors.textSecondary }
});

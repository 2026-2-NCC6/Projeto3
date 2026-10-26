import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { FaixaEtaria, Nivel } from '../api/tipos';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { Aviso, CampoTexto, Caixa, GhostButton, Pill, PrimaryButton, ScreenHeader } from '../components/ui';
import { CornerWatermark } from '../components/Watermark';
import { useAuth } from '../auth/AuthContext';
import { ErroApi, ErroRede } from '../api/cliente';

type Props = NativeStackScreenProps<RootStackParamList, 'Cadastro'>;

// Só faixas adultas: a conta é do adulto; menores entram depois, como dependentes (RF11, LGPD art. 14).
const FAIXAS: { id: FaixaEtaria; rotulo: string }[] = [
  { id: 'DE_18_A_29', rotulo: '18–29' },
  { id: 'DE_30_A_44', rotulo: '30–44' },
  { id: 'DE_45_A_59', rotulo: '45–59' },
  { id: 'DE_60_MAIS', rotulo: '60+' }
];
const NIVEIS: { id: Nivel; rotulo: string }[] = [
  { id: 'INICIANTE', rotulo: 'Iniciante' },
  { id: 'INTERMEDIARIO', rotulo: 'Intermediário' },
  { id: 'AVANCADO', rotulo: 'Avançado' }
];

export const senhaForte = (s: string) => s.length >= 8 && s.length <= 72 && /[A-Za-z]/.test(s) && /\d/.test(s);

export function CadastroScreen({ navigation }: Props) {
  const { cadastrar } = useAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [faixa, setFaixa] = useState<FaixaEtaria | null>(null);
  const [nivel, setNivel] = useState<Nivel>('INICIANTE');
  const [maior, setMaior] = useState(false);
  const [termos, setTermos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const problemas = [
    nome.trim().length < 2 && 'Informe seu nome.',
    !/^\S+@\S+\.\S+$/.test(email.trim()) && 'Informe um e-mail válido.',
    !senhaForte(senha) && 'A senha precisa de 8 a 72 caracteres, com letras e números.',
    senha !== confirmacao && 'As senhas não conferem.',
    !faixa && 'Escolha sua faixa etária.',
    !maior && 'O cadastro é restrito a maiores de 18 anos.',
    !termos && 'Aceite os termos e a política de privacidade.'
  ].filter(Boolean) as string[];

  async function enviar() {
    if (problemas.length) {
      setErro(problemas[0]);
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await cadastrar({ email: email.trim(), senha, nome: nome.trim(), faixaEtaria: faixa!, nivel });
    } catch (e) {
      setErro(
        e instanceof ErroRede
          ? 'Sem conexão com o servidor. Tente de novo.'
          : e instanceof ErroApi && e.codigo === 'EMAIL_EM_USO'
            ? 'Já existe uma conta com este e-mail.'
            : e instanceof ErroApi
              ? e.message
              : 'Não foi possível criar a conta.'
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <ScreenHeader title="Nova conta" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Criar conta</Text>
          <View style={{ gap: 16, marginTop: 20 }}>
            <CampoTexto rotulo="Nome" value={nome} onChangeText={setNome} autoComplete="name" />
            <CampoTexto rotulo="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <CampoTexto rotulo="Senha" value={senha} onChangeText={setSenha} secureTextEntry placeholder="8+ caracteres, letras e números" />
            <CampoTexto rotulo="Confirme a senha" value={confirmacao} onChangeText={setConfirmacao} secureTextEntry />
          </View>

          <Text style={styles.eyebrow}>Faixa etária</Text>
          <View style={styles.pills}>
            {FAIXAS.map((f) => (
              <Pill key={f.id} label={f.rotulo} active={faixa === f.id} onPress={() => setFaixa(f.id)} />
            ))}
          </View>

          <Text style={styles.eyebrow}>Seu nível no tênis</Text>
          <View style={styles.pills}>
            {NIVEIS.map((n) => (
              <Pill key={n.id} label={n.rotulo} active={nivel === n.id} onPress={() => setNivel(n.id)} />
            ))}
          </View>

          <View style={{ marginTop: 20, gap: 4 }}>
            <Caixa marcada={maior} onPress={() => setMaior(!maior)}>
              Declaro ter 18 anos ou mais. Crianças e adolescentes treinam como dependentes, cadastrados por mim no Perfil.
            </Caixa>
            <Caixa marcada={termos} onPress={() => setTermos(!termos)}>
              Li e aceito os termos de uso e a política de privacidade.
            </Caixa>
            <GhostButton label="Ler a política de privacidade" onPress={() => navigation.navigate('Privacidade')} />
          </View>

          {erro && <Aviso texto={erro} tipo="erro" />}

          <View style={{ marginTop: 16 }}>
            <PrimaryButton label={enviando ? 'Criando…' : 'Criar conta'} disabled={enviando} onPress={enviar} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 22, paddingBottom: 30 },
  title: { fontFamily: fonts.displayBold, fontSize: 34, color: colors.text, textTransform: 'uppercase', marginTop: 8 },
  eyebrow: { fontFamily: fonts.bodyMedium, fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.textSecondary, marginTop: 22 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }
});

import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { LogoMark } from '../components/Icons';
import { Aviso, CampoTexto, GhostButton, OutlineButton, PrimaryButton } from '../components/ui';
import { CornerWatermark } from '../components/Watermark';
import { useAuth } from '../auth/AuthContext';
import { ErroApi, ErroRede } from '../api/cliente';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aoEntrar() {
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
    } catch (e) {
      // Mensagem genérica: não revela se o e-mail existe (A07).
      setErro(
        e instanceof ErroRede
          ? 'Sem conexão com o servidor. Verifique a internet e tente de novo.'
          : e instanceof ErroApi && e.status === 429
            ? 'Muitas tentativas. Aguarde um minuto.'
            : 'E-mail ou senha incorretos.'
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
            <CampoTexto
              rotulo="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="voce@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <CampoTexto rotulo="Senha" value={senha} onChangeText={setSenha} placeholder="••••••••" secureTextEntry autoComplete="password" />
          </View>

          {erro && (
            <View style={{ marginTop: 14 }}>
              <Aviso texto={erro} tipo="erro" />
            </View>
          )}

          <View style={{ gap: 12, marginTop: 20 }}>
            <PrimaryButton label={enviando ? 'Entrando…' : 'Entrar'} disabled={enviando || !email || !senha} onPress={aoEntrar} />
            <OutlineButton label="Criar conta" onPress={() => navigation.navigate('Cadastro')} />
          </View>

          <Text style={styles.legal}>
            Contas são de adultos; crianças e adolescentes treinam como dependentes do responsável, com dados mínimos.
          </Text>
          <GhostButton label="Política de privacidade" onPress={() => navigation.navigate('Privacidade')} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 36, paddingBottom: 16 },
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
  legal: {
    marginTop: 22,
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 16.5,
    color: colors.textTertiary,
    textAlign: 'center'
  }
});

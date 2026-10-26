import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { ScreenHeader } from '../components/ui';
import { TERMOS_VERSAO } from '../api/config';

type Props = NativeStackScreenProps<RootStackParamList, 'Privacidade'>;

// Descreve só o que o sistema de fato faz (ver SRC/backend e a spec). Mudou o tratamento de dados,
// muda este texto e TERMOS_VERSAO.
const SECOES: { titulo: string; texto: string }[] = [
  {
    titulo: 'Quais dados coletamos',
    texto:
      'Conta (adulto): nome, e-mail e senha (guardada só como hash). Praticante: apelido, faixa etária (não pedimos data de nascimento), nível, objetivos e restrições que você informar. Raquete: nome Bluetooth, identificador, versão do firmware e a chave de segurança, guardada cifrada. Treino: golpes (lado, força, pico de movimento), comandos e resultados das sessões.'
  },
  {
    titulo: 'Para que usamos',
    texto:
      'Executar e pontuar os treinos, mostrar seu histórico e indicadores, recomendar treinos e garantir a segurança (parada de emergência e registro de auditoria). Não usamos seus dados para publicidade.'
  },
  {
    titulo: 'Crianças e adolescentes',
    texto:
      'Menores não têm conta: são dependentes cadastrados pelo responsável, que consente com o tratamento dos dados. Do dependente guardamos só apelido e faixa etária. O envio de telemetria fica desligado por padrão e os eventos brutos são apagados em 30 dias.'
  },
  {
    titulo: 'Compartilhamento com a plataforma SmartTennis',
    texto:
      'Ao fim de cada sessão, o resumo é enviado à plataforma SmartTennis com um código que não revela quem você é. Os golpes detalhados só são enviados se você autorizar no Perfil (telemetria).'
  },
  {
    titulo: 'Quanto tempo guardamos',
    texto:
      'Os eventos detalhados de cada sessão são apagados depois de 180 dias (30 para dependentes); o resumo da sessão fica no seu histórico até você excluir a conta.'
  },
  {
    titulo: 'No seu celular',
    texto:
      'A sessão de login e a chave da raquete ficam no armazenamento seguro do sistema. Treinos baixados e sessões feitas sem internet ficam no aparelho até serem enviados. Ao sair da conta, as credenciais são apagadas do celular.'
  },
  {
    titulo: 'Seus direitos',
    texto:
      'No Perfil você pode exportar todos os seus dados (JSON), corrigir o perfil, revogar a autorização de telemetria e excluir a conta, o que apaga praticantes, sessões e raquetes.'
  }
];

export function PrivacidadeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title={`Política de privacidade · versão ${TERMOS_VERSAO}`} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Privacidade</Text>
        {SECOES.map((s) => (
          <React.Fragment key={s.titulo}>
            <Text style={styles.subtitulo} accessibilityRole="header">
              {s.titulo}
            </Text>
            <Text style={styles.texto}>{s.texto}</Text>
          </React.Fragment>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 22, paddingBottom: 40 },
  title: { fontFamily: fonts.displayBold, fontSize: 34, color: colors.text, textTransform: 'uppercase', marginTop: 8 },
  subtitulo: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text, marginTop: 22 },
  texto: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20.5, color: colors.textSecondary, marginTop: 8 }
});

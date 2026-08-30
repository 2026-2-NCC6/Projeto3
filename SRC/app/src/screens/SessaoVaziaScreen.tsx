import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { PrimaryButton } from '../components/ui';
import { IconRacket } from '../components/Icons';
import { CornerWatermark } from '../components/Watermark';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'SessaoTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function SessaoVaziaScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.screen}>
      <CornerWatermark />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <IconRacket size={34} color={colors.textTertiary} strokeWidth={1.4} />
        </View>
        <Text style={styles.title}>Nenhuma sessão{'\n'}em andamento</Text>
        <Text style={styles.note}>
          Escolha um treino no catálogo, pareie o dispositivo e comece a sessão para ver a pontuação em tempo real aqui.
        </Text>
        <PrimaryButton label="Ver treinos" onPress={() => navigation.navigate('Treinos')} style={{ marginTop: 26, minWidth: 200 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22
  },
  title: { fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 30, color: colors.text, textTransform: 'uppercase', textAlign: 'center' },
  note: { marginTop: 12, fontFamily: fonts.body, fontSize: 13, lineHeight: 19.5, color: colors.textTertiary, textAlign: 'center' }
});

import 'react-native-gesture-handler';
import React from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { DarkTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors } from './src/theme/colors';
import { useAppFonts } from './src/theme/useAppFonts';
import { RootNavigator } from './src/navigation/RootNavigator';
import { BleProvider } from './src/ble/BleContext';
import { AuthProvider, useAuth } from './src/auth/AuthContext';

/** A chave do BLE de cada raquete vem da conta (API ou cofre do aparelho), nunca do pacote do app. */
function BleComChaveDaConta({ children }: { children: React.ReactNode }) {
  const { obterChaveRaquete } = useAuth();
  return <BleProvider obterChave={obterChaveRaquete}>{children}</BleProvider>;
}

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    border: colors.border,
    primary: colors.primary,
    text: colors.text
  }
};

export default function App() {
  const [fontsLoaded] = useAppFonts();

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 22 }}>
        <Image
          source={require('./assets/imagemlogosecundaria.png')}
          style={{ width: 120, height: 120, borderRadius: 24 }}
          resizeMode="contain"
        />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <BleComChaveDaConta>
            <StatusBar style="light" />
            <NavigationContainer theme={navTheme}>
              <RootNavigator />
            </NavigationContainer>
          </BleComChaveDaConta>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

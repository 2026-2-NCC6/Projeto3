import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, TabParamList } from './types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { useAuth } from '../auth/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { CadastroScreen } from '../screens/CadastroScreen';
import { PrivacidadeScreen } from '../screens/PrivacidadeScreen';
import { CatalogoScreen } from '../screens/CatalogoScreen';
import { PreparacaoScreen } from '../screens/PreparacaoScreen';
import { PareamentoScreen } from '../screens/PareamentoScreen';
import { SessaoScreen } from '../screens/SessaoScreen';
import { ParadaSeguraScreen } from '../screens/ParadaSeguraScreen';
import { ResultadoScreen } from '../screens/ResultadoScreen';
import { HistoricoScreen } from '../screens/HistoricoScreen';
import { SessaoVaziaScreen } from '../screens/SessaoVaziaScreen';
import { PerfilScreen } from '../screens/PerfilScreen';
import { InicioScreen } from '../screens/InicioScreen';
import { DebugScreen } from '../screens/DebugScreen';
import { IconHistorico, IconInicio, IconPerfil, IconSessao, IconTreinos } from '../components/Icons';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Inicio"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surfaceSunken,
          borderTopColor: colors.divider,
          height: 64,
          paddingTop: 8,
          paddingBottom: 12
        },
        tabBarLabelStyle: { fontFamily: fonts.body, fontSize: 10 }
      }}
    >
      <Tab.Screen
        name="Inicio"
        component={InicioScreen}
        options={{ tabBarLabel: 'Início', tabBarIcon: ({ color }) => <IconInicio color={color} /> }}
      />
      <Tab.Screen
        name="Treinos"
        component={CatalogoScreen}
        options={{ tabBarIcon: ({ color }) => <IconTreinos color={color} /> }}
      />
      <Tab.Screen
        name="SessaoTab"
        component={SessaoVaziaScreen}
        options={{ tabBarLabel: 'Sessão', tabBarIcon: ({ color }) => <IconSessao color={color} /> }}
      />
      <Tab.Screen
        name="Historico"
        component={HistoricoScreen}
        options={{ tabBarIcon: ({ color }) => <IconHistorico color={color} /> }}
      />
      <Tab.Screen
        name="Perfil"
        component={PerfilScreen}
        options={{ tabBarIcon: ({ color }) => <IconPerfil color={color} /> }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { carregando, usuario } = useAuth();

  if (carregando) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {usuario ? (
        // Telas internas só existem com usuário autenticado (RF01).
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Preparacao" component={PreparacaoScreen} />
          <Stack.Screen name="Pareamento" component={PareamentoScreen} />
          <Stack.Screen name="Sessao" component={SessaoScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="ParadaSegura" component={ParadaSeguraScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="Resultado" component={ResultadoScreen} options={{ gestureEnabled: false }} />
          {/* Diagnóstico envia comandos direto à placa: só em build de desenvolvimento. */}
          {__DEV__ && <Stack.Screen name="Debug" component={DebugScreen} />}
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Cadastro" component={CadastroScreen} />
        </>
      )}
      <Stack.Screen name="Privacidade" component={PrivacidadeScreen} />
    </Stack.Navigator>
  );
}

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, TabParamList } from './types';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { LoginScreen } from '../screens/LoginScreen';
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
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Preparacao" component={PreparacaoScreen} />
      <Stack.Screen name="Pareamento" component={PareamentoScreen} />
      <Stack.Screen name="Sessao" component={SessaoScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="ParadaSegura" component={ParadaSeguraScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Resultado" component={ResultadoScreen} options={{ gestureEnabled: false }} />
    </Stack.Navigator>
  );
}

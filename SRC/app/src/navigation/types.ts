import { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Inicio: undefined;
  Treinos: undefined;
  SessaoTab: undefined;
  Historico: undefined;
  Perfil: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  MainTabs: NavigatorScreenParams<TabParamList> | undefined;
  Preparacao: undefined;
  Pareamento: undefined;
  Sessao: undefined;
  ParadaSegura: undefined;
  Resultado: undefined;
};

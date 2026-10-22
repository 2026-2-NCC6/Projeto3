import { NavigatorScreenParams } from '@react-navigation/native';
import type { ResumoSessao } from '../sessao/regras';

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
  Preparacao: { treinoId: string } | undefined;
  Pareamento: { treinoId: string } | undefined;
  Sessao: { treinoId: string } | undefined;
  ParadaSegura: { resumo: ResumoSessao } | undefined;
  Resultado: { resumo: ResumoSessao } | undefined;
  Debug: undefined;
};

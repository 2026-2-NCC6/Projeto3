import { NavigatorScreenParams } from '@react-navigation/native';
import type { Sessao } from '../api/tipos';
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
  Cadastro: undefined;
  Privacidade: undefined;
  MainTabs: NavigatorScreenParams<TabParamList> | undefined;
  Preparacao: { slug: string };
  Pareamento: { slug: string };
  /** `demo`: sem sensor, com os botões de simulação de golpe. */
  Sessao: { slug: string; demo?: boolean };
  ParadaSegura: undefined;
  Resultado: { sessao: Sessao | null; resumoLocal: ResumoSessao; pendente: boolean; treinoNome: string };
  Debug: undefined;
};

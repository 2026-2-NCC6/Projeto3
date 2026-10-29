import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { ChaveValor } from './chaveValor';

/** Dados comuns do app (catálogo, fila offline, conta em cache): AsyncStorage. */
export const armazenamentoApp: ChaveValor = {
  ler: (k) => AsyncStorage.getItem(k),
  gravar: (k, v) => AsyncStorage.setItem(k, v),
  apagar: (k) => AsyncStorage.removeItem(k)
};

// O SecureStore só aceita letras, números, ".", "-" e "_" na chave.
const chaveSegura = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, '_');

/**
 * Credenciais (refresh token, chaves das raquetes): SecureStore, cifrado pelo sistema
 * (Keychain no iOS, Keystore no Android). RNF Segurança: armazenamento protegido de credenciais.
 */
export const cofre: ChaveValor = {
  ler: (k) => SecureStore.getItemAsync(chaveSegura(k)),
  gravar: (k, v) => SecureStore.setItemAsync(chaveSegura(k), v),
  apagar: (k) => SecureStore.deleteItemAsync(chaveSegura(k))
};

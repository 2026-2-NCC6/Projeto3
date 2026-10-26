# App mobile — Tennis Analytics

Expo SDK 51 / React Native 0.74. Fala com a API (`SRC/backend`) por HTTPS e com a raquete
(`SRC/arduino/tennis_imu`) por BLE autenticado.

## Rodando

```bash
cp .env.example .env        # ajuste EXPO_PUBLIC_API_URL
npm install
npx expo run:android        # gera e instala o build de desenvolvimento
npm run dev                 # Metro para o build de desenvolvimento
```

O BLE (`react-native-ble-plx`) e o cofre (`expo-secure-store`) são módulos nativos: **não funcionam
no Expo Go**. Sempre que um módulo nativo entra no `package.json` é preciso gerar um build novo
(`npx expo run:android` ou EAS), senão o app quebra ao abrir.

Testes de unidade (node:test, sem emulador) e checagem de tipos:

```bash
npm test
npx tsc --noEmit
```

## Como as peças se encaixam

| Pasta | Papel | Requisitos |
| --- | --- | --- |
| `src/api` | Cliente HTTP com token de acesso curto e renovação única por vez; tipos e rotas da API | RF01, RNF Segurança |
| `src/auth` | Login, cadastro, sessão persistida (refresh token no SecureStore), praticante ativo | RF01, RF02 |
| `src/treinos` | Catálogo com filtros e treinos com cache por ETag, para treinar sem internet | RF03, RF04, RF21 |
| `src/sessao` | Regras de pontuação (espelho do backend), sessão remota/offline, linguagem infantil | RF07, RF09, RF10, RF11, RF21 |
| `src/offline` | Fila de sessões feitas sem conexão, enviadas em `/sessoes/sincronizar` | RF21 |
| `src/ble` | Protocolo da raquete, HMAC-SHA256 e desafio-resposta antes de aceitar qualquer golpe | RF05, RF07, RF08, RNF Cibersegurança IoT |
| `src/armazenamento` | AsyncStorage (cache) e SecureStore (tokens e chaves de raquete) | RNF Segurança, RNF Privacidade/LGPD |

## Segurança e privacidade

- Nenhum segredo vai no bundle. A chave de cada raquete é registrada pelo dono e devolvida pela API
  só a ele; o app guarda uma cópia no SecureStore para parear sem internet.
- `EXPO_PUBLIC_CHAVE_DISPOSITIVO_DEV` só é lida em build de desenvolvimento (`__DEV__`), para testes de
  bancada. Não defina ao gerar o APK.
- A tela de depuração BLE só existe em desenvolvimento.
- No Perfil o titular exporta os próprios dados (JSON), revoga a telemetria e exclui a conta.
  Dependentes menores exigem consentimento do responsável.

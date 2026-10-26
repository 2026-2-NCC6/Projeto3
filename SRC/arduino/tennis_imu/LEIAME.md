# Firmware da raquete (Arduino UNO R4 WiFi + MPU-6050)

Versão **1.1.0**: o canal BLE passou a ser autenticado por desafio e resposta (RNF Cibersegurança do IoT). Antes da autenticação, a placa só aceita `PING`, `CH:` e `PA:` pelo Bluetooth; qualquer outro comando recebe `ERR:AUTH`. O protocolo completo está no cabeçalho de [tennis_imu.ino](tennis_imu.ino) e em [autenticacao.h](autenticacao.h).

## 1. Chave da raquete

Cada raquete tem uma chave própria de 16 bytes, que **nunca vai para o git**:

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex').toUpperCase())"
```

1. Copie `segredo.exemplo.h` para `segredo.h` (o `segredo.h` está no `.gitignore`).
2. Troque os 16 bytes pelos da chave gerada (cada par de hex vira um `0x..`).
3. Guarde os 32 hex: eles são informados **uma vez**, ao registrar a raquete no app. A API guarda a chave cifrada e a entrega só ao dono, depois do login.

Sem `segredo.h`, a compilação para com uma mensagem explicando o que fazer. Com a chave de exemplo, a placa avisa na serial, e a API e o app recusam essa chave.

## 2. Testes no PC (sem a placa)

[teste_pc/teste_autenticacao.cpp](teste_pc/teste_autenticacao.cpp) compila os mesmos `autenticacao.h` e `hmac_sha256.h` usados na placa. Ele confere SHA-256 e HMAC contra a FIPS 180-4 e a RFC 4231, usa o vetor compartilhado com o app (`SRC/app/src/ble/hmac.test.ts`) e testa replay, força bruta, bloqueio de 30 s e a volta do `millis()`.

```bash
cd teste_pc
g++ -std=c++17 -Wall -Wextra -Werror teste_autenticacao.cpp -o teste && ./teste
# ou, sem g++ instalado:  zig c++ -std=c++17 -Wall -Wextra -Werror teste_autenticacao.cpp -o teste
```

## 3. Compilar para a placa

Pela Arduino IDE (placa **Arduino UNO R4 WiFi**, bibliotecas **ArduinoBLE** e **Adafruit MPU6050**) ou pela linha de comando:

```bash
arduino-cli core install arduino:renesas_uno
arduino-cli lib install ArduinoBLE "Adafruit MPU6050"
arduino-cli compile --fqbn arduino:renesas_uno:unor4wifi .
```

Verificado com `arduino:renesas_uno` 1.6.0, ArduinoBLE 2.1.0 e Adafruit MPU6050 2.2.9: usa 40% da flash e 37% da RAM. No Windows, se o compilador não encontrar `stdlib.h`, o caminho das ferramentas passou de 260 caracteres: use uma pasta de dados mais curta.

## 4. O que ainda precisa da placa (bancada)

- Autenticar pelo app e conferir a versão `1.1.0` no pareamento.
- Tentar `START` sem autenticar (deve vir `ERR:AUTH`) e 3 provas erradas (deve derrubar a conexão e bloquear por 30 s).
- `FB:1` e `FB:0`: tom agudo com LED (acerto) e tom grave (erro).
- Parada segura (`STOP` leva a `PARADO`) e queda de conexão (volta a `AGUARDANDO` e exige nova autenticação).

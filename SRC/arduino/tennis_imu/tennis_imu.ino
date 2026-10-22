/*
 * Tennis Analytics — firmware do módulo da raquete (Arduino UNO R4 WiFi + MPU-6050)
 *
 * Contrato BLE (fonte única: plano-app-ble.md, seção 1)
 *   Serviço  4fafc201-1fb5-459e-8fcc-c5c9c331914b   nome "ArduinoR4-IMU"
 *   ...26a8  Read + Notify   Arduino -> app
 *   ...26a9  Write           app -> Arduino
 *
 * Arduino -> app (ASCII, no máximo 20 bytes por mensagem: cabe no MTU padrão de 23)
 *   S:<F|B>,<picoG>,<picoGiro>,<forca 1-3>,<seq>   fim de cada golpe
 *   E:<AGUARDANDO|COLETANDO|PAUSADO|PARADO>        mudança de estado e resposta a todo comando
 *   ERR:<texto>                                    falha de sensor / comando inválido
 *   A:ax,ay,az  e  G:gx,gy,gz                      só com DBG:1, 10 Hz (g e rad/s)
 *     (o formato antigo "A:...|G:..." passa de 20 bytes; por isso vai em duas mensagens)
 *
 * App -> Arduino: START, PAUSE, RESUME, STOP, PING, DBG:0, DBG:1
 * Os mesmos comandos funcionam no Monitor Serial (115200, nova linha).
 *
 * Máquina de estados:
 *   AGUARDANDO --START--> COLETANDO <--PAUSE/RESUME--> PAUSADO
 *   qualquer estado --STOP--> PARADO; PARADO só sai com START explícito.
 *   Queda da conexão: volta para AGUARDANDO e para de coletar.
 *
 * Unidades: picoG em g, picoGiro em rad/s. seq começa em 1 a cada boot e volta a 1 depois de 9999.
 */

#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <ArduinoBLE.h>

#define SERVICE_UUID   "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_DADOS_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define CHAR_CMD_UUID  "beb5483e-36e1-4688-b7f5-ea07361b26a9"

const size_t MAX_MSG = 20;

// ---------------- Feedback local (sempre ativo) ----------------
const uint8_t LED_PIN    = LED_BUILTIN;  // LED da placa (pino 13). Troque pelo pino do LED externo, se houver.
const uint8_t BUZZER_PIN = 8;            // buzzer passivo; sem buzzer ligado, o tone() é inofensivo.

// ---------------- Amostragem ----------------
// Detecção a 100 Hz: um golpe dura ~100–300 ms, e a 10 Hz o pico seria perdido.
const unsigned long PERIODO_AMOSTRA_US = 10000;
const uint8_t DIVISOR_DEBUG = 10;  // telemetria de debug a 10 Hz

// ---------------- Detecção de golpe ----------------
// Usa o giroscópio (rotação da raquete), não o pico do acelerômetro: o MPU-6050
// satura em ±16 g no impacto. VALORES INICIAIS — recalibrar com dados reais (tela de debug do app).
const float GIRO_INICIO      = 8.0;   // rad/s — início do swing (~460 °/s)
const float GIRO_FIM         = 3.0;   // rad/s — fim do swing
const float GIRO_PICO_MIN    = 12.0;  // rad/s — pico mínimo para contar como golpe
const float GIRO_FORCA_MEDIA = 18.0;  // rad/s — a partir daqui força 2
const float GIRO_FORCA_ALTA  = 25.0;  // rad/s — a partir daqui força 3
const unsigned long DURACAO_MIN_MS = 60;
const unsigned long DURACAO_MAX_MS = 600;   // rotações longas (girar a raquete na mão) são descartadas
const unsigned long REFRATARIO_MS  = 400;   // evita contar o mesmo golpe duas vezes
// Sentido da rotação no eixo Z que corresponde ao forehand. Depende da mão do
// jogador e de como o sensor está preso: se FH/BH saírem trocados, troque para -1.
const int8_t SINAL_FOREHAND = 1;

// ---------------- Estado ----------------
enum Estado { AGUARDANDO, COLETANDO, PAUSADO, PARADO };
Estado estado = AGUARDANDO;
bool publicarEstadoPendente = true;
bool debugAtivo = false;
bool sensorOk = false;

Adafruit_MPU6050 mpu;
unsigned long lastSampleMicros = 0;
uint8_t contadorDebug = 0;
uint16_t seq = 0;

bool emGolpe = false;
unsigned long inicioGolpeMs = 0;
unsigned long ultimoGolpeMs = 0;
float picoGiro = 0, picoAcel = 0, somaGz = 0;

unsigned long ledDesligarEm = 0;
unsigned long ultimoErroSensorMs = 0;

String bufferSerial;
String comandoBle;
bool comandoBlePendente = false;

BLEService imuService(SERVICE_UUID);
BLEStringCharacteristic dadosChar(CHAR_DADOS_UUID, BLERead | BLENotify, MAX_MSG);
BLEStringCharacteristic cmdChar(CHAR_CMD_UUID, BLEWrite | BLEWriteWithoutResponse, MAX_MSG);

const char* nomeEstado(Estado e) {
  switch (e) {
    case AGUARDANDO: return "AGUARDANDO";
    case COLETANDO:  return "COLETANDO";
    case PAUSADO:    return "PAUSADO";
    case PARADO:     return "PARADO";
  }
  return "?";
}

void publicar(const char* msg) {
  Serial.println(msg);
  if (BLE.connected()) {
    dadosChar.writeValue(msg);
  }
}

void mudarEstado(Estado novo) {
  if (novo != estado) {
    estado = novo;
    emGolpe = false;
  }
  publicarEstadoPendente = true;  // todo comando recebe um E: de confirmação
}

void desligarFeedback() {
  digitalWrite(LED_PIN, LOW);
  ledDesligarEm = 0;
  noTone(BUZZER_PIN);
}

// Feedback local imediato: não depende da rede.
void feedbackGolpe(int forca) {
  digitalWrite(LED_PIN, HIGH);
  ledDesligarEm = millis() + 120;
  const unsigned int freq = forca == 3 ? 2400 : forca == 2 ? 1800 : 1200;
  tone(BUZZER_PIN, freq, 80);
}

void processarComando(String cmd) {
  cmd.trim();
  cmd.toUpperCase();
  if (cmd.length() == 0) return;

  if (cmd == "START") {
    if (!sensorOk) {
      publicar("ERR:MPU");
      publicarEstadoPendente = true;
      return;
    }
    ultimoGolpeMs = 0;
    mudarEstado(COLETANDO);
  } else if (cmd == "PAUSE") {
    mudarEstado(estado == COLETANDO ? PAUSADO : estado);
  } else if (cmd == "RESUME") {
    mudarEstado(estado == PAUSADO ? COLETANDO : estado);
  } else if (cmd == "STOP") {
    desligarFeedback();
    mudarEstado(PARADO);
  } else if (cmd == "PING") {
    publicarEstadoPendente = true;
    if (!sensorOk) publicar("ERR:MPU");
  } else if (cmd == "DBG:0" || cmd == "DBG:1") {
    debugAtivo = cmd.endsWith("1");
    publicarEstadoPendente = true;
  } else {
    char msg[MAX_MSG + 1];
    snprintf(msg, sizeof(msg), "ERR:%s", cmd.c_str());  // trunca em 20 bytes
    publicar(msg);
  }
}

// ---------------- Callbacks BLE ----------------
void aoConectar(BLEDevice central) {
  Serial.print("Conectado ao central: ");
  Serial.println(central.address());
  publicarEstadoPendente = true;
}

void aoDesconectar(BLEDevice central) {
  Serial.println("Central desconectado. Reiniciando advertising...");
  desligarFeedback();
  debugAtivo = false;
  estado = AGUARDANDO;
  emGolpe = false;
  publicarEstadoPendente = true;
  BLE.advertise();
}

// O callback roda dentro do BLE.poll(); o comando é processado no loop para
// não escrever na característica de dentro da pilha de eventos.
void aoReceberComando(BLEDevice central, BLECharacteristic characteristic) {
  comandoBle = cmdChar.value();
  comandoBlePendente = true;
}

// ---------------- Detecção ----------------
void detectarGolpe(float giro, float acelG, float gz, unsigned long agoraMs) {
  if (!emGolpe) {
    if (giro >= GIRO_INICIO && agoraMs - ultimoGolpeMs >= REFRATARIO_MS) {
      emGolpe = true;
      inicioGolpeMs = agoraMs;
      picoGiro = giro;
      picoAcel = acelG;
      somaGz = gz;
    }
    return;
  }

  if (giro > picoGiro) picoGiro = giro;
  if (acelG > picoAcel) picoAcel = acelG;
  somaGz += gz;

  const unsigned long duracao = agoraMs - inicioGolpeMs;
  if (giro >= GIRO_FIM && duracao <= DURACAO_MAX_MS) return;  // swing ainda em andamento

  emGolpe = false;
  if (duracao < DURACAO_MIN_MS || duracao > DURACAO_MAX_MS || picoGiro < GIRO_PICO_MIN) return;

  ultimoGolpeMs = agoraMs;
  seq = seq >= 9999 ? 1 : seq + 1;
  const char lado = (somaGz * SINAL_FOREHAND >= 0) ? 'F' : 'B';
  const int forca = picoGiro >= GIRO_FORCA_ALTA ? 3 : picoGiro >= GIRO_FORCA_MEDIA ? 2 : 1;

  feedbackGolpe(forca);

  // Magnitudes ficam abaixo de 100 (16 g e 34,9 rad/s por eixo), então cada valor
  // ocupa no máximo 4 caracteres e a mensagem inteira no máximo 20 bytes.
  char msg[MAX_MSG + 1];
  snprintf(msg, sizeof(msg), "S:%c,%.1f,%.1f,%d,%u", lado,
           min(picoAcel, 99.9f), min(picoGiro, 99.9f), forca, seq);
  publicar(msg);
}

void publicarDebug(const sensors_event_t& a, const sensors_event_t& g) {
  char msg[MAX_MSG + 1];
  snprintf(msg, sizeof(msg), "A:%.1f,%.1f,%.1f",
           a.acceleration.x / SENSORS_GRAVITY_STANDARD,
           a.acceleration.y / SENSORS_GRAVITY_STANDARD,
           a.acceleration.z / SENSORS_GRAVITY_STANDARD);
  publicar(msg);
  snprintf(msg, sizeof(msg), "G:%.1f,%.1f,%.1f", g.gyro.x, g.gyro.y, g.gyro.z);
  publicar(msg);
}

void lerSerial() {
  while (Serial.available()) {
    const char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (bufferSerial.length() > 0) {
        processarComando(bufferSerial);
        bufferSerial = "";
      }
    } else if (bufferSerial.length() < MAX_MSG) {
      bufferSerial += c;
    }
  }
}

void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 3000);

  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  Wire.begin();
  Wire.setClock(400000);

  // Sem o sensor, o BLE sobe mesmo assim para o app conseguir mostrar "ERR:MPU".
  sensorOk = mpu.begin(0x68, &Wire);
  if (sensorOk) {
    mpu.setAccelerometerRange(MPU6050_RANGE_16_G);
    mpu.setGyroRange(MPU6050_RANGE_2000_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_44_HZ);
  } else {
    Serial.println("ERR:MPU (MPU-6050 nao encontrado — confira SDA/SCL/VCC/GND)");
  }

  if (!BLE.begin()) {
    Serial.println("ERRO: Falha ao iniciar BLE!");
    while (1) delay(10);
  }

  BLE.setLocalName("ArduinoR4-IMU");
  BLE.setDeviceName("ArduinoR4-IMU");
  BLE.setAdvertisedService(imuService);

  imuService.addCharacteristic(dadosChar);
  imuService.addCharacteristic(cmdChar);
  BLE.addService(imuService);

  BLE.setEventHandler(BLEConnected, aoConectar);
  BLE.setEventHandler(BLEDisconnected, aoDesconectar);
  cmdChar.setEventHandler(BLEWritten, aoReceberComando);

  dadosChar.writeValue("E:AGUARDANDO");

  BLE.advertise();
  Serial.println("BLE ativo e pronto para pareamento!");
  lastSampleMicros = micros();
}

void loop() {
  BLE.poll();
  lerSerial();

  if (comandoBlePendente) {
    comandoBlePendente = false;
    processarComando(comandoBle);
  }

  if (publicarEstadoPendente) {
    publicarEstadoPendente = false;
    char msg[MAX_MSG + 1];
    snprintf(msg, sizeof(msg), "E:%s", nomeEstado(estado));
    publicar(msg);
  }

  if (ledDesligarEm != 0 && millis() >= ledDesligarEm) {
    digitalWrite(LED_PIN, LOW);
    ledDesligarEm = 0;
  }

  if (!sensorOk) {
    if (BLE.connected() && millis() - ultimoErroSensorMs > 3000) {
      ultimoErroSensorMs = millis();
      publicar("ERR:MPU");
    }
    return;
  }

  const unsigned long currentMicros = micros();
  if (currentMicros - lastSampleMicros < PERIODO_AMOSTRA_US) return;

  lastSampleMicros += PERIODO_AMOSTRA_US;
  // Se o loop atrasou muito (ex.: BLE ocupado), não tenta "recuperar" em rajada.
  if (currentMicros - lastSampleMicros > 5 * PERIODO_AMOSTRA_US) {
    lastSampleMicros = currentMicros;
  }

  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  const float giro = sqrt(g.gyro.x * g.gyro.x + g.gyro.y * g.gyro.y + g.gyro.z * g.gyro.z);
  const float acelG = sqrt(a.acceleration.x * a.acceleration.x +
                           a.acceleration.y * a.acceleration.y +
                           a.acceleration.z * a.acceleration.z) / SENSORS_GRAVITY_STANDARD;

  if (estado == COLETANDO) {
    detectarGolpe(giro, acelG, g.gyro.z, millis());
  }

  if (debugAtivo && ++contadorDebug >= DIVISOR_DEBUG) {
    contadorDebug = 0;
    publicarDebug(a, g);
  }
}


Entrega - projeto
Docs

/*
 * Tennis Analytics - Leitura do MPU6050 (protótipo Wokwi)
 * Placa: ESP32-C3  |  Sensor: MPU6050 via I2C
 * Entrega 1 - Sistemas Embarcados e Robotica
 *
 * Placa: ESP32-C3 SuperMini  |  Sensor: MPU6050 (I2C)
 * Simulacao: https://wokwi.com/projects/475019008269947905
 *
 * ESCOPO DESTA VERSAO
 *   - Utilizacao da biblioteca Adafruit para gerencia do MPU6050 via I2C.
 *   - Escala do acelerometro em +-16 g e do giroscopio em +-2000 dps.
 *   - Maquina de estados de deteccao de tacada:
 *       PARADO -> PREPARACAO -> IMPACTO -> RECUPERACAO -> PARADO
 *   - Saida formatada no Monitor Serial (115200 baud) para o relatorio.
 */

#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>

Adafruit_MPU6050 mpu;

// ---------- Estados da máquina ----------
enum EstadoTacada {
  PARADO,
  PREPARACAO,
  IMPACTO,
  RECUPERACAO
};

EstadoTacada estadoAtual = PARADO;

// ---------- Limiares (AJUSTE conforme calibração) ----------
const float LIMIAR_GIRO_PREPARACAO      = 1.5;   // rad/s  - rotação que indica início do movimento
const float LIMIAR_ACEL_IMPACTO         = 20.0;  // m/s²   - pico de aceleração no momento da batida
const float LIMIAR_ACEL_ESTAVEL         = 12.0;  // m/s²   - "quase parado de novo" (perto da gravidade ~9.8)
const unsigned long TIMEOUT_PREPARACAO      = 1000; // ms - se preparar e não bater, cancela
const unsigned long TEMPO_ESTAVEL_RECUPERACAO = 150; // ms - tempo estável pra confirmar fim do golpe
const unsigned long TIMEOUT_RECUPERACAO_SEG  = 2000; // ms - trava de segurança pra não ficar preso no estado

unsigned long marcaTempo = 0;
unsigned long tempoEstavelDesde = 0;

// Dados guardados no instante do impacto, usados pra classificar
float accelZ_noImpacto = 0;
float giroZ_noImpacto  = 0;

void setup() {
  Serial.begin(115200);
  while (!Serial) {
    delay(10);
  }

  Serial.println("Iniciando MPU6050...");

  if (!mpu.begin()) {
    Serial.println("ERRO: não encontrou o MPU6050. Confira os fios!");
    while (1) {
      delay(10);
    }
  }

  Serial.println("MPU6050 conectado com sucesso!");

  mpu.setAccelerometerRange(MPU6050_RANGE_16_G);
  mpu.setGyroRange(MPU6050_RANGE_2000_DEG); // Corrigido para +-2000 dps conforme escopo
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  delay(100);
  Serial.println("Máquina de estados pronta. Balance a raquete pra testar!");
}

void loop() {
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  float accelMag = sqrt(a.acceleration.x * a.acceleration.x +
                        a.acceleration.y * a.acceleration.y +
                        a.acceleration.z * a.acceleration.z);

  float giroMag = sqrt(g.gyro.x * g.gyro.x +
                       g.gyro.y * g.gyro.y +
                       g.gyro.z * g.gyro.z);

  unsigned long agora = millis();

  switch (estadoAtual) {

    case PARADO:
      if (giroMag > LIMIAR_GIRO_PREPARACAO) {
        estadoAtual = PREPARACAO;
        marcaTempo = agora;
        Serial.println(">> PREPARACAO (rotação detectada)");
      }
      break;

    case PREPARACAO:
      if (accelMag > LIMIAR_ACEL_IMPACTO) {
        // Guarda os dados do instante do golpe ANTES de mudar de estado
        accelZ_noImpacto = a.acceleration.z;
        giroZ_noImpacto  = g.gyro.z;

        estadoAtual = IMPACTO;
        marcaTempo = agora;
        classificarTacada();
      } else if (agora - marcaTempo > TIMEOUT_PREPARACAO) {
        // Girou mas não bateu a tempo -> cancela e volta
        estadoAtual = PARADO;
        Serial.println(">> Cancelado (girou mas não impactou), voltando pro PARADO");
      }
      break;

    case IMPACTO:
      // Estado é só um "flash" -- já emenda pra recuperação
      estadoAtual = RECUPERACAO;
      marcaTempo = agora;
      tempoEstavelDesde = 0;
      break;

    case RECUPERACAO:
      if (accelMag < LIMIAR_ACEL_ESTAVEL) {
        if (tempoEstavelDesde == 0) {
          tempoEstavelDesde = agora;
        } else if (agora - tempoEstavelDesde > TEMPO_ESTAVEL_RECUPERACAO) {
          estadoAtual = PARADO;
          Serial.println(">> PARADO (pronto pra próxima tacada)\n");
        }
      } else {
        tempoEstavelDesde = 0; // ainda balançando muito, reseta a contagem
      }

      // Trava de segurança: nunca fica preso indefinidamente num estado
      if (agora - marcaTempo > TIMEOUT_RECUPERACAO_SEG) {
        estadoAtual = PARADO;
      }
      break;
  }

  // Leitura contínua a ~100 Hz para não perder o pico do impacto
  delay(10); 
}

void classificarTacada() {
  Serial.print(">> TACADA DETECTADA!  accelZ=");
  Serial.print(accelZ_noImpacto);
  Serial.print("  giroZ=");
  Serial.print(giroZ_noImpacto);

  String tipo;
  if (accelZ_noImpacto < 3.0) {
    tipo = "SAQUE";
  } else if (giroZ_noImpacto > 0) {
    tipo = "FOREHAND";
  } else {
    tipo = "BACKHAND";
  }

  Serial.print("  => Tipo: ");
  Serial.println(tipo);
}
Simulation
INT AD0 XCL XDA SDA SCL GND VCC

// Modelo da chave do dispositivo. Copie para segredo.h (que fica fora do git) e troque os
// 16 bytes por valores aleatórios, por exemplo os gerados por:
//   node -e "console.log(require('crypto').randomBytes(16).toString('hex').toUpperCase())"
// A mesma chave (32 hex) é cadastrada no app ao registrar a raquete.
// Esta chave de exemplo é pública: o firmware avisa na serial e o app a recusa.
#pragma once
#include <stdint.h>

static const uint8_t CHAVE_DISPOSITIVO[16] = {
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
  0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F
};

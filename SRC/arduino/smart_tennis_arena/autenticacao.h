// Autenticação do canal BLE por desafio e resposta (RNF Cibersegurança do IoT).
//
//   app   -> placa  CH:<Na>            Na = 8 hex aleatórios do app
//   placa -> app    CR:<Nb><PB>        Nb = 8 hex aleatórios da placa; PB = prova da placa
//   app   -> placa  PA:<PA>            só se PB conferir (a placa prova primeiro)
//   placa -> app    V:<versão>         autenticado
//
//   PB/PA = 4 primeiros bytes de HMAC-SHA256(chave, "B"|"A" + Na + Nb), em hex maiúsculo.
//
// A chave nunca trafega. Cada desafio aceita uma única prova (uma prova capturada não serve
// para outra conexão). 3 provas erradas derrubam a conexão e bloqueiam desafios por 30 s.
// Não depende do Arduino: os testes em teste_pc/ compilam este mesmo arquivo no PC.
#pragma once
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include "hmac_sha256.h"

#define FIRMWARE_VERSAO "1.1.0"

struct RespostaAuth {
  char msg[21];      // mensagem a publicar (cabe nos 20 bytes do BLE)
  bool desconectar;  // derrubar a conexão (força bruta)
};

class Autenticacao {
 public:
  static const uint8_t MAX_TENTATIVAS = 3;
  static const uint32_t BLOQUEIO_MS = 30000;

  explicit Autenticacao(const uint8_t* chave16) : chave(chave16) { reiniciar(); }

  bool autenticado() const { return estaAutenticado; }

  /** Nova conexão ou queda: desfaz a autenticação. Tentativas e bloqueio continuam valendo. */
  void reiniciar() {
    estaAutenticado = false;
    temDesafio = false;
  }

  /** Pela porta serial (acesso físico) tudo é aceito; pelo BLE, só PING, CH: e PA: antes de autenticar. */
  bool comandoPermitido(const char* cmd, bool viaBle) const {
    if (!viaBle || estaAutenticado) return true;
    return strcmp(cmd, "PING") == 0 || strncmp(cmd, "CH:", 3) == 0 || strncmp(cmd, "PA:", 3) == 0;
  }

  /** na: desafio do app; nb: desafio novo, gerado pela placa para esta tentativa. */
  RespostaAuth desafio(const char* na, const char* nb, unsigned long agoraMs) {
    if (bloqueado((uint32_t)agoraMs)) return resposta("ERR:BLOQ");
    if (!hex8(na) || !hex8(nb)) return resposta("ERR:AUTH");
    maiusculas(na, desafioApp);
    maiusculas(nb, desafioPlaca);
    temDesafio = true;
    char pb[9];
    calcularProva(chave, 'B', desafioApp, desafioPlaca, pb);
    RespostaAuth r = resposta("");
    snprintf(r.msg, sizeof(r.msg), "CR:%s%s", desafioPlaca, pb);
    return r;
  }

  RespostaAuth prova(const char* pa, unsigned long agoraMs) {
    if (bloqueado((uint32_t)agoraMs)) return resposta("ERR:BLOQ");
    if (!temDesafio || !hex8(pa)) return resposta("ERR:AUTH");
    temDesafio = false;  // uma prova por desafio, certa ou errada

    char esperado[9], recebido[9];
    calcularProva(chave, 'A', desafioApp, desafioPlaca, esperado);
    maiusculas(pa, recebido);
    if (cripto::iguaisTempoConstante((const uint8_t*)recebido, (const uint8_t*)esperado, 8)) {
      estaAutenticado = true;
      tentativas = 0;
      return resposta("V:" FIRMWARE_VERSAO);
    }
    if (++tentativas >= MAX_TENTATIVAS) {
      tentativas = 0;
      bloqueioAtivo = true;
      bloqueadoAte = (uint32_t)agoraMs + BLOQUEIO_MS;
      RespostaAuth r = resposta("ERR:BLOQ");
      r.desconectar = true;
      return r;
    }
    return resposta("ERR:AUTH");
  }

  static void calcularProva(const uint8_t* chave, char papel, const char* na, const char* nb, char saida[9]) {
    uint8_t msg[17];
    msg[0] = (uint8_t)papel;
    memcpy(msg + 1, na, 8);
    memcpy(msg + 9, nb, 8);
    uint8_t mac[32];
    cripto::hmacSha256(chave, 16, msg, sizeof(msg), mac);
    for (int i = 0; i < 4; i++) snprintf(saida + i * 2, 3, "%02X", mac[i]);
  }

 private:
  const uint8_t* chave;
  bool estaAutenticado = false;
  bool temDesafio = false;
  char desafioApp[9] = {0};
  char desafioPlaca[9] = {0};
  uint8_t tentativas = 0;
  bool bloqueioAtivo = false;
  uint32_t bloqueadoAte = 0;

  // Diferença sem sinal: continua certa quando millis() dá a volta (~49 dias).
  bool bloqueado(uint32_t agora) {
    if (bloqueioAtivo && (int32_t)(bloqueadoAte - agora) <= 0) bloqueioAtivo = false;
    return bloqueioAtivo;
  }

  static bool hex8(const char* s) {
    if (strlen(s) != 8) return false;
    for (int i = 0; i < 8; i++) {
      const char c = s[i];
      if (!((c >= '0' && c <= '9') || (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f'))) return false;
    }
    return true;
  }

  static void maiusculas(const char* s, char saida[9]) {
    for (int i = 0; i < 8; i++) saida[i] = (s[i] >= 'a' && s[i] <= 'f') ? s[i] - 32 : s[i];
    saida[8] = '\0';
  }

  static RespostaAuth resposta(const char* msg) {
    RespostaAuth r;
    snprintf(r.msg, sizeof(r.msg), "%s", msg);
    r.desconectar = false;
    return r;
  }
};

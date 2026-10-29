// Testes da autenticação BLE do firmware, rodando no PC (sem a placa).
// Compila exatamente os mesmos cabeçalhos usados pelo tennis_imu.ino.
//   zig c++ -std=c++17 -Wall -Werror teste_autenticacao.cpp -o teste && ./teste
#include <stdio.h>
#include <string.h>
#include "../autenticacao.h"

static int falhas = 0, total = 0;
#define CHECK(cond, nome)                                   \
  do {                                                      \
    total++;                                                \
    if (cond) printf("ok    %s\n", nome);                   \
    else { falhas++; printf("FALHA %s\n", nome); }          \
  } while (0)

static void hex(const uint8_t* b, size_t n, char* out) {
  for (size_t i = 0; i < n; i++) sprintf(out + i * 2, "%02X", b[i]);
}

static const uint8_t CHAVE[16] = {0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
                                  0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F};

int main() {
  char saida[65];
  uint8_t d[32];

  // Primitivas contra vetores oficiais.
  cripto::sha256((const uint8_t*)"abc", 3, d); hex(d, 32, saida);
  CHECK(strcmp(saida, "BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD") == 0, "SHA-256 FIPS 180-4 'abc'");
  cripto::sha256((const uint8_t*)"", 0, d); hex(d, 32, saida);
  CHECK(strcmp(saida, "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855") == 0, "SHA-256 FIPS 180-4 vazio");
  uint8_t k1[20]; memset(k1, 0x0b, 20);
  cripto::hmacSha256(k1, 20, (const uint8_t*)"Hi There", 8, d); hex(d, 32, saida);
  CHECK(strcmp(saida, "B0344C61D8DB38535CA8AFCEAF0BF12B881DC200C9833DA726E9376C2E32CFF7") == 0, "HMAC-SHA256 RFC 4231 caso 1");
  cripto::hmacSha256((const uint8_t*)"Jefe", 4, (const uint8_t*)"what do ya want for nothing?", 28, d); hex(d, 32, saida);
  CHECK(strcmp(saida, "5BDCC146BF60754E6A042426089575C75A003F089D2739839DEC58B964EC3843") == 0, "HMAC-SHA256 RFC 4231 caso 2");
  CHECK(cripto::iguaisTempoConstante((const uint8_t*)"abcd", (const uint8_t*)"abcd", 4) &&
        !cripto::iguaisTempoConstante((const uint8_t*)"abcd", (const uint8_t*)"abce", 4), "comparação em tempo constante");

  // Vetor compartilhado com o app (SRC/app/src/ble/hmac.test.ts).
  char p[9];
  Autenticacao::calcularProva(CHAVE, 'B', "1A2B3C4D", "9F8E7D6C", p);
  CHECK(strcmp(p, "BF55C708") == 0, "prova da placa (B) igual à calculada pelo app (vetor compartilhado)");
  Autenticacao::calcularProva(CHAVE, 'A', "1A2B3C4D", "9F8E7D6C", p);
  CHECK(strcmp(p, "83E700B5") == 0, "prova do app (A) igual à calculada pelo app (vetor compartilhado)");

  // Antes de autenticar, pelo BLE só passam PING, CH: e PA:.
  Autenticacao a(CHAVE);
  CHECK(!a.autenticado(), "começa sem autenticação");
  CHECK(!a.comandoPermitido("START", true) && !a.comandoPermitido("STOP", true) && !a.comandoPermitido("DBG:1", true) &&
        !a.comandoPermitido("FB:1", true), "sem autenticação: START, STOP, DBG:1 e FB recusados pelo BLE");
  CHECK(a.comandoPermitido("PING", true) && a.comandoPermitido("CH:1A2B3C4D", true) && a.comandoPermitido("PA:00000000", true),
        "sem autenticação: PING, CH: e PA: aceitos");
  CHECK(a.comandoPermitido("START", false), "porta serial não exige autenticação (acesso físico)");
  CHECK(!a.comandoPermitido("AUTH:SEGREDO", true), "não existe token em texto claro");

  // Fluxo normal.
  RespostaAuth r = a.desafio("1A2B3C4D", "9F8E7D6C", 1000);
  CHECK(strcmp(r.msg, "CR:9F8E7D6CBF55C708") == 0 && strlen(r.msg) <= 20, "CR traz Nb + prova da placa e cabe em 20 bytes");
  r = a.prova("83E700B5", 1100);
  CHECK(a.autenticado() && strcmp(r.msg, "V:" FIRMWARE_VERSAO) == 0, "prova correta autentica e publica a versão do firmware");
  CHECK(a.comandoPermitido("START", true), "autenticado: START aceito");

  // Queda de conexão desfaz a autenticação.
  a.reiniciar();
  CHECK(!a.autenticado() && !a.comandoPermitido("START", true), "queda da conexão desfaz a autenticação");

  // Replay: prova capturada da conexão anterior não vale para um novo Nb.
  a.desafio("1A2B3C4D", "11111111", 2000);
  r = a.prova("83E700B5", 2100);
  CHECK(!a.autenticado() && strcmp(r.msg, "ERR:AUTH") == 0, "prova capturada da conexão anterior é recusada (replay)");

  // Uma prova por desafio.
  Autenticacao b(CHAVE);
  b.desafio("1A2B3C4D", "9F8E7D6C", 0);
  b.prova("00000000", 10);
  r = b.prova("83E700B5", 20);
  CHECK(!b.autenticado() && strcmp(r.msg, "ERR:AUTH") == 0, "cada desafio aceita uma única prova");

  Autenticacao c(CHAVE);
  r = c.prova("83E700B5", 0);
  CHECK(strcmp(r.msg, "ERR:AUTH") == 0, "PA sem desafio é recusado");
  r = c.desafio("1A2B3C", "9F8E7D6C", 0);
  CHECK(strcmp(r.msg, "ERR:AUTH") == 0, "desafio malformado (curto) é recusado");
  r = c.desafio("1A2B3C4G", "9F8E7D6C", 0);
  CHECK(strcmp(r.msg, "ERR:AUTH") == 0, "desafio malformado (não hex) é recusado");
  r = c.desafio("1a2b3c4d", "9F8E7D6C", 0);
  CHECK(strcmp(r.msg, "CR:9F8E7D6CBF55C708") == 0, "desafio em minúsculas é aceito");
  c.prova("83e700b5", 10);
  CHECK(c.autenticado(), "prova em minúsculas é aceita");

  // Força bruta: 3 provas erradas derrubam a conexão e bloqueiam por 30 s.
  Autenticacao f(CHAVE);
  bool derrubou = false;
  for (int i = 0; i < 3; i++) {
    f.desafio("1A2B3C4D", "9F8E7D6C", 1000);
    r = f.prova("00000000", 1000);
    derrubou = r.desconectar;
  }
  CHECK(derrubou && strcmp(r.msg, "ERR:BLOQ") == 0, "3 provas erradas derrubam a conexão");
  f.reiniciar();
  r = f.desafio("1A2B3C4D", "9F8E7D6C", 1000 + 29999);
  CHECK(strcmp(r.msg, "ERR:BLOQ") == 0, "durante o bloqueio de 30 s, nenhum desafio é aceito (nem após reconectar)");
  r = f.desafio("1A2B3C4D", "9F8E7D6C", 1000 + 30000);
  CHECK(strncmp(r.msg, "CR:", 3) == 0, "depois de 30 s volta a aceitar desafios");

  // Bloqueio funciona mesmo quando millis() dá a volta (~49 dias).
  Autenticacao g(CHAVE);
  const unsigned long quase = 0xFFFFFFFFUL - 1000;
  for (int i = 0; i < 3; i++) { g.desafio("1A2B3C4D", "9F8E7D6C", quase); g.prova("00000000", quase); }
  r = g.desafio("1A2B3C4D", "9F8E7D6C", 5000);  // 6 s depois, já com millis() reiniciado
  CHECK(strcmp(r.msg, "ERR:BLOQ") == 0, "bloqueio respeita a volta do millis()");

  printf("%d testes, %d falhas\n", total, falhas);
  return falhas == 0 ? 0 : 1;
}

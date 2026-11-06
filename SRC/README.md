# Entregas do PI
### **DECLARAÇÃO DE USO DE INTELIGÊNCIA ARTIFICIAL**

## Entrega 1
<br><br>

### Módulo do sistema 1 — Protótipo do sensor da raquete (Wokwi)

| **Aluno(s) Responsável(veis)** | Daniel Kyoshi Moribe, Leonardo Santos da Silva, Lucas de Lima Gutierrez e Vitor Kenzo Kanashiro |
| :--- | :--- |
| **Ferramenta utilizada** | Claude |
| **Versão/modelo** | Claude Opus 5.5 |
| **Disciplina / Trabalho** | Sistemas Embarcados e Robótica / Projeto Interdisciplinar, Entrega 1 |
| **Finalidade de uso** | Base do sketch de leitura do MPU6050 e da máquina de estados de detecção de tacada |
| ***Prompts* principais utilizados** | 1) "Crie um sketch para ESP32-C3 no Wokwi que leia um MPU6050 por I2C com a biblioteca Adafruit_MPU6050, configure ±16 g e ±2000 dps e imprima os dados no Monitor Serial a 115200 baud."<br>2) "Implemente uma máquina de estados para detectar uma tacada com os estados PARADO, PREPARACAO, IMPACTO e RECUPERACAO, usando limiar de giroscópio para o início do movimento e limiar de aceleração para o impacto."<br>3) "Deixe os limiares como constantes no topo do arquivo, com comentário dizendo que devem ser calibrados." |
| **Trechos ou entregas afetadas** | `Documentos/Entrega01/Sistemas Embarcados e Robótica/Protótipo/sketch.ino` (commit `bfbf1e5`) |


### Módulo do sistema 2 — Interface inicial do aplicativo mobile (`SRC/app`)

| **Aluno(s) Responsável(veis)** | Daniel Kyoshi Moribe, Leonardo Santos da Silva, Lucas de Lima Gutierrez e Vitor Kenzo Kanashiro |
| :--- | :--- |
| **Ferramenta utilizada** | Claude |
| **Versão/modelo** | Claude Opus 5.5 |
| **Disciplina / Trabalho** | Projeto Interdisciplinar: IoT e Robótica, Entrega 1 |
| **Finalidade de uso** | Prototipar as telas e os fluxos principais do aplicativo (login, catálogo, pareamento, execução da sessão, parada segura, resultado, histórico e perfil), com navegação, tema visual e componentes reutilizáveis |
| ***Prompts* principais utilizados** | 1) "Crie um app em React Native com Expo e TypeScript para o Tennis Analytics, com tema escuro, verde-limão como cor principal e a fonte Barlow. Monte a navegação com as telas Login, Início, Catálogo de treinos, Pareamento da raquete, Preparação, Sessão, Resultado, Histórico e Perfil."<br>2) "Na tela de Sessão, mostre a etapa atual, o tempo, a pontuação e as metas, com botões de pausar, retomar e encerrar. Inclua um botão de emergência que leve a uma tela de Parada Segura."<br>3) "Use dados de exemplo locais no catálogo e no histórico, sem backend por enquanto, e crie componentes reutilizáveis: botões, cartões, ícones, marca d'água e uma bola de tênis animada." |
| **Trechos ou entregas afetadas** | Documento do projeto, item 9 ("Protótipos das interfaces e fluxos principais do aplicativo e do site") e telas dos requisitos RF01, RF03 a RF06, RF12, RF13 e RF22. No repositório: `SRC/app/App.tsx`, `SRC/app/src/screens/`, `SRC/app/src/navigation/`, `SRC/app/src/theme/` e `SRC/app/src/components/` (commit `889feee`) |


### Módulo do sistema 3 — Modelagem e planejamento do sistema

| **Aluno(s) Responsável(veis)** | Daniel Kyoshi Moribe, Leonardo Santos da Silva, Lucas de Lima Gutierrez e Vitor Kenzo Kanashiro |
| :--- | :--- |
| **Ferramenta utilizada** | Claude |
| **Versão/modelo** | Claude Opus 5.5 |
| **Disciplina / Trabalho** | Teoria da Computação e Linguagens Formais; Projeto Interdisciplinar: IoT e Robótica; Redes de Computadores e Cibersegurança. Entrega 1 |
| **Finalidade de uso** | Apoio na estruturação e na redação da modelagem formal da detecção de tacadas, da proposta técnica do dispositivo IoT e do plano de gerenciamento de riscos |
| ***Prompts* principais utilizados** | 1) "Modele a detecção de tacadas da raquete como um autômato finito determinístico com os estados REPOUSO, PREPARACAO, IMPACTO, VALIDACAO e RECUPERACAO. Defina o alfabeto de eventos, a função de transição, a tabela de transições e o diagrama de estados."<br>2) "A partir desse autômato, escreva a linguagem reconhecida, uma expressão regular equivalente e uma gramática regular que gere as sequências válidas. Justifique como cada elemento corresponde ao funcionamento do firmware."<br>3) "Monte a proposta técnica do dispositivo: problema e público-alvo, diagrama de blocos (MPU6050 e piezo, Arduino UNO R4 WiFi, matriz de LEDs, Wi-Fi e API, aplicativo), fluxo de dados entrada → processamento → saída → registro, requisitos funcionais e não funcionais, e backlog inicial em Scrum."<br>4) "Elabore o plano de gerenciamento de riscos do projeto: identificação, análise qualitativa, respostas e monitoramento, priorizando os riscos que ameaçam o fluxo ponta a ponta." |
| **Trechos ou entregas afetadas** | Documento do projeto, item 10, Entrega 1: Teoria da Computação (identificação dos estados, eventos, diagrama de estados, tabela de transições, linguagem, expressão regular, gramática e justificativa da modelagem); Projeto Interdisciplinar (descrição técnica, diagrama de blocos, fluxo de dados, requisitos, máquina de estados e Product Backlog); Redes e Cibersegurança (relatório de vulnerabilidades do sistema). Arquivos: `Documentos/Entrega01/Teoria da Computação e Linguagens Formais/Entrega 1 Teoria da Computação.pdf`, `Documentos/Entrega01/Projeto Interdisciplinar - Internet das Coisas e Robótica/Projeto Interdisciplinar - Entrega 1.pdf` e `Documentos/Entrega01/Redes de Computadores e Cibersegurança/Entrega 1 Plano de Gerenciamento de Risco.pdf` |


## Entrega 2
<br><br>

### Módulo do sistema 1 — Aplicativo mobile (`SRC/app`)

| **Aluno(s) Responsável(veis)** | Daniel Kyoshi Moribe, Leonardo Santos da Silva, Lucas de Lima Gutierrez e Vitor Kenzo Kanashiro |
| :--- | :--- |
| **Ferramenta utilizada** | Claude |
| **Versão/modelo** | Claude Opus 5.5 |
| **Disciplina / Trabalho** | Projeto Interdisciplinar, Internet das Coisas e Robótica; Redes de Computadores e Cibersegurança (requisitos de segurança) |
| **Finalidade de uso** | Integração com a API (login, catálogo, sessões e perfil), autenticação BLE da raquete, fila offline de sessões, migração para o Expo SDK 54, testes unitários e build de preview |
| ***Prompts* principais utilizados** | 1) "Integre o app à API: login com access token de 15 min, refresh token guardado no SecureStore, renovação única por vez no cliente HTTP e catálogo com cache por ETag."<br>2) "Implemente autenticação por desafio e resposta no BLE da raquete: o app recebe o desafio, calcula HMAC-SHA256 com a chave de 16 bytes e responde. Antes de autenticar, só PING, CH: e PA: podem passar. Escreva os testes com o vetor da RFC 4231."<br>3) "Crie uma fila offline de sessões que envie tudo para /sessoes/sincronizar ao voltar a rede, com UUID gerado no app para que o reenvio não duplique."<br>4) "Atualize o app para o Expo SDK 54 e verifique o que muda no react-native-ble-plx com a New Architecture."<br>5) "Gere o perfil de preview do EAS apontando para a URL publicada da API e mostre um aviso quando a API estiver suspensa no plano free." |
| **Trechos ou entregas afetadas** | `SRC/app/src/ble/` (`autenticacao.ts`, `hmac.ts`, `protocolo.ts`), `SRC/app/src/api/cliente.ts`, `SRC/app/src/offline/filaSessoes.ts`, `SRC/app/src/auth/AuthContext.tsx`, `SRC/app/eas.json`. Commits `74ee92e`, `290e028`, `dadcbac`, `8431cad`, `38d8bf9`, `b6008ae`, `c9e0224`, `4e78792` |


### Módulo do sistema 2 — Site de autoria e administração (`SRC/site`)

| **Aluno(s) Responsável(veis)** | Daniel Kyoshi Moribe, Leonardo Santos da Silva, Lucas de Lima Gutierrez e Vitor Kenzo Kanashiro |
| :--- | :--- |
| **Ferramenta utilizada** | Claude |
| **Versão/modelo** | Claude Opus 5.5 |
| **Disciplina / Trabalho** | Projeto Interdisciplinar, Internet das Coisas e Robótica; Redes de Computadores e Cibersegurança (CSP e cabeçalhos) |
| **Finalidade de uso** | Site de autoria e administração em React e Vite, com controle de papéis, tratamento de tokens e política de segurança de conteúdo (CSP) |
| ***Prompts* principais utilizados** | 1) "Crie um site de autoria e administração em React 18, Vite e TypeScript, usando a mesma API e as mesmas contas do app. O autor cria, edita, valida, ensaia e publica treinos. O admin gerencia usuários, papéis e raquetes."<br>2) "Guarde o access token só em memória e o refresh token no sessionStorage. Não use localStorage nem cookie."<br>3) "Configure CSP sem script inline e sem terceiros: fontes servidas pelo próprio site, connect-src só para a API e frame-ancestors 'none'. Teste com vite preview."<br>4) "Aponte o site para a URL real da API no Render e ajuste a CSP no render.yaml." |
| **Trechos ou entregas afetadas** | `SRC/site/src/api/cliente.ts`, `SRC/site/src/paginas/`, `SRC/site/src/treinos/acoes.ts`, `SRC/site/README.md`. Commits `e202385`, `b6008ae`, `6a081c2` |


### Módulo do sistema 3 — API (`SRC/backend`)

| **Aluno(s) Responsável(veis)** | Daniel Kyoshi Moribe, Leonardo Santos da Silva, Lucas de Lima Gutierrez e Vitor Kenzo Kanashiro |
| :--- | :--- |
| **Ferramenta utilizada** | Claude |
| **Versão/modelo** | Claude Opus 5.5 |
| **Disciplina / Trabalho** | Projeto Interdisciplinar, Internet das Coisas e Robótica; Redes de Computadores e Cibersegurança (plano de riscos e testes de segurança) |
| **Finalidade de uso** | API NestJS com Prisma e PostgreSQL (Supabase), máquina de estados de sessão, pontuação, testes de segurança, OpenAPI e configuração de deploy no Render |
| ***Prompts* principais utilizados** | 1) "Crie uma API NestJS 11 com Prisma e PostgreSQL no Supabase, schema tennis, para autenticação, treinos, sessões e pontuação. Publique a documentação OpenAPI em /api/v1/docs."<br>2) "Implemente a máquina de estados da sessão com os comandos INICIAR, EMERGENCIA, REINICIAR e ENCERRAR. Estado PARADA_SEGURA só aceita REINICIAR com areaSegura. O servidor recalcula a pontuação e marca divergência se o app enviar outro valor."<br>3) "Escreva testes de segurança e2e que tentem força bruta, reuso de refresh token e injeção. Corrija o que os testes revelarem."<br>4) "Torne o refresh token rotativo e de uso único, e cubra isso com teste."<br>5) "Gere o render.yaml com o serviço da API e o site estático, com cabeçalhos de segurança." |
| **Trechos ou entregas afetadas** | `SRC/backend/src/sessoes/`, `SRC/backend/src/auth/`, `SRC/backend/src/pontuacao/`, `SRC/backend/test/seguranca.e2e-spec.ts`, `SRC/backend/render.yaml`. Commits `5f88e47`, `1050afe`, `48b5726`, `97b99ae`, `5e5b4a6`, `ef4783f`, `6a081c2` |


### Módulo do sistema 4 — Firmware da raquete (`SRC/arduino`)

| **Aluno(s) Responsável(veis)** | Daniel Kyoshi Moribe, Leonardo Santos da Silva, Lucas de Lima Gutierrez e Vitor Kenzo Kanashiro |
| :--- | :--- |
| **Ferramenta utilizada** | Claude |
| **Versão/modelo** | Claude Opus 5.5 |
| **Disciplina / Trabalho** | Sistemas Embarcados e Robótica / Projeto Interdisciplinar, Entrega 2 |
| **Finalidade de uso** | Firmware do Arduino UNO R4 WiFi com MPU-6050 e BLE, autenticação do canal por desafio e resposta, e testes no PC |
| ***Prompts* principais utilizados** | 1) "Escreva o firmware para Arduino UNO R4 WiFi com MPU-6050 e ArduinoBLE, enviando leituras de IMU pelo BLE com comandos START, STOP e PING."<br>2) "Adicione autenticação ao canal BLE: a placa envia um desafio aleatório e o app responde com HMAC-SHA256 usando a chave de 16 bytes guardada em segredo.h, fora do git. Três respostas erradas derrubam a conexão e bloqueiam por 30 s."<br>3) "Crie um teste que compile no PC os mesmos autenticacao.h e hmac_sha256.h. Ele deve conferir SHA-256 contra a FIPS 180-4 e HMAC contra a RFC 4231, sem precisar da placa." |
| **Trechos ou entregas afetadas** | `SRC/arduino/tennis_imu/tennis_imu.ino`, `autenticacao.h`, `hmac_sha256.h`, `teste_pc/teste_autenticacao.cpp`, `LEIAME.md`. Commits `74ee92e`, `290e028` |


***Declaro que o uso acima descrito está em conformidade com o GUIA PARA O USO RESPONSÁVEL DE
INTELIGÊNCIA ARTIFICIAL NA FECAP e que o conteúdo final é de minha plena responsabilidade
autoral.***

// Executa um comando com DATABASE_URL/DIRECT_URL apontando para o schema de teste (tennis_test).
// Uso: node scripts/com-env-teste.js npx prisma migrate deploy
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');

if (fs.existsSync('.env')) process.loadEnvFile('.env');
for (const nome of ['DATABASE_URL_TEST', 'DIRECT_URL_TEST']) {
  if (!process.env[nome]) {
    console.error(`${nome} não definida.`);
    process.exit(1);
  }
}
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.DIRECT_URL = process.env.DIRECT_URL_TEST;

const [cmd, ...args] = process.argv.slice(2);
const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', env: process.env });
process.exit(r.status ?? 1);

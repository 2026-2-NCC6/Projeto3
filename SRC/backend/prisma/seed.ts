import '../src/carregar-env';
import { PrismaClient } from '@prisma/client';
import { semear } from './semente';

// Usa DIRECT_URL (dono do schema): o seed cria dados iniciais, inclusive o admin.
async function main() {
  const { DIRECT_URL, ADMIN_EMAIL, ADMIN_SENHA } = process.env;
  if (!DIRECT_URL || !ADMIN_EMAIL || !ADMIN_SENHA) throw new Error('Defina DIRECT_URL, ADMIN_EMAIL e ADMIN_SENHA.');
  const prisma = new PrismaClient({ datasources: { db: { url: DIRECT_URL } } });
  try {
    await semear(prisma, { adminEmail: ADMIN_EMAIL, adminSenha: ADMIN_SENHA });
    console.log('Seed aplicado.');
  } finally {
    await prisma.$disconnect();
  }
}

void main();

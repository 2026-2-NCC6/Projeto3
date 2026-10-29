import { Configuracao } from './configuracao';

// S-21 (A05): a API não sobe com segredo fraco nem com o texto de exemplo do .env.example.
describe('Configuracao', () => {
  const original = { ...process.env };
  const valido = {
    JWT_SECRET: 'a'.repeat(48),
    PLATAFORMA_MAE_API_KEY: 'chave-de-teste-da-plataforma',
    METRICS_TOKEN: 'token-de-teste-das-metricas',
    CHAVE_DISPOSITIVOS: Buffer.alloc(32, 7).toString('base64'),
    PLATAFORMA_MAE_URL: 'http://localhost:3000/api/v1/mock/plataforma-mae'
  };

  beforeEach(() => {
    process.env = { ...original, ...valido };
  });
  afterAll(() => {
    process.env = original;
  });

  it('sobe com segredos válidos', () => {
    expect(() => new Configuracao()).not.toThrow();
  });

  it('recusa JWT_SECRET com menos de 32 caracteres', () => {
    process.env.JWT_SECRET = 'curto-demais';
    expect(() => new Configuracao()).toThrow(/32 caracteres/);
  });

  it('recusa o JWT_SECRET de exemplo do .env.example, que passa do tamanho mínimo', () => {
    process.env.JWT_SECRET = '<mínimo 32 caracteres aleatórios>';
    expect(() => new Configuracao()).toThrow(/valor de exemplo/);
  });

  it.each(['PLATAFORMA_MAE_API_KEY', 'METRICS_TOKEN'])('recusa %s com o valor de exemplo', (nome) => {
    process.env[nome] = '<token aleatório>';
    expect(() => new Configuracao()).toThrow(/valor de exemplo/);
  });
});

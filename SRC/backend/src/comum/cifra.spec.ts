import { randomBytes } from 'node:crypto';
import { Cifra, lerChaveMestra } from './cifra';

describe('Cifra (segredos em repouso, RNF Cibersegurança do IoT)', () => {
  const cifra = new Cifra(randomBytes(32));
  const segredo = '5F3A9C21D04E7B18A6C2E90F3D7B5A14';

  it('cifra e decifra', () => {
    const c = cifra.cifrar(segredo);
    expect(c).not.toContain(segredo);
    expect(cifra.decifrar(c)).toBe(segredo);
  });

  it('usa IV novo a cada cifragem', () => {
    expect(cifra.cifrar(segredo)).not.toBe(cifra.cifrar(segredo));
  });

  it('recusa texto adulterado (GCM autentica)', () => {
    const c = cifra.cifrar(segredo);
    const bytes = Buffer.from(c.slice(3), 'base64');
    bytes[bytes.length - 1] ^= 1;
    expect(() => cifra.decifrar(`v1:${bytes.toString('base64')}`)).toThrow();
  });

  it('recusa decifrar com outra chave mestra', () => {
    expect(() => new Cifra(randomBytes(32)).decifrar(cifra.cifrar(segredo))).toThrow();
  });

  it('lê a chave mestra em base64 ou hex e exige 32 bytes', () => {
    const k = randomBytes(32);
    expect(lerChaveMestra(k.toString('base64'))).toEqual(k);
    expect(lerChaveMestra(k.toString('hex'))).toEqual(k);
    expect(() => lerChaveMestra(randomBytes(16).toString('base64'))).toThrow();
  });
});

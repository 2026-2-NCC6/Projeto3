import { isDeepStrictEqual } from 'node:util';

/**
 * Igualdade de conteúdo JSON. O jsonb reordena chaves e objetos podem vir de realms diferentes
 * (ex.: fetch nativo vs. Prisma), então os dois lados são normalizados antes da comparação.
 */
export const mesmoJson = (a: unknown, b: unknown) => isDeepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));

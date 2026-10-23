import { ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import type { Papel } from '@prisma/client';
import type { Request } from 'express';

export type UsuarioAutenticado = { id: string; papel: Papel };

/** Quem fez a requisição e de onde: vai para a auditoria e para os logs (RF23, RNF Observabilidade). */
export type ContextoRequisicao = { usuario: UsuarioAutenticado; ip: string | null; requestId: string | null };

export type RequisicaoAutenticada = Request & { usuario?: UsuarioAutenticado; id?: string | number };

export const ROTA_PUBLICA = 'rotaPublica';
export const PAPEIS = 'papeis';

/** Rota sem autenticação JWT. O guard nega por padrão (A01). */
export const Publico = () => SetMetadata(ROTA_PUBLICA, true);
export const Papeis = (...papeis: Papel[]) => SetMetadata(PAPEIS, papeis);

export const Contexto = createParamDecorator((_: unknown, exec: ExecutionContext): ContextoRequisicao => {
  const req = exec.switchToHttp().getRequest<RequisicaoAutenticada>();
  return { usuario: req.usuario!, ip: req.ip ?? null, requestId: req.id ? String(req.id) : null };
});

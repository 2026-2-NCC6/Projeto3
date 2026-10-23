import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Papel } from '@prisma/client';
import { PAPEIS, ROTA_PUBLICA, RequisicaoAutenticada, UsuarioAutenticado } from './contexto';
import { ErroApi, proibido } from './erros';

export type PayloadAcesso = { sub: string; papel: Papel };

/** Guard global: exige JWT válido em toda rota não marcada com @Publico e confere @Papeis (RF01, A01). */
@Injectable()
export class AutenticacaoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService
  ) {}

  async canActivate(exec: ExecutionContext): Promise<boolean> {
    const alvos = [exec.getHandler(), exec.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(ROTA_PUBLICA, alvos)) return true;

    const req = exec.switchToHttp().getRequest<RequisicaoAutenticada>();
    req.usuario = await this.verificar(req.headers.authorization);

    const papeis = this.reflector.getAllAndOverride<Papel[]>(PAPEIS, alvos);
    if (papeis?.length && !papeis.includes(req.usuario.papel)) throw proibido();
    return true;
  }

  async verificar(cabecalho: string | undefined): Promise<UsuarioAutenticado> {
    const [tipo, token] = (cabecalho ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw naoAutenticado();
    return this.verificarToken(token);
  }

  verificarToken(token: string) {
    return verificarAcesso(this.jwt, token);
  }
}

/** Valida o access token (usado também no handshake do WebSocket). Só aceita HS256. */
export async function verificarAcesso(jwt: JwtService, token: string): Promise<UsuarioAutenticado> {
  try {
    const p = await jwt.verifyAsync<PayloadAcesso>(token, { algorithms: ['HS256'] });
    return { id: p.sub, papel: p.papel };
  } catch {
    throw naoAutenticado();
  }
}

const naoAutenticado = () => new ErroApi(HttpStatus.UNAUTHORIZED, 'NAO_AUTENTICADO', 'Token ausente, inválido ou expirado.');

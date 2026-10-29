import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import type { RequisicaoAutenticada } from './contexto';

const CODIGO_POR_STATUS: Record<number, string> = {
  400: 'REQUISICAO_INVALIDA',
  401: 'NAO_AUTENTICADO',
  403: 'PROIBIDO',
  404: 'NAO_ENCONTRADO',
  409: 'CONFLITO',
  422: 'REGRA_VIOLADA',
  429: 'MUITAS_REQUISICOES'
};

/** Erro 4xx do pacote http-errors (usado pelo body-parser): `expose` indica que é seguro mostrar. */
function ehErroDoCliente(erro: unknown): erro is Error & { status: number } {
  const e = erro as { status?: unknown; expose?: unknown };
  return erro instanceof Error && typeof e.status === 'number' && e.status >= 400 && e.status < 500 && e.expose === true;
}

/**
 * Formato único de erro: { statusCode, codigo, mensagem, detalhes?, requestId }.
 * Erros inesperados nunca expõem stack trace nem mensagem interna (A05).
 */
@Catch()
export class ErroFilter implements ExceptionFilter {
  private readonly log = new Logger('Erro');

  catch(erro: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<RequisicaoAutenticada>();
    const requestId = req?.id ? String(req.id) : null;
    // Exceções do gateway WebSocket não têm resposta HTTP.
    if (!res || typeof res.status !== 'function') return;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let corpo: { codigo: string; mensagem: string; detalhes?: unknown } = { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno. Informe o requestId ao suporte.' };

    if (erro instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      corpo = { codigo: 'MUITAS_REQUISICOES', mensagem: 'Muitas tentativas. Aguarde um minuto.' };
    } else if (erro instanceof HttpException) {
      status = erro.getStatus();
      const r = erro.getResponse();
      if (typeof r === 'object' && r && 'codigo' in r) {
        corpo = r as typeof corpo;
      } else {
        const msg = typeof r === 'string' ? r : (r as { message?: string | string[] }).message;
        corpo = { codigo: CODIGO_POR_STATUS[status] ?? 'ERRO', mensagem: Array.isArray(msg) ? msg.join('; ') : (msg ?? erro.message) };
      }
    } else if (ehErroDoCliente(erro)) {
      // Erros do body-parser do Express (corpo grande demais, codificação inválida) chegam aqui
      // sem passar pelo Nest; tratados como genéricos, virariam 500 e poluiriam o log.
      status = erro.status;
      corpo =
        status === HttpStatus.PAYLOAD_TOO_LARGE
          ? { codigo: 'CORPO_GRANDE_DEMAIS', mensagem: 'O corpo da requisição passa do limite de 100 KB.' }
          : { codigo: CODIGO_POR_STATUS[status] ?? 'REQUISICAO_INVALIDA', mensagem: 'Requisição inválida.' };
    } else if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
      status = HttpStatus.CONFLICT;
      corpo = { codigo: 'CONFLITO', mensagem: 'Registro já existe.' };
    } else if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2025') {
      status = HttpStatus.NOT_FOUND;
      corpo = { codigo: 'NAO_ENCONTRADO', mensagem: 'Registro não encontrado.' };
    } else {
      this.log.error({ err: erro, requestId }, 'Erro não tratado');
    }

    res.status(status).json({ statusCode: status, ...corpo, requestId });
  }
}

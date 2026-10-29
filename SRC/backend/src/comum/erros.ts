import { HttpException, HttpStatus } from '@nestjs/common';

/** Erro de negócio com código estável para o app/site tratarem: { codigo, mensagem, detalhes? }. */
export class ErroApi extends HttpException {
  constructor(status: HttpStatus, codigo: string, mensagem: string, detalhes?: unknown) {
    super({ codigo, mensagem, detalhes }, status);
  }
}

export const naoEncontrado = (o: string) => new ErroApi(HttpStatus.NOT_FOUND, 'NAO_ENCONTRADO', `${o} não encontrado.`);
export const proibido = (mensagem = 'Sem permissão para esta ação.') => new ErroApi(HttpStatus.FORBIDDEN, 'PROIBIDO', mensagem);
export const conflito = (codigo: string, mensagem: string, detalhes?: unknown) => new ErroApi(HttpStatus.CONFLICT, codigo, mensagem, detalhes);
export const invalido = (codigo: string, mensagem: string, detalhes?: unknown) =>
  new ErroApi(HttpStatus.UNPROCESSABLE_ENTITY, codigo, mensagem, detalhes);

import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { verificarAcesso } from '../comum/autenticacao.guard';
import type { UsuarioAutenticado } from '../comum/contexto';
import { PrismaService } from '../prisma/prisma.service';
import { SessoesService } from '../sessoes/sessoes.service';
import { MaquinaService } from './maquina.service';

type DadosSocket = { usuario: UsuarioAutenticado; sessoes: Set<string> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sala = (sessaoId: string) => `sessao:${sessaoId}`;

/**
 * Canal em tempo real do simulador (namespace /maquina). O app se autentica no handshake
 * (auth.token = access token), entra na sala da sessão e recebe `lancamento`, `estado` e `parada`.
 */
@WebSocketGateway({ namespace: '/maquina' })
export class MaquinaGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly log = new Logger('MaquinaGateway');
  @WebSocketServer() private server: Namespace;

  constructor(
    private readonly maquina: MaquinaService,
    private readonly sessoes: SessoesService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  afterInit() {
    this.maquina.definirEmissor((sessaoId, evento, dados) => this.server.to(sala(sessaoId)).emit(evento, dados));
  }

  async handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth as { token?: unknown })?.token;
      if (typeof token !== 'string') throw new Error('sem token');
      (client.data as DadosSocket) = { usuario: await verificarAcesso(this.jwt, token), sessoes: new Set() };
    } catch {
      client.emit('erro', { codigo: 'NAO_AUTENTICADO', mensagem: 'Token ausente, inválido ou expirado.' });
      client.disconnect(true);
    }
  }

  @SubscribeMessage('entrar')
  async entrar(@ConnectedSocket() client: Socket, @MessageBody() corpo: { sessaoId?: unknown }) {
    const dados = client.data as DadosSocket;
    const sessaoId = corpo?.sessaoId;
    if (!dados?.usuario || typeof sessaoId !== 'string' || !UUID.test(sessaoId)) return { ok: false, codigo: 'REQUISICAO_INVALIDA' };

    const sessao = await this.prisma.sessao.findUnique({ where: { id: sessaoId }, include: { praticante: { select: { contaId: true } } } });
    if (!sessao || (sessao.praticante.contaId !== dados.usuario.id && dados.usuario.papel !== 'ADMIN')) return { ok: false, codigo: 'NAO_ENCONTRADO' };

    await client.join(sala(sessaoId));
    dados.sessoes.add(sessaoId);
    return { ok: true, estado: sessao.estado };
  }

  async handleDisconnect(client: Socket) {
    const dados = client.data as DadosSocket | undefined;
    for (const sessaoId of dados?.sessoes ?? []) {
      const restantes = await this.server.in(sala(sessaoId)).fetchSockets();
      if (restantes.length === 0) {
        await this.sessoes.conexaoPerdida(sessaoId).catch((erro) => this.log.error({ err: erro, sessaoId }, 'Falha ao pausar sessão sem conexão'));
      }
    }
  }
}

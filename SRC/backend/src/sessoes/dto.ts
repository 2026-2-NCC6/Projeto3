import { OrigemSessao } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';
import { COMANDOS_USUARIO, ComandoUsuario } from './estado';

const DIA_MS = 86_400_000;

export class CriarSessaoDto {
  /** UUID gerado pelo app: permite repetir a requisição (ou criar offline) sem duplicar a sessão. */
  @IsUUID()
  id: string;

  @IsUUID()
  praticanteId: string;

  @IsString()
  @MaxLength(80)
  treinoSlug: string;

  /** Omitido: usa a versão publicada atual. */
  @IsOptional()
  @IsInt()
  @Min(1)
  versaoNumero?: number;

  /** Obrigatório quando a origem é SENSOR. */
  @IsOptional()
  @IsUUID()
  dispositivoId?: string;

  @IsEnum(OrigemSessao)
  origem: OrigemSessao;
}

export class ComandoDto {
  @IsIn(COMANDOS_USUARIO)
  comando: ComandoUsuario;

  /** Obrigatório na EMERGENCIA; vai para o registro da interrupção (RF22). */
  @IsOptional()
  @IsString()
  @Length(1, 120)
  motivo?: string;

  /** Obrigatório no REINICIAR: o praticante confirma que a área está segura. */
  @IsOptional()
  @IsBoolean()
  areaSegura?: boolean;

  /** Pontuação calculada pelo app, para detectar divergência no ENCERRAR. */
  @IsOptional()
  @IsInt()
  @Min(0)
  pontosCliente?: number;
}

export class DadosGolpeDto {
  @IsIn(['Forehand', 'Backhand'])
  lado: 'Forehand' | 'Backhand';

  @IsInt()
  @Min(1)
  @Max(3)
  forca: 1 | 2 | 3;

  @IsNumber()
  @Min(0)
  @Max(100)
  picoG: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  picoGiro: number;

  /** Sequencial do firmware (1–9999); o app já descarta duplicatas pelo seq. */
  @IsInt()
  @Min(1)
  @Max(9999)
  seq: number;

  /** Confirmação do alvo piezo, quando o treino usa o sensor. */
  @IsOptional()
  @IsBoolean()
  acertoAlvo?: boolean;
}

export class DadosErroDto {
  @Matches(/^[A-Z_]{3,40}$/)
  codigo: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  mensagem?: string;
}

export class DadosEstadoDto {
  /** Estado reportado pelo firmware (quadro BLE `E:`). */
  @IsIn(['AGUARDANDO', 'COLETANDO', 'PAUSADO', 'PARADO'])
  estado: string;
}

/** Eventos que o app pode enviar. LANCAMENTO e COMANDO são gerados só pelo servidor. */
export const TIPOS_EVENTO_CLIENTE = ['GOLPE', 'ERRO', 'ESTADO'] as const;

export class EventoDto {
  /** UUID gerado pelo app: chave de idempotência do evento. */
  @IsUUID()
  id: string;

  @IsIn(TIPOS_EVENTO_CLIENTE)
  tipo: (typeof TIPOS_EVENTO_CLIENTE)[number];

  /** Milissegundos desde o início da sessão. */
  @IsInt()
  @Min(0)
  @Max(DIA_MS)
  tMs: number;

  @Type(() => Date)
  @IsDate()
  ocorridoEm: Date;

  /** Validado conforme o tipo (DadosGolpeDto, DadosErroDto, DadosEstadoDto). */
  @IsObject()
  dados: Record<string, unknown>;
}

export class LoteEventosDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => EventoDto)
  eventos: EventoDto[];
}

export class SessaoOfflineDto {
  @IsUUID()
  id: string;

  @IsUUID()
  praticanteId: string;

  @IsString()
  @MaxLength(80)
  treinoSlug: string;

  /** Versão que o app tinha sincronizado (pode ter sido arquivada depois). */
  @IsInt()
  @Min(1)
  versaoNumero: number;

  @IsOptional()
  @IsUUID()
  dispositivoId?: string;

  @IsEnum(OrigemSessao)
  origem: OrigemSessao;

  @Type(() => Date)
  @IsDate()
  iniciadaEm: Date;

  @Type(() => Date)
  @IsDate()
  encerradaEm: Date;

  /** Preenchido se a sessão terminou por parada de emergência ou falha no app. */
  @IsOptional()
  @IsString()
  @Length(1, 120)
  motivoInterrupcao?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  pontosCliente?: number;
}

export class SincronizarDto {
  @ValidateNested()
  @Type(() => SessaoOfflineDto)
  sessao: SessaoOfflineDto;

  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => EventoDto)
  eventos: EventoDto[];
}

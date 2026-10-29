import { EstadoSessao, Papel, Severidade, StatusEnvio } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsNumber, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';

export class AtualizarUsuarioDto {
  @IsOptional()
  @IsEnum(Papel)
  papel?: Papel;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class CategoriaDto {
  @IsString()
  @Length(2, 60)
  nome: string;

  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @Length(2, 60)
  slug: string;
}

export class BloqueioDto {
  @IsBoolean()
  bloqueado: boolean;

  @IsString()
  @Length(3, 200)
  motivo: string;
}

export class ParametroDto {
  @IsNumber()
  valor: number;
}

export class Paginacao {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(200)
  limite?: number;
}

export class FiltroUsuariosDto extends Paginacao {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  busca?: string;
}

export class FiltroSessoesDto extends Paginacao {
  @IsOptional()
  @IsEnum(EstadoSessao)
  estado?: EstadoSessao;
}

export class FiltroAuditoriaDto extends Paginacao {
  @IsOptional()
  @Matches(/^[A-Z_]{2,60}$/)
  acao?: string;

  @IsOptional()
  @IsEnum(Severidade)
  severidade?: Severidade;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  de?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  ate?: Date;
}

export class FiltroEnviosDto {
  @IsOptional()
  @IsEnum(StatusEnvio)
  status?: StatusEnvio;
}

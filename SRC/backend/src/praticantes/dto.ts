import { FaixaEtaria, Nivel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min
} from 'class-validator';
import { FAIXAS_MENORES } from './faixas';

/** Dependente menor de idade: só apelido e faixa etária, sem e-mail nem login (coleta mínima). */
export class DependenteDto {
  @IsString()
  @Length(1, 30)
  apelido: string;

  @IsIn(FAIXAS_MENORES)
  faixaEtaria: FaixaEtaria;

  @IsOptional()
  @IsEnum(Nivel)
  nivel?: Nivel;

  /** O responsável declara consentir com o tratamento dos dados do menor (LGPD art. 14). */
  @IsBoolean()
  consentimentoParental: boolean;

  @IsOptional()
  @IsBoolean()
  consenteTelemetria?: boolean;
}

export class AtualizarPraticanteDto {
  @IsOptional()
  @IsString()
  @Length(1, 30)
  apelido?: string;

  @IsOptional()
  @IsEnum(FaixaEtaria)
  faixaEtaria?: FaixaEtaria;

  @IsOptional()
  @IsEnum(Nivel)
  nivel?: Nivel;

  @IsOptional()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  objetivos?: string[];

  @IsOptional()
  @IsObject()
  preferencias?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  restricoes?: string;

  /** Autoriza enviar os eventos brutos da sessão à plataforma mãe (RF19 "quando autorizado"). */
  @IsOptional()
  @IsBoolean()
  consenteTelemetria?: boolean;
}

export class FiltroHistoricoDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  de?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  ate?: Date;

  /** slug do treino */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  treino?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limite?: number;
}

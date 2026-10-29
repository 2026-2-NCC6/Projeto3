import { Licenca, ModeloRemuneracao, Nivel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';
import type { ConteudoTreino, Direcao, GolpeEsperado, ModoPublico, Rotacao, Sensor } from './conteudo';

// Validação estrutural do conteúdo (tipos, faixas amplas, tamanhos). As regras de negócio e os
// limites de operação ficam em validacao.ts, para o autor ver todos os problemas de uma vez (RF15).

class LancamentoDto {
  @IsNumber()
  @Min(0)
  @Max(250)
  velocidadeKmh: number;

  @IsIn(['TOPSPIN', 'SLICE', 'PLANO'])
  rotacao: Rotacao;

  @IsIn(['ESQ', 'CENTRO', 'DIR'])
  direcao: Direcao;

  @IsNumber()
  @Min(0)
  @Max(10)
  alturaM: number;

  @IsNumber()
  @Min(0)
  @Max(120)
  intervaloSeg: number;
}

class ExercicioDto {
  @IsString()
  @Length(1, 80)
  nome: string;

  @IsInt()
  @Min(1)
  @Max(500)
  repeticoes: number;

  @IsIn(['FH', 'BH', 'ALTERNADO'])
  golpeEsperado: GolpeEsperado;

  @ValidateNested()
  @Type(() => LancamentoDto)
  lancamento: LancamentoDto;
}

class PontuacaoDto {
  @IsNumber()
  base: number;

  @IsNumber()
  bonusSequencia: number;

  @IsNumber()
  bonusForte: number;

  @IsNumber()
  penalidadeErro: number;

  @IsNumber()
  metaPrecisao: number;
}

class FeedbacksDto {
  @IsString()
  @MaxLength(120)
  acerto: string;

  @IsString()
  @MaxLength(120)
  erro: string;

  @IsString()
  @MaxLength(120)
  sequencia: string;
}

class ConclusaoDto {
  @IsIn(['TEMPO', 'REPETICOES'])
  tipo: 'TEMPO' | 'REPETICOES';

  @IsInt()
  @Min(1)
  valor: number;
}

class GolpeTutorialDto {
  @IsIn(['FH', 'BH'])
  lado: 'FH' | 'BH';

  @IsString()
  @MaxLength(30)
  alvo: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  arco: number;
}

class TutorialDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => GolpeTutorialDto)
  golpes: GolpeTutorialDto[];

  @IsNumber()
  @Min(0.1)
  @Max(30)
  segPorBola: number;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  passos: string[];
}

/** Lista de até 30 textos curtos. */
function Textos(max = 300): PropertyDecorator {
  const regras = [IsArray(), ArrayMaxSize(30), IsString({ each: true }), MaxLength(max, { each: true })];
  return (alvo, prop) => regras.forEach((d) => d(alvo, prop));
}

export class ConteudoDto implements ConteudoTreino {
  @IsString()
  @MaxLength(120)
  publicoAlvo: string;

  @IsString()
  @MaxLength(200)
  objetivo: string;

  @IsEnum(Nivel)
  nivel: Nivel;

  @IsInt()
  @Min(1)
  @Max(240)
  duracaoMin: number;

  @IsIn(['INFANTIL', 'ADULTO', 'TODOS'])
  modoPublico: ModoPublico;

  @Textos()
  instrucoes: string[];

  @Textos(120)
  equipamentos: string[];

  @Textos()
  riscos: string[];

  @IsArray()
  @ArrayMaxSize(4)
  @IsIn(['IMU', 'PIEZO'], { each: true })
  sensores: Sensor[];

  @ValidateNested()
  @Type(() => PontuacaoDto)
  pontuacao: PontuacaoDto;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ExercicioDto)
  exercicios: ExercicioDto[];

  @ValidateNested()
  @Type(() => FeedbacksDto)
  feedbacks: FeedbacksDto;

  @ValidateNested()
  @Type(() => ConclusaoDto)
  conclusao: ConclusaoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TutorialDto)
  tutorial?: TutorialDto;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSAO = /^\d+(\.\d+){0,2}$/;

export class CriarTreinoDto {
  @Matches(SLUG, { message: 'slug deve ter só letras minúsculas, números e hífens' })
  @Length(3, 80)
  slug: string;

  @IsString()
  @Length(3, 120)
  nome: string;

  @IsOptional()
  @Matches(SLUG)
  categoriaSlug?: string;

  @ValidateNested()
  @Type(() => ConteudoDto)
  conteudo: ConteudoDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notasAlteracao?: string;

  /** Versão mínima do firmware da raquete para executar o treino. */
  @IsOptional()
  @Matches(VERSAO)
  compatibilidadeFirmware?: string;
}

export class EditarVersaoDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ConteudoDto)
  conteudo?: ConteudoDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notasAlteracao?: string;

  @IsOptional()
  @Matches(VERSAO)
  compatibilidadeFirmware?: string;
}

/** RF20: metadados para o futuro marketplace. Nenhuma cobrança acontece no MVP. */
export class MarketplaceDto {
  @IsString()
  @Length(10, 1000)
  descricaoComercial: string;

  @IsEnum(Licenca)
  licenca: Licenca;

  @IsEnum(ModeloRemuneracao)
  modeloRemuneracao: ModeloRemuneracao;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  precoFuturoCentavos?: number;
}

export class FiltroCatalogoDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  publico?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  objetivo?: string;

  @IsOptional()
  @IsEnum(Nivel)
  nivel?: Nivel;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duracaoMax?: number;

  @IsOptional()
  @IsIn(['IMU', 'PIEZO'])
  sensor?: Sensor;

  @IsOptional()
  @IsIn(['INFANTIL', 'ADULTO', 'TODOS'])
  modoPublico?: ModoPublico;

  @IsOptional()
  @Matches(SLUG)
  categoria?: string;
}

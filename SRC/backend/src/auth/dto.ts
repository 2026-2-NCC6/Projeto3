import { FaixaEtaria, Nivel } from '@prisma/client';
import { Equals, IsEmail, IsEnum, IsIn, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { FAIXAS_ADULTAS } from '../praticantes/faixas';

export class CadastroDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  /** 8–72 caracteres (limite do bcrypt), com ao menos uma letra e um número. */
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, { message: 'senha deve conter letras e números' })
  senha: string;

  @IsString()
  @Length(2, 80)
  nome: string;

  /** Só adultos têm conta; menores entram como dependentes de um responsável (RF11, LGPD art. 14). */
  @Equals(true, { message: 'o cadastro é restrito a maiores de 18 anos' })
  declaraMaioridade: boolean;

  /** Versão dos termos de uso e da política de privacidade aceita (finalidade explícita, LGPD). */
  @IsString()
  @Length(1, 20)
  termosVersao: string;

  @IsIn(FAIXAS_ADULTAS)
  faixaEtaria: FaixaEtaria;

  @IsOptional()
  @IsEnum(Nivel)
  nivel?: Nivel;
}

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MaxLength(72)
  senha: string;
}

export class RefreshDto {
  @IsString()
  @Length(20, 200)
  refreshToken: string;
}

export class ExcluirContaDto {
  /** Confirmação da senha antes de uma ação irreversível. */
  @IsString()
  @MaxLength(72)
  senha: string;
}

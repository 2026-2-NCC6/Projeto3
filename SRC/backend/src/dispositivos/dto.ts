import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min, ValidateNested } from 'class-validator';

const VERSAO = /^v?\d+(\.\d+){0,2}$/;
const ESTADOS_SENSOR = ['OK', 'FALHA', 'AUSENTE'] as const;

export class RegistrarDispositivoDto {
  /** Nome anunciado via BLE (ex.: ArduinoR4-IMU). */
  @IsString()
  @Length(1, 40)
  nomeBle: string;

  /** Endereço BLE ou número de série: identifica a raquete de forma única. */
  @IsString()
  @Length(4, 64)
  identificador: string;

  @Matches(VERSAO)
  firmwareVersao: string;

  /** Chave do BLE da raquete (32 hex, a mesma do segredo.h). Guardada cifrada; nunca volta nas respostas. */
  @Matches(/^[0-9A-Fa-f]{32}$/, { message: 'chave deve ter 32 caracteres hexadecimais' })
  chave: string;
}

class SensoresDto {
  @IsIn(ESTADOS_SENSOR)
  imu: (typeof ESTADOS_SENSOR)[number];

  @IsOptional()
  @IsIn(ESTADOS_SENSOR)
  piezo?: (typeof ESTADOS_SENSOR)[number];
}

export class StatusDispositivoDto {
  @IsBoolean()
  conectado: boolean;

  @ValidateNested()
  @Type(() => SensoresDto)
  sensores: SensoresDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  bateriaPct?: number;

  @IsOptional()
  @IsInt()
  @Min(-127)
  @Max(20)
  rssi?: number;

  @IsOptional()
  @Matches(VERSAO)
  firmwareVersao?: string;
}

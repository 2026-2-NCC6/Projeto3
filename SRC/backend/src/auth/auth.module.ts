import { Module } from '@nestjs/common';
import { AuthController, ContaController } from './auth.controller';
import { AuthService } from './auth.service';
import { ContaService } from './conta.service';
import { TokensService } from './tokens.service';

@Module({
  controllers: [AuthController, ContaController],
  providers: [AuthService, ContaService, TokensService],
  exports: [TokensService]
})
export class AuthModule {}

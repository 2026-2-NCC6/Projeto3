import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntegracaoModule } from '../integracao/integracao.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule, IntegracaoModule],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule {}

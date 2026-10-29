import { Module } from '@nestjs/common';
import { DispositivosModule } from '../dispositivos/dispositivos.module';
import { IntegracaoModule } from '../integracao/integracao.module';
import { MaquinaGateway } from '../maquina/maquina.gateway';
import { MaquinaService } from '../maquina/maquina.service';
import { PraticantesModule } from '../praticantes/praticantes.module';
import { TreinosModule } from '../treinos/treinos.module';
import { SessoesController } from './sessoes.controller';
import { SessoesService } from './sessoes.service';

@Module({
  imports: [PraticantesModule, DispositivosModule, TreinosModule, IntegracaoModule],
  controllers: [SessoesController],
  providers: [SessoesService, MaquinaService, MaquinaGateway]
})
export class SessoesModule {}

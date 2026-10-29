import { Module } from '@nestjs/common';
import { HistoricoService } from '../historico/historico.service';
import { PraticantesController } from './praticantes.controller';
import { PraticantesService } from './praticantes.service';

@Module({
  controllers: [PraticantesController],
  providers: [PraticantesService, HistoricoService],
  exports: [PraticantesService]
})
export class PraticantesModule {}

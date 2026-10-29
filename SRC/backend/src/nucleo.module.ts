import { Global, Module } from '@nestjs/common';
import { AuditoriaService } from './auditoria/auditoria.service';
import { Configuracao } from './config/configuracao';
import { ParametrosService } from './parametros/parametros.service';
import { PrismaService } from './prisma/prisma.service';
import { Metricas } from './saude/metricas';

/** Serviços transversais usados por todos os módulos. */
@Global()
@Module({
  providers: [Configuracao, PrismaService, AuditoriaService, ParametrosService, Metricas],
  exports: [Configuracao, PrismaService, AuditoriaService, ParametrosService, Metricas]
})
export class NucleoModule {}

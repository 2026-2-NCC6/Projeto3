import { Module } from '@nestjs/common';
import { ImportacaoService } from './importacao.service';
import { MockPlataformaController } from './mock-plataforma.controller';
import { OutboxService } from './outbox.service';
import { PlataformaMaeCliente, PlataformaMaeHttp } from './plataforma-mae.cliente';

@Module({
  controllers: [MockPlataformaController],
  providers: [OutboxService, ImportacaoService, { provide: PlataformaMaeCliente, useClass: PlataformaMaeHttp }],
  exports: [OutboxService, ImportacaoService]
})
export class IntegracaoModule {}

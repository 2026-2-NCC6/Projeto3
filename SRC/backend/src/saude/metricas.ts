import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { Observable, tap } from 'rxjs';

/** Métricas Prometheus (RNF Observabilidade, RNF Desempenho). Um registro por instância da aplicação. */
@Injectable()
export class Metricas {
  readonly registro = new Registry();

  readonly http = new Histogram({
    name: 'http_requisicao_duracao_ms',
    help: 'Duração das requisições HTTP em ms',
    labelNames: ['metodo', 'rota', 'status'],
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500],
    registers: [this.registro]
  });

  readonly emergencia = new Histogram({
    name: 'maquina_emergencia_latencia_ms',
    help: 'Tempo entre o comando de emergência e a máquina parada e notificada (meta: 200 ms p95)',
    buckets: [1, 5, 10, 25, 50, 100, 200, 500],
    registers: [this.registro]
  });

  readonly sessoesEncerradas = new Counter({
    name: 'sessoes_encerradas_total',
    help: 'Sessões finalizadas, por estado final',
    labelNames: ['estado', 'offline'],
    registers: [this.registro]
  });

  readonly falhasEnvio = new Counter({
    name: 'envios_plataforma_falhas_total',
    help: 'Tentativas de envio à plataforma mãe que falharam',
    registers: [this.registro]
  });

  constructor() {
    collectDefaultMetrics({ register: this.registro });
  }
}

@Injectable()
export class MetricasInterceptor implements NestInterceptor {
  constructor(private readonly metricas: Metricas) {}

  intercept(exec: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (exec.getType() !== 'http') return next.handle();
    const inicio = performance.now();
    const req = exec.switchToHttp().getRequest<Request>();
    const res = exec.switchToHttp().getResponse<Response>();
    const registrar = () => {
      // Rota com parâmetros (/sessoes/:id), não a URL real: evita explosão de cardinalidade.
      const rota = (req.route?.path as string | undefined) ?? 'desconhecida';
      this.metricas.http.observe({ metodo: req.method, rota, status: String(res.statusCode) }, performance.now() - inicio);
    };
    return next.handle().pipe(tap({ next: registrar, error: registrar }));
  }
}

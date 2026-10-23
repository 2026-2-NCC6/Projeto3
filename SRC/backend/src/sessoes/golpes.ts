import { Forca, GolpeRegistrado, Lado, ladoEsperado } from '../pontuacao/regras';

/** Campos de um evento GOLPE enviado pelo app (vindos do quadro BLE `S:` do firmware). */
export type DadosGolpe = { lado: Lado; forca: Forca; picoG: number; picoGiro: number; seq: number; acertoAlvo?: boolean };

/**
 * Converte os eventos de golpe (já ordenados no tempo) em golpes pontuáveis.
 * Acerto = lado pedido pelo treino naquela bola e, quando há alvo piezo, alvo atingido.
 */
export function golpesDosEventos(eventos: { tMs: number; dados: unknown }[], sequencia: Lado[]): GolpeRegistrado[] {
  return eventos.map((e, i) => {
    const d = e.dados as DadosGolpe;
    const esperado = ladoEsperado(sequencia, i);
    return { t: e.tMs / 1000, lado: d.lado, esperado, ok: d.lado === esperado && d.acertoAlvo !== false, forca: d.forca };
  });
}

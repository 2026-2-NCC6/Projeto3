import type { Lancamento } from '../api/tipos';

// Meia quadra vista de cima, com a rede embaixo e a linha de base em cima, que é o lado do
// praticante. Medidas oficiais em metros: 10,97 × 11,885; corredor de 1,37; linha de saque a 6,40 da rede.
const L = 10.97;
const C = 11.885;
const ESCALA = 22;
const W = L * ESCALA;
const H = C * ESCALA;
const CORREDOR = 1.37 * ESCALA;
const SAQUE = 6.4 * ESCALA;

const LARGURA_ZONA = (W - 2 * CORREDOR) / 4.5;
const PROFUNDIDADE_ZONA = H / 6;
const X_DIRECAO = { ESQ: CORREDOR + (W - 2 * CORREDOR) * 0.2, CENTRO: W / 2, DIR: W - CORREDOR - (W - 2 * CORREDOR) * 0.2 };

/** Linhas da quadra, sem bolas. Também é o fundo da tela de entrada. */
export function LinhasQuadra({ cor = 'currentColor' }: { cor?: string }) {
  return (
    <g fill="none" stroke={cor} strokeWidth={2}>
      <rect x={1} y={1} width={W - 2} height={H - 2} />
      <line x1={CORREDOR} y1={0} x2={CORREDOR} y2={H} />
      <line x1={W - CORREDOR} y1={0} x2={W - CORREDOR} y2={H} />
      <line x1={CORREDOR} y1={H - SAQUE} x2={W - CORREDOR} y2={H - SAQUE} />
      <line x1={W / 2} y1={H - SAQUE} x2={W / 2} y2={H} />
      <line x1={W / 2} y1={0} x2={W / 2} y2={8} />
    </g>
  );
}

/**
 * Onde cada bola do ensaio quica (RF15). A direção do lançamento escolhe a coluna; a altura e a
 * velocidade empurram a bola para o fundo. É uma aproximação visual para o autor conferir a
 * distribuição, não uma simulação física.
 */
export function Quadra({ lancamentos }: { lancamentos: Lancamento[] }) {
  const vMax = Math.max(...lancamentos.map((l) => l.velocidadeKmh), 1);
  const passo = Math.min(30, 900 / Math.max(lancamentos.length, 1));
  return (
    <figure className="quadra" style={{ margin: 0 }}>
      <svg viewBox={`-12 -12 ${W + 24} ${H + 36}`} role="img" aria-label={`Mapa de quiques de ${lancamentos.length} lançamentos`}>
        <rect x={-12} y={-12} width={W + 24} height={H + 36} rx={10} fill="#1A2414" />
        <LinhasQuadra cor="rgba(245,245,247,0.55)" />
        <line x1={-12} y1={H + 2} x2={W + 12} y2={H + 2} stroke="#F5F5F7" strokeWidth={3} strokeDasharray="2 3" />
        <text x={W / 2} y={H + 18} textAnchor="middle" fill="#98989D" fontSize={10} fontFamily="Barlow" letterSpacing={2}>
          REDE · MÁQUINA DO OUTRO LADO
        </text>
        {lancamentos.map((l, i) => {
          // Profundidade do quique: 0 = rede, 1 = linha de base. Mais velocidade e altura, mais fundo.
          const prof = Math.min(0.9, 0.32 + 0.42 * (l.velocidadeKmh / vMax) + 0.1 * Math.min(l.alturaM / 2, 1));
          // Dispersão determinística dentro da zona (ângulo áureo), para bolas iguais não se empilharem.
          const ang = l.seq * 2.39996;
          const raio = Math.sqrt((l.seq % 97) / 97);
          const x = X_DIRECAO[l.direcao] + Math.cos(ang) * raio * LARGURA_ZONA;
          const y = H - prof * H + Math.sin(ang) * raio * PROFUNDIDADE_ZONA;
          return (
            <circle
              key={l.seq}
              className="bola"
              cx={x}
              cy={y}
              r={lancamentos.length > 60 ? 3.5 : 5}
              fill={l.golpeEsperado === 'Forehand' ? '#CBE81F' : '#7DD3FC'}
              opacity={lancamentos.length > 60 ? 0.6 : 0.85}
              style={{ animationDelay: `${i * passo}ms` }}
            >
              <title>{`Bola ${l.seq}: ${l.golpeEsperado}, ${l.velocidadeKmh} km/h, ${l.rotacao.toLowerCase()}`}</title>
            </circle>
          );
        })}
      </svg>
    </figure>
  );
}

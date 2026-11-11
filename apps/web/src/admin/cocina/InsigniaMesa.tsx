/**
 * Insignia de mesa para toda la cocina (comanda normal y a pantalla completa, historial, despacho):
 * «Mesa 6», «Mesas 4 y 5», «Mesa sin asignar» o «En espera de mesa». Grande y de alto contraste,
 * legible a 2-3 metros; siempre con ícono y texto, nunca solo color.
 */
interface DatosMesa {
  modalidad?: string | null;
  mesa?: string | null;
  enEsperaMesa?: boolean;
}

/** Texto de la mesa del pedido, o null si el pedido no es de mesa (para llevar, delivery...). */
export function textoMesa({ modalidad, mesa, enEsperaMesa }: DatosMesa): string | null {
  const mod = (modalidad || '').toUpperCase();
  const esMesa = mod === 'MESA' || mod === 'LOCAL';
  if (!esMesa && mod !== 'COMER_LOCAL') return null;
  if (enEsperaMesa) return 'En espera de mesa';
  const m = (mesa || '').trim();
  if (m) return /^\d+$/.test(m) ? `Mesa ${m}` : m;
  return esMesa ? 'Mesa sin asignar' : null;
}

export function InsigniaMesa({
  modalidad,
  mesa,
  enEsperaMesa,
  testId = 'comanda-mesa',
  grande = true,
}: DatosMesa & { testId?: string; grande?: boolean }) {
  const texto = textoMesa({ modalidad, mesa, enEsperaMesa });
  if (!texto) return null;
  return (
    <span
      data-testid={testId}
      role="img"
      aria-label={texto}
      style={{
        display: 'inline-flex',
        alignSelf: 'flex-start',
        alignItems: 'center',
        gap: '8px',
        maxWidth: '100%',
        boxSizing: 'border-box',
        padding: grande ? '4px 14px' : '3px 10px',
        borderRadius: '12px',
        border: '2.5px solid var(--cp-navy)',
        background: 'var(--cp-cream, #FBF4EC)',
        color: 'var(--cp-navy)',
        fontFamily: 'Montserrat, system-ui, sans-serif',
        fontWeight: 800,
        fontSize: grande ? 'clamp(24px, 6vw, 32px)' : '18px',
        lineHeight: 1.15,
        overflowWrap: 'anywhere',
      }}
    >
      <span aria-hidden="true">🍽️</span>
      <span aria-hidden="true">{texto}</span>
    </span>
  );
}

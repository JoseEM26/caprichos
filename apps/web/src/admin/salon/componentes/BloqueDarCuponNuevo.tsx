import { useEffect, useState } from 'react';
import { textoValorCupon } from '@caprichos/compartido';
import { ofertasApi, type CuponParaDar } from '../../ofertas/ofertasApi';

/**
 * «Dar un cupón a este cliente (opcional)» en el paso de pago de la ventana de nuevo pedido: el cupón «Lo da el personal»
 * sale impreso en el ticket de quien lo recibe desde la primera impresión. La pantalla solo lo monta con permiso cupones/dar.
 * Sin cupones vigentes y con cupo no sale nada.
 */
export function BloqueDarCuponNuevo({ cuponId, onCambiar }: { cuponId: string | null; onCambiar: (id: string | null) => void }) {
  const [cupones, setCupones] = useState<CuponParaDar[] | null>(null);
  const [error, setError] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    let vigente = true;
    ofertasApi
      .cuponesParaDar()
      .then((r) => {
        if (vigente) setCupones(r.cupones ?? []);
      })
      .catch(() => {
        if (vigente) setError(true);
      });
    return () => {
      vigente = false;
    };
  }, []);

  if (error) {
    return (
      <p role="status" style={{ margin: 0, fontSize: 13, color: 'var(--cp-soft, #7a6a5a)' }}>
        No se pudieron cargar los cupones que puedes dar.
      </p>
    );
  }
  if (!cupones || cupones.length === 0) return null;

  const elegido = cupones.find((c) => c.id === cuponId) ?? null;
  const etiqueta = (c: CuponParaDar) => c.descripcion || c.codigoBase;
  const vigencia = (c: CuponParaDar) => `${c.alcance} · válido ${c.diasValidez} días desde que se da${c.quedan != null ? ` · quedan ${c.quedan}` : ''}`;

  if (elegido) {
    return (
      <section data-testid="bloque-dar-cupon" aria-label="Cupón para este cliente" style={{ border: '1.5px dashed var(--cp-line, #E3D6C6)', borderRadius: 12, padding: '10px 14px' }}>
        <div style={{ fontWeight: 700 }}>
          🎟 {etiqueta(elegido)} · {textoValorCupon(elegido.descuentoTipo, elegido.descuentoValor)}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--cp-soft, #7a6a5a)', marginTop: 2 }}>{vigencia(elegido)}</div>
        <div role="status" style={{ fontSize: 13, marginTop: 6 }}>
          Se imprimirá en el voucher de este cliente
        </div>
        <button type="button" className="np-quitar" onClick={() => onCambiar(null)} style={{ marginTop: 8 }}>
          Quitar
        </button>
      </section>
    );
  }

  return (
    <section data-testid="bloque-dar-cupon" aria-label="Cupón para este cliente" style={{ border: '1.5px dashed var(--cp-line, #E3D6C6)', borderRadius: 12, padding: '10px 14px' }}>
      <button type="button" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)} style={{ background: 'none', border: 0, padding: 0, fontWeight: 700, cursor: 'pointer' }}>
        🎟 Dar un cupón a este cliente (opcional) {abierto ? '▴' : '▾'}
      </button>
      {abierto && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cupones.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onCambiar(c.id)}
                style={{ width: '100%', textAlign: 'left', background: '#fff', border: '1px solid var(--cp-line, #E3D6C6)', borderRadius: 10, padding: '8px 10px', cursor: 'pointer' }}
              >
                <div style={{ fontWeight: 700 }}>
                  {etiqueta(c)} · {textoValorCupon(c.descuentoTipo, c.descuentoValor)}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--cp-soft, #7a6a5a)' }}>{vigencia(c)}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { ofertasApi, type CuponDado, type CuponParaDar } from './ofertasApi';
import '../pedidos/corregir-cliente.css';

const valorTxt = (c: CuponParaDar) => (c.descuentoTipo === 'PORCENTAJE' ? `${c.descuentoValor} %` : c.descuentoTipo === 'ENVIO_GRATIS' ? 'envío gratis' : `S/ ${c.descuentoValor}`);
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima' }) : null);

/** «Dar cupón»: el mozo o cajero elige un cupón para el cliente de este pedido; sale impreso en su voucher (también al reimprimirlo). */
export function ModalDarCupon({ pedidoId, alCerrar }: { pedidoId: string; alCerrar: () => void }) {
  const [cupones, setCupones] = useState<CuponParaDar[] | null>(null);
  const [dado, setDado] = useState<CuponDado | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vigente = true;
    ofertasApi
      .cuponesParaDar(pedidoId)
      .then((r) => {
        if (!vigente) return;
        setCupones(r.cupones);
        setDado(r.dado);
      })
      .catch(() => vigente && setError('No pudimos cargar los cupones. Intenta de nuevo.'));
    return () => {
      vigente = false;
    };
  }, [pedidoId]);

  const dar = async (c: CuponParaDar) => {
    setEnviando(true);
    setError('');
    try {
      setDado(await ofertasApi.darCupon(c.id, pedidoId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo dar el cupón');
    } finally {
      setEnviando(false);
    }
  };

  const quitar = async () => {
    if (!dado) return;
    setEnviando(true);
    setError('');
    try {
      await ofertasApi.quitarCuponDado(dado.id);
      setDado(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo quitar el cupón');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div onClick={alCerrar} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(11, 44, 62, 0.55)' }} />
      <div role="dialog" aria-modal="true" aria-label="Dar cupón" className="cc-hoja" style={{ zIndex: 81, width: 'min(480px, calc(100% - 24px))' }}>
        <div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--cp-navy, #0B2C3E)' }}>Dar cupón</div>
          <div style={{ fontSize: 14, color: 'var(--cp-soft, #2C4C5D)', marginTop: 4 }}>
            Sale impreso en el voucher de este pedido. El cliente lo puede usar él u otra persona en otra compra.
          </div>
        </div>

        {dado ? (
          <div data-testid="cupon-dado" style={{ border: '2px dashed var(--cp-navy, #0B2C3E)', borderRadius: 12, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 13 }}>Cupón dado{dado.codigoBase ? ` (${dado.codigoBase})` : ''}</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 24, letterSpacing: '0.06em' }}>{dado.codigo}</div>
            {dado.venceEn && <div style={{ fontSize: 13 }}>Vence el {fecha(dado.venceEn)}</div>}
            <div style={{ fontSize: 12, marginTop: 6, color: 'var(--cp-soft, #2C4C5D)' }}>Si el voucher ya salió, reimprime el comprobante para que lo lleve.</div>
          </div>
        ) : cupones === null && !error ? (
          <p role="status">Cargando…</p>
        ) : cupones && cupones.length === 0 ? (
          <p>No hay cupones para dar ahora. Pide al administrador que cree uno en Ofertas › Cupones («Lo da el mozo o cajero»).</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(cupones ?? []).map((c) => (
              <li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--cp-line, #E3D6C6)', borderRadius: 12, padding: '8px 10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800 }}>{c.codigoBase} · {valorTxt(c)}</div>
                  <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                    {c.descripcion ?? ''}{c.quedan != null ? ` · quedan ${c.quedan}` : ''}
                  </div>
                </div>
                <Boton tamano="pequeno" onClick={() => void dar(c)} deshabilitado={enviando}>Dar</Boton>
              </li>
            ))}
          </ul>
        )}

        {error && <div role="alert" className="cc-error">{error}</div>}

        <div className="cc-acciones">
          {dado && <Boton variante="secundario" tamano="grande" onClick={() => void quitar()} deshabilitado={enviando}>Quitar (me equivoqué)</Boton>}
          <Boton variante="secundario" tamano="grande" onClick={alCerrar}>Cerrar</Boton>
        </div>
      </div>
    </>
  );
}

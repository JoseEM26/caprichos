import { useMemo, useState } from 'react';
import { Confirmar } from '../../../comun/Confirmar';
import { useSesion } from '../../../comun/sesion';
import { salonApi } from '../api';
import type { MesaSalon, PisoPlano, PisoSalon } from '../tipos';
import { SelectorMesasCroquis } from './SelectorMesasCroquis';
import './lista-espera.css';

export interface PedidoComerLocal {
  id: string | number;
  codigo: string;
  modalidad?: string | null;
  estado?: string | null;
  pago_estado?: string | null;
  cliente_nombre?: string | null;
}

/** Pedido de autogestión sin mesa ni lista que Caja todavía puede mover (vivo y sin cobrar). */
export function esComerLocalPorAsignar(p: Pick<PedidoComerLocal, 'modalidad' | 'estado' | 'pago_estado'>): boolean {
  return (
    String(p.modalidad ?? '').toUpperCase() === 'COMER_LOCAL' &&
    ['COLA', 'PREPARANDO', 'LISTO'].includes(String(p.estado ?? '').toUpperCase()) &&
    String(p.pago_estado ?? '').toUpperCase() !== 'PAGADO'
  );
}

// ponytail: sin SesionProvider (pruebas de la tarjeta suelta) no hay permiso y los botones no salen
function permisoAbrirMesa(): boolean {
  try {
    return useSesion().tiene('mesas/abrir');
  } catch {
    return false;
  }
}

const nombreMesa = (m: MesaSalon) => m.nombre || `Mesa ${m.numero}`;

/**
 * «Autogestión · decide Caja»: los dos botones de un pedido «Comer en el local» de la carta.
 * Asignar mesa (croquis; libre con Sí/No, ocupada con confirmación fuerte) o A lista de espera (Sí/No).
 */
export function AccionesComerLocal({ pedido, alCambio, compacto = false }: { pedido: PedidoComerLocal; alCambio?: () => void; compacto?: boolean }) {
  const tiene = permisoAbrirMesa();
  const [paso, setPaso] = useState<'cerrado' | 'elegir' | 'confirmar' | 'espera'>('cerrado');
  const [pisos, setPisos] = useState<PisoSalon[]>([]);
  const [planos, setPlanos] = useState<PisoPlano[] | null>(null);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [mesaId, setMesaId] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mesas = useMemo(() => pisos.flatMap((p) => p.mesas ?? []), [pisos]);
  const mesa = mesas.find((m) => m.id === mesaId) ?? null;
  const ocupada = mesa?.estado === 'OCUPADA' ? mesa : null;
  const ocupadas = useMemo(
    () => Object.fromEntries(mesas.filter((m) => m.estado === 'OCUPADA').map((m) => [m.id, { nombre: m.pedido?.codigo ?? null }])),
    [mesas],
  );
  const quien = pedido.cliente_nombre || 'el cliente';

  if (!esComerLocalPorAsignar(pedido) || !tiene) return null;

  const cerrar = () => {
    setPaso('cerrado');
    setSeleccion([]);
    setMesaId(null);
  };
  const abrirElegir = async () => {
    setError(null);
    setPaso('elegir');
    try {
      const [m, p] = await Promise.all([salonApi.obtenerMesas(), salonApi.obtenerPlano().catch(() => null)]);
      setPisos(m?.pisos ?? []);
      setPlanos(p);
    } catch {
      setError('No pudimos cargar las mesas.');
    }
  };
  const ejecutar = async (fn: () => Promise<unknown>) => {
    setEnviando(true);
    setError(null);
    try {
      await fn();
      cerrar();
      alCambio?.();
    } catch (e: any) {
      // 409: la mesa se ocupó o el pedido ya cambió; se vuelve a elegir con las mesas al día
      setError(e?.message || 'No se pudo completar. Intenta de nuevo.');
      if (paso === 'confirmar') await abrirElegir();
      else setPaso('cerrado');
      alCambio?.();
    } finally {
      setEnviando(false);
    }
  };
  const id = String(pedido.id);

  return (
    <div className="acl" data-testid="acciones-comer-local" onClick={(e) => e.stopPropagation()}>
      <span className="cj-pc-chip" data-testid="chip-autogestion" style={{ background: '#FFF4D6', color: 'var(--cp-navy)' }}>
        Autogestión · decide Caja
      </span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: compacto ? 4 : 8 }}>
        <button
          type="button"
          className="le-btn le-btn--principal"
          style={{ minHeight: 44 }}
          aria-label={`Asignar mesa a ${quien} ${pedido.codigo}`}
          onClick={() => void abrirElegir()}
        >
          Asignar mesa
        </button>
        <button
          type="button"
          className="le-btn"
          style={{ minHeight: 44 }}
          aria-label={`Mandar ${quien} ${pedido.codigo} a la lista de espera`}
          onClick={() => {
            setError(null);
            setPaso('espera');
          }}
        >
          A lista de espera
        </button>
      </div>
      {error && paso === 'cerrado' && (
        <p className="le-error" role="alert">
          {error}
        </p>
      )}

      {paso === 'elegir' && (
        <div className="le-fondo" role="dialog" aria-modal="true" aria-label={`Elige la mesa para ${quien}`}>
          <div className="le-modal">
            <h3 className="le-titulo">Mesa para {quien}</h3>
            <p className="le-meta">Toca una mesa libre. Si eliges una ocupada, su pedido pasa a la lista de espera (te pediremos confirmar).</p>
            {error && (
              <p className="le-error" role="alert">
                {error}
              </p>
            )}
            <SelectorMesasCroquis
              pisos={pisos}
              planos={planos ?? undefined}
              seleccionadas={seleccion}
              onCambio={(ids) => setSeleccion(ids.slice(-1))}
              ocupadas={ocupadas}
              alTocarOcupada={(m) => {
                setMesaId(m.id);
                setPaso('confirmar');
              }}
            />
            <div className="le-modal-acciones">
              <button type="button" className="le-btn" onClick={cerrar}>
                Cancelar
              </button>
              <button
                type="button"
                className="le-btn le-btn--principal"
                disabled={seleccion.length === 0}
                onClick={() => {
                  setMesaId(seleccion[0]);
                  setPaso('confirmar');
                }}
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {paso === 'confirmar' && mesa && !ocupada && (
        <Confirmar
          abierto
          titulo="¿Asignar esta mesa?"
          mensaje={`${quien} pasa a ${nombreMesa(mesa)}. La mesa queda ocupada con su pedido.`}
          textoConfirmar="Sí, asignar"
          textoNo="No"
          cargando={enviando}
          alConfirmar={() => ejecutar(() => salonApi.asignarComerLocal(id, mesa.id))}
          alCancelar={() => setPaso('elegir')}
        />
      )}
      {paso === 'confirmar' && ocupada && (
        <div className="le-fondo le-fondo--fuerte" role="alertdialog" aria-modal="true" aria-label="Esta mesa está ocupada">
          <div className="le-modal le-modal--fuerte" data-testid="acl-confirmar-ocupada">
            <h3 className="le-titulo le-titulo--fuerte">Esta mesa está ocupada</h3>
            <p className="le-texto">
              Si continúas, el pedido de <strong>{ocupada.pedido?.cliente || 'otro cliente'}</strong> ({ocupada.pedido?.codigo ?? 'sin código'}) pasará a
              la <strong>LISTA DE ESPERA</strong> y <strong>{quien}</strong> ocupará {nombreMesa(ocupada)}. No se pierde ningún pedido.
            </p>
            <div className="le-modal-acciones">
              <button type="button" className="le-btn le-btn--grande" autoFocus disabled={enviando} onClick={() => setPaso('elegir')}>
                No
              </button>
              <button
                type="button"
                className="le-btn le-btn--grande le-btn--peligro"
                disabled={enviando}
                onClick={() => void ejecutar(() => salonApi.asignarComerLocal(id, ocupada.id, true))}
              >
                Sí, mover a la lista de espera y asignar
              </button>
            </div>
          </div>
        </div>
      )}
      {paso === 'espera' && (
        <Confirmar
          abierto
          titulo="¿Mandar a la lista de espera?"
          mensaje={`${quien} espera mesa. Su pedido sigue en cocina y lo llamarás cuando se libere una mesa.`}
          textoConfirmar="Sí, a la lista"
          textoNo="No"
          cargando={enviando}
          alConfirmar={() => ejecutar(() => salonApi.comerLocalAEspera(id))}
          alCancelar={cerrar}
        />
      )}
    </div>
  );
}

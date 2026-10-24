import { useEffect, useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { api } from '../../comun/api';

export interface ModalMermaIndividualProps {
  abierto: boolean;
  alCerrar: () => void;
  alGuardar?: (datos: {
    tipo: string;
    insumo: string;
    insumoId?: string | number;
    cantidad: number;
    origen: string;
    motivo: string;
  }) => Promise<void> | void;
}

export interface InsumoItem {
  id?: string;
  n: string;
  u: string;
  s: number;
}

const ORIGENES = ['Cocina', 'Barra', 'Producción', 'Almacén central', 'Proveedor'];
const MOTIVOS = ['Caída', 'Desecho', 'Error de comanda', 'Calibración', 'Donación', 'Personal'];

export function ModalMermaIndividual({
  abierto,
  alCerrar,
  alGuardar,
}: ModalMermaIndividualProps) {
  const [tipo, setTipo] = useState('Merma');
  const [insumosList, setInsumosList] = useState<InsumoItem[]>([]);
  const [insumo, setInsumo] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [origen, setOrigen] = useState('Cocina');
  const [motivo, setMotivo] = useState('Caída');
  const [mensajeError, setMensajeError] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [cargandoInsumos, setCargandoInsumos] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    let activo = true;
    setCargandoInsumos(true);
    setMensajeError('');

    api
      .get<any[]>('/admin/stock/insumos')
      .then((res) => {
        if (!activo) return;
        if (Array.isArray(res) && res.length > 0) {
          const items: InsumoItem[] = res.map((r) => ({
            id: r.id?.toString(),
            n: r.nombre,
            u: r.unidadMedida || r.unidad || 'unidades',
            s: Number(r.stockActual || r.stock || 0),
          }));
          setInsumosList(items);
          setInsumo(items[0]?.n || '');
          return;
        }
        throw new Error('Sin insumos de stock');
      })
      .catch(() => {
        return api
          .get<any[]>('/carta')
          .then((cats) => {
            if (!activo) return;
            const items: InsumoItem[] = [];
            if (Array.isArray(cats)) {
              for (const c of cats) {
                for (const p of c.productos || []) {
                  items.push({
                    id: p.id?.toString(),
                    n: p.nombre,
                    u: 'unidades',
                    s: Number(p.stock ?? 0),
                  });
                }
              }
            }
            setInsumosList(items);
            setInsumo(items[0]?.n || '');
          })
          .catch(() => {
            if (!activo) return;
            setInsumosList([]);
            setInsumo('');
          });
      })
      .finally(() => {
        if (activo) setCargandoInsumos(false);
      });

    return () => {
      activo = false;
    };
  }, [abierto]);

  if (!abierto) return null;

  const sp = insumosList.find((x) => x.n === insumo) || insumosList[0];

  const handleValidarYConfirmar = () => {
    setMensajeError('');
    if (!insumo && insumosList.length === 0) {
      setMensajeError('No hay productos ni insumos disponibles en el sistema.');
      return;
    }
    const q = parseFloat(cantidad.replace(',', '.'));
    if (!/^\d+([.,]\d{1,3})?$/.test(cantidad.trim()) || isNaN(q) || q <= 0) {
      setMensajeError('Escribe una cantidad numérica mayor que cero.');
      return;
    }
    if (sp && sp.s > 0 && q > sp.s) {
      setMensajeError(`Solo hay ${sp.s} ${sp.u} de ${sp.n} en ${origen}.`);
      return;
    }
    setConfirmando(true);
  };

  const ejecutarGuardado = async () => {
    const q = parseFloat(cantidad.replace(',', '.'));
    if (alGuardar) {
      await alGuardar({
        tipo,
        insumo,
        insumoId: sp?.id || insumo,
        cantidad: q,
        origen,
        motivo,
      });
    }
    setConfirmando(false);
    alCerrar();
  };

  return (
    <>
      <div
        onClick={alCerrar}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          background: 'rgba(11, 44, 62, 0.55)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Registrar merma"
        style={{
          position: 'fixed',
          zIndex: 70,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(840px, calc(100% - 24px))',
          maxHeight: 'calc(100% - 24px)',
          overflowY: 'auto',
          background: 'var(--cp-cream)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(11, 44, 62, 0.4)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          fontFamily: 'Montserrat, system-ui, sans-serif',
          color: 'var(--cp-navy)',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '20px',
            }}
          >
            Registrar movimiento
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '22px',
              border: '1.5px solid var(--cp-navy)',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontSize: '20px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {/* Tipo */}
        <div>
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>Tipo</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['Entrada', 'Salida', 'Merma', 'Devolución'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                style={{
                  minHeight: '44px',
                  padding: '0 14px',
                  borderRadius: '9999px',
                  border: '1.5px solid var(--cp-navy)',
                  background: tipo === t ? 'var(--cp-navy)' : 'transparent',
                  color: tipo === t ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Insumos */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
              marginBottom: '4px',
            }}
          >
            <div style={{ fontWeight: 700 }}>
              Producto de cocina{' '}
              <span
                style={{
                  fontWeight: 500,
                  fontSize: '12px',
                  color: 'var(--cp-soft)',
                }}
              >
                · con su stock actual
              </span>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              maxHeight: '130px',
              overflowY: 'auto',
            }}
          >
            {cargandoInsumos ? (
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)', padding: '6px' }}>
                Cargando insumos...
              </div>
            ) : insumosList.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)', padding: '6px' }}>
                No hay productos ni insumos disponibles en el sistema.
              </div>
            ) : (
              insumosList.map((item) => (
                <button
                  key={item.id || item.n}
                  type="button"
                  onClick={() => {
                    setInsumo(item.n);
                    setMensajeError('');
                  }}
                  style={{
                    minHeight: '38px',
                    padding: '0 10px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-navy)',
                    background: insumo === item.n ? 'var(--cp-navy)' : 'transparent',
                    color: insumo === item.n ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {item.n} {item.s > 0 ? `(${item.s} ${item.u})` : ''}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Cantidad */}
        <div>
          <label
            htmlFor="mv-cant-input"
            style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}
          >
            Cantidad
          </label>
          <input
            id="mv-cant-input"
            type="text"
            inputMode="decimal"
            value={cantidad}
            placeholder="Solo números"
            onChange={(e) => {
              setCantidad(
                e.target.value
                  .replace(/[^0-9.,]/g, '')
                  .replace(/([.,])(?=.*[.,])/g, ''),
              );
              setMensajeError('');
            }}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: '48px',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-white)',
              padding: '0 12px',
              fontSize: '15px',
            }}
          />
        </div>

        {/* Origen */}
        <div>
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>Origen</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {ORIGENES.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOrigen(o)}
                style={{
                  minHeight: '44px',
                  padding: '0 14px',
                  borderRadius: '9999px',
                  border: '1.5px solid var(--cp-navy)',
                  background: origen === o ? 'var(--cp-navy)' : 'transparent',
                  color: origen === o ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        {/* ¿Qué se hace con la merma? */}
        <div>
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>
            ¿Qué se hace con la merma?
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {MOTIVOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMotivo(m)}
                style={{
                  minHeight: '44px',
                  padding: '0 14px',
                  borderRadius: '9999px',
                  border: '1.5px solid var(--cp-navy)',
                  background: motivo === m ? 'var(--cp-navy)' : 'transparent',
                  color: motivo === m ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {mensajeError && (
          <div
            role="alert"
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--cp-rust)',
            }}
          >
            {mensajeError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handleValidarYConfirmar}
            style={{
              flex: 1,
              minHeight: '52px',
              border: 0,
              borderRadius: '12px',
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            Registrar
          </button>
          <button
            type="button"
            onClick={alCerrar}
            style={{
              flex: 1,
              minHeight: '52px',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: '12px',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>

      <Confirmar
        abierto={confirmando}
        titulo={`¿Registrar merma de ${cantidad} ${sp.u} de ${insumo}?`}
        mensaje={`Se descuenta del stock y queda como merma (${motivo.toLowerCase()}).`}
        textoConfirmar="Sí, registrar"
        textoNo="No, cancelar"
        alConfirmar={ejecutarGuardado}
        alCancelar={() => setConfirmando(false)}
      />
    </>
  );
}

import { useEffect, useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { api } from '../../comun/api';

export interface ModalMermaVariosProps {
  abierto: boolean;
  alCerrar: () => void;
  alGuardar?: (filas: any[]) => Promise<void> | void;
}

interface FilaMerma {
  n: string;
  stock: number;
  u: string;
  q: string;
  origen: string;
  motivo: string;
}

const MOTIVOS = ['Desecho', 'Caída', 'Error de comanda', 'Calibración', 'Donación', 'Personal'];
const ORIGENES = ['Cocina', 'Barra', 'Producción'];

export function ModalMermaVarios({
  abierto,
  alCerrar,
  alGuardar,
}: ModalMermaVariosProps) {
  const [motivoGlobal, setMotivoGlobal] = useState('Desecho');
  const [filas, setFilas] = useState<FilaMerma[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mensajeError, setMensajeError] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    let activo = true;
    setCargando(true);
    setMensajeError('');

    api
      .get<any[]>('/admin/stock/insumos')
      .then((res) => {
        if (!activo) return;
        if (Array.isArray(res) && res.length > 0) {
          const mapeados: FilaMerma[] = res.map((r) => ({
            n: r.nombre,
            stock: Number(r.stockActual || r.stock || 0),
            u: r.unidadMedida || r.unidad || 'unidades',
            q: '',
            origen: 'Cocina',
            motivo: 'Desecho',
          }));
          setFilas(mapeados);
          return;
        }
        throw new Error('Sin stock');
      })
      .catch(() => {
        return api
          .get<any[]>('/carta')
          .then((cats) => {
            if (!activo) return;
            const prods: FilaMerma[] = [];
            if (Array.isArray(cats)) {
              for (const c of cats) {
                for (const p of c.productos || []) {
                  prods.push({
                    n: p.nombre,
                    stock: Number(p.stock ?? 0),
                    u: 'unidades',
                    q: '',
                    origen: 'Cocina',
                    motivo: 'Desecho',
                  });
                }
              }
            }
            setFilas(prods);
          })
          .catch(() => {
            if (!activo) return;
            setFilas([]);
          });
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [abierto]);

  if (!abierto) return null;

  const aplicarMotivoGlobal = (nuevoMotivo: string) => {
    setMotivoGlobal(nuevoMotivo);
    setFilas((prev) => prev.map((f) => ({ ...f, motivo: nuevoMotivo })));
  };

  const setCantidadFila = (index: number, val: string) => {
    const clean = val.replace(/[^0-9.,]/g, '').replace(/([.,])(?=.*[.,])/g, '');
    setFilas((prev) =>
      prev.map((f, i) => (i === index ? { ...f, q: clean } : f)),
    );
    setMensajeError('');
  };

  const setTodoFila = (index: number) => {
    setFilas((prev) =>
      prev.map((f, i) => (i === index ? { ...f, q: String(f.stock) } : f)),
    );
    setMensajeError('');
  };

  const alternarOrigen = (index: number) => {
    setFilas((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;
        const curIdx = ORIGENES.indexOf(f.origen);
        const next = ORIGENES[(curIdx + 1) % ORIGENES.length];
        return { ...f, origen: next };
      }),
    );
  };

  const alternarMotivo = (index: number) => {
    setFilas((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;
        const curIdx = MOTIVOS.indexOf(f.motivo);
        const next = MOTIVOS[(curIdx + 1) % MOTIVOS.length];
        return { ...f, motivo: next };
      }),
    );
  };

  const ponerTodo = () => {
    setFilas((prev) => prev.map((f) => ({ ...f, q: String(f.stock) })));
    setMensajeError('');
  };

  const limpiar = () => {
    setFilas((prev) => prev.map((f) => ({ ...f, q: '' })));
    setMensajeError('');
  };

  const filasConCantidad = filas.filter((f) => {
    const num = parseFloat(f.q.replace(',', '.'));
    return !isNaN(num) && num > 0;
  });

  const totalUnidades = filasConCantidad.reduce((acc, f) => {
    return acc + parseFloat(f.q.replace(',', '.'));
  }, 0);

  const resumen =
    filasConCantidad.length > 0
      ? `${filasConCantidad.length} ${
          filasConCantidad.length === 1 ? 'producto' : 'productos'
        }, ${totalUnidades} ${
          totalUnidades === 1 ? 'unidad' : 'unidades'
        } en total.`
      : 'Elige al menos un producto para registrar la merma.';

  const handleValidar = () => {
    if (filasConCantidad.length === 0) {
      setMensajeError('Escribe la cantidad en al menos un producto.');
      return;
    }
    for (const f of filasConCantidad) {
      const q = parseFloat(f.q.replace(',', '.'));
      if (q > f.stock) {
        setMensajeError(`Solo hay ${f.stock} de ${f.n}.`);
        return;
      }
    }
    setMensajeError('');
    setConfirmando(true);
  };

  const ejecutarGuardado = async () => {
    if (alGuardar) {
      await alGuardar(filasConCantidad);
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
        aria-label="Merma de varios productos"
        style={{
          position: 'fixed',
          zIndex: 70,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(1030px, calc(100% - 24px))',
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
            Merma de varios productos
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

        <div style={{ fontSize: '13px', lineHeight: '19px', color: 'var(--cp-soft)' }}>
          Pon la cantidad de cada producto que se bota (o toca «Todo»). Cada línea
          puede venir de un lugar distinto y tener su propio destino.
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>
            ¿Qué se hace con todo?{' '}
            <span
              style={{
                fontWeight: 500,
                fontSize: '12px',
                color: 'var(--cp-soft)',
              }}
            >
              · se puede cambiar en cada línea
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {MOTIVOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => aplicarMotivoGlobal(m)}
                style={{
                  minHeight: '44px',
                  padding: '0 14px',
                  borderRadius: '9999px',
                  border: '1.5px solid var(--cp-navy)',
                  background: motivoGlobal === m ? 'var(--cp-navy)' : 'transparent',
                  color: motivoGlobal === m ? 'var(--cp-cream)' : 'var(--cp-navy)',
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

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={ponerTodo}
            style={{
              minHeight: '44px',
              padding: '0 14px',
              border: '1.5px solid var(--cp-navy)',
              borderRadius: '10px',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Todo lo que hay
          </button>
          <button
            type="button"
            onClick={limpiar}
            style={{
              minHeight: '44px',
              padding: '0 14px',
              border: '1.5px dashed var(--cp-navy)',
              borderRadius: '10px',
              background: 'transparent',
              color: 'var(--cp-navy)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Limpiar
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {cargando ? (
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)', padding: '12px 0' }}>
              Cargando productos...
            </div>
          ) : filas.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)', padding: '12px 0' }}>
              No hay productos ni insumos disponibles en el sistema.
            </div>
          ) : (
            filas.map((r, i) => {
            const hasVal = parseFloat(r.q.replace(',', '.')) > 0;
            return (
              <div
                key={r.n}
                style={{
                  background: 'var(--cp-white)',
                  border: `1.5px solid ${hasVal ? 'var(--cp-navy)' : 'var(--cp-line)'}`,
                  borderRadius: '12px',
                  padding: '8px 10px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: '14px',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {r.n}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                    Hay {r.stock} {r.u}
                  </div>
                </div>

                <input
                  type="text"
                  inputMode="decimal"
                  value={r.q}
                  onChange={(e) => setCantidadFila(i, e.target.value)}
                  placeholder="0"
                  aria-label={`Cantidad de ${r.n}`}
                  style={{
                    width: '84px',
                    boxSizing: 'border-box',
                    minHeight: '44px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-white)',
                    padding: '0 10px',
                    fontSize: '15px',
                    fontWeight: 700,
                    textAlign: 'center',
                  }}
                />

                <button
                  type="button"
                  onClick={() => setTodoFila(i)}
                  style={{
                    minHeight: '44px',
                    padding: '0 12px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: '10px',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Todo
                </button>

                <button
                  type="button"
                  onClick={() => alternarOrigen(i)}
                  aria-label={`Cambiar el origen de ${r.n}`}
                  style={{
                    minHeight: '44px',
                    padding: '0 12px',
                    border: '1.5px solid var(--cp-line)',
                    borderRadius: '10px',
                    background: 'var(--cp-sand)',
                    color: 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  De: {r.origen}
                </button>

                <button
                  type="button"
                  onClick={() => alternarMotivo(i)}
                  aria-label={`Cambiar el destino de ${r.n}`}
                  style={{
                    minHeight: '44px',
                    padding: '0 12px',
                    border: '1.5px solid var(--cp-line)',
                    borderRadius: '10px',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {r.motivo}
                </button>
              </div>
            );
          })
          )}
        </div>

        <div
          role="status"
          style={{
            background: 'var(--cp-white)',
            border: '1.5px solid var(--cp-line)',
            borderRadius: '12px',
            padding: '10px 12px',
            fontSize: '14px',
          }}
        >
          <b>Resumen:</b> {resumen}
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
            onClick={handleValidar}
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
            Registrar la merma
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
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>

      <Confirmar
        abierto={confirmando}
        titulo="¿Registrar merma de varios productos?"
        mensaje={`Se descontarán ${totalUnidades} unidades en total del stock y quedarán registradas en el historial.`}
        textoConfirmar="Sí, registrar"
        textoNo="No, cancelar"
        alConfirmar={ejecutarGuardado}
        alCancelar={() => setConfirmando(false)}
      />
    </>
  );
}

import { useEffect, useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { api } from '../../comun/api';

export interface ModalPedirAlmacenProps {
  abierto: boolean;
  alCerrar: () => void;
  alEnviar?: (datos: {
    items: { insumo: string; cantidad: number; unidad: string }[];
    nota: string;
  }) => Promise<void> | void;
}

export interface InsumoAlmacenItem {
  n: string;
  u: string;
}

export function ModalPedirAlmacen({
  abierto,
  alCerrar,
  alEnviar,
}: ModalPedirAlmacenProps) {
  const [insumosList, setInsumosList] = useState<InsumoAlmacenItem[]>([]);
  const [cargando, setCargando] = useState(false);
  const [items, setItems] = useState<{ ins: string; q: string }[]>([
    { ins: '', q: '' },
  ]);
  const [nota, setNota] = useState('');
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
          const mapeados = res.map((r) => ({
            n: r.nombre,
            u: r.unidadMedida || r.unidad || 'unidades',
          }));
          setInsumosList(mapeados);
          setItems([{ ins: mapeados[0]?.n || '', q: '' }]);
          return;
        }
        throw new Error('Sin stock');
      })
      .catch(() => {
        return api
          .get<any[]>('/carta')
          .then((cats) => {
            if (!activo) return;
            const prods: InsumoAlmacenItem[] = [];
            if (Array.isArray(cats)) {
              for (const c of cats) {
                for (const p of c.productos || []) {
                  prods.push({
                    n: p.nombre,
                    u: 'unidades',
                  });
                }
              }
            }
            setInsumosList(prods);
            setItems([{ ins: prods[0]?.n || '', q: '' }]);
          })
          .catch(() => {
            if (!activo) return;
            setInsumosList([]);
            setItems([{ ins: '', q: '' }]);
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

  const agregarLinea = () => {
    setItems((prev) => [...prev, { ins: insumosList[0]?.n || '', q: '' }]);
  };

  const quitarLinea = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const setInsumoLinea = (index: number, ins: string) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ins } : it)),
    );
    setMensajeError('');
  };

  const setCantidadLinea = (index: number, q: string) => {
    const clean = q.replace(/[^0-9.,]/g, '').replace(/([.,])(?=.*[.,])/g, '');
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, q: clean } : it)),
    );
    setMensajeError('');
  };

  const handleValidar = () => {
    setMensajeError('');
    if (items.length === 0) {
      setMensajeError('Agrega al menos un insumo.');
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.ins) {
        setMensajeError(`Insumo ${i + 1}: elige o escribe el insumo.`);
        return;
      }
      const num = parseFloat(it.q.replace(',', '.'));
      if (isNaN(num) || num <= 0) {
        setMensajeError(`Insumo ${i + 1}: escribe la cantidad.`);
        return;
      }
    }
    setConfirmando(true);
  };

  const ejecutarEnvio = async () => {
    const procesados = items.map((it) => {
      const def = insumosList.find((x) => x.n === it.ins);
      return {
        insumo: it.ins,
        cantidad: parseFloat(it.q.replace(',', '.')),
        unidad: def ? def.u : 'unid',
      };
    });

    if (alEnviar) {
      await alEnviar({
        items: procesados,
        nota: nota.trim(),
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
        aria-label="Pedir al almacén"
        style={{
          position: 'fixed',
          zIndex: 70,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(860px, calc(100% - 24px))',
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
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '22px',
              lineHeight: '27px',
            }}
          >
            Pedir al almacén
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            style={{
              flex: 'none',
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

        <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
          Pide lo que necesitas para el turno. El almacenero lo ve en su
          escritorio.
        </div>

        {items.map((linea, idx) => {
          const spDef =
            insumosList.find((x) => x.n === linea.ins) ||
            insumosList[0] || { n: '', u: 'unid' };
          return (
            <div
              key={idx}
              style={{
                background: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '13px' }}>
                Insumo {idx + 1}
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {cargando ? (
                  <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                    Cargando insumos...
                  </span>
                ) : insumosList.length === 0 ? (
                  <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                    No hay insumos registrados en el almacén.
                  </span>
                ) : (
                  insumosList.slice(0, 10).map((sp) => (
                    <button
                      key={sp.n}
                      type="button"
                      onClick={() => setInsumoLinea(idx, sp.n)}
                      style={{
                        minHeight: '44px',
                        padding: '0 12px',
                        borderRadius: '9999px',
                        border: '1.5px solid var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: '12px',
                        background:
                          linea.ins === sp.n ? 'var(--cp-navy)' : 'transparent',
                        color:
                          linea.ins === sp.n ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        cursor: 'pointer',
                      }}
                    >
                      {sp.n}
                    </button>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: '1 1 130px', minWidth: 0 }}>
                  <label
                    htmlFor={`insumo-cant-${idx}`}
                    style={{
                      fontWeight: 700,
                      fontSize: '13px',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    Cantidad
                  </label>
                  <input
                    id={`insumo-cant-${idx}`}
                    type="number"
                    value={linea.q}
                    onChange={(e) => setCantidadLinea(idx, e.target.value)}
                    placeholder="0"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: '42px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-white)',
                      padding: '0 10px',
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      color: 'var(--cp-navy)',
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--cp-soft)',
                    marginTop: '20px',
                  }}
                >
                  en {spDef.u}
                </span>

                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => quitarLinea(idx)}
                    style={{
                      minHeight: '44px',
                      padding: '0 12px',
                      borderRadius: '9999px',
                      border: '1.5px solid var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '12px',
                      background: 'transparent',
                      color: 'var(--cp-rust)',
                      alignSelf: 'flex-end',
                      cursor: 'pointer',
                    }}
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={agregarLinea}
          style={{
            alignSelf: 'flex-start',
            minHeight: '44px',
            padding: '0 12px',
            borderRadius: '9999px',
            border: '1.5px solid var(--cp-navy)',
            fontWeight: 700,
            fontSize: '12px',
            borderStyle: 'dashed',
            background: 'transparent',
            color: 'var(--cp-navy)',
            cursor: 'pointer',
          }}
        >
          + Agregar otro insumo
        </button>

        <div style={{ flex: '1 1 100%', minWidth: 0 }}>
          <label
            htmlFor="rq-nota-input"
            style={{
              fontWeight: 700,
              fontSize: '13px',
              display: 'block',
              marginBottom: '4px',
            }}
          >
            Nota (opcional)
          </label>
          <input
            id="rq-nota-input"
            type="text"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ej.: para el frappé de la tarde"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: '42px',
              borderRadius: '10px',
              border: '1.5px solid var(--cp-line)',
              background: 'var(--cp-white)',
              padding: '0 10px',
              fontFamily: 'inherit',
              fontSize: '14px',
              color: 'var(--cp-navy)',
            }}
          />
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
              borderRadius: '12px',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '15px',
              border: 0,
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              cursor: 'pointer',
            }}
          >
            Enviar al almacén
          </button>
          <button
            type="button"
            onClick={alCerrar}
            style={{
              flex: 1,
              minHeight: '52px',
              borderRadius: '12px',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '15px',
              border: '1.5px solid var(--cp-navy)',
              background: 'transparent',
              color: 'var(--cp-navy)',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>

      <Confirmar
        abierto={confirmando}
        titulo="¿Enviar el pedido al almacén?"
        mensaje="Suena en la pantalla del almacén hasta que alguien marque «Recibido» y le llega por WhatsApp a quien esté de turno. No cambia el stock hasta que se entregue."
        textoConfirmar="Sí, enviar"
        textoNo="No, cancelar"
        alConfirmar={ejecutarEnvio}
        alCancelar={() => setConfirmando(false)}
      />
    </>
  );
}

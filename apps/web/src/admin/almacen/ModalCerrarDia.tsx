import React, { useState, useEffect } from 'react';
import { almacenApi, ProductoCierreDiaItem, CierreDiaDto } from './almacenApi';
import { Confirmar } from '../../comun/Confirmar';

interface ModalCerrarDiaProps {
  abierto: boolean;
  alCerrar: () => void;
  alGuardar: () => void;
}

interface ItemCierreForm {
  insumoId?: string;
  productoId?: string;
  nombre: string;
  sistema: number;
  unidad: string;
  conteoReal: string;
  desechoMerma: string;
  destino: string;
}

export const ModalCerrarDia: React.FC<ModalCerrarDiaProps> = ({
  abierto,
  alCerrar,
  alGuardar,
}) => {
  const [items, setItems] = useState<ItemCierreForm[]>([]);
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);

  useEffect(() => {
    if (abierto) {
      setCargando(true);
      setErrorMsg('');
      setConfirmarAbierto(false);
      almacenApi
        .obtenerProductosCierreDia()
        .then((res: ProductoCierreDiaItem[]) => {
          setItems(
            res.map((it) => ({
              insumoId: it.insumoId,
              productoId: it.productoId,
              nombre: it.nombre,
              sistema: Number(it.sistema || 0),
              unidad: it.unidad || 'unidades',
              conteoReal: String(Number(it.sistema || 0)),
              desechoMerma: '0',
              destino: 'Desecho',
            })),
          );
        })
        .catch((err: any) => {
          setErrorMsg(err.message || 'Error al cargar productos del día para el cierre.');
        })
        .finally(() => setCargando(false));
    }
  }, [abierto]);

  if (!abierto) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setErrorMsg('No hay productos ni insumos para cerrar.');
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const real = parseFloat(it.conteoReal);
      if (isNaN(real) || real < 0) {
        setErrorMsg(`Conteo inválido para ${it.nombre}.`);
        return;
      }
      const b = parseFloat(it.desechoMerma);
      if (isNaN(b) || b < 0) {
        setErrorMsg(`Cantidad a botar inválida para ${it.nombre}.`);
        return;
      }
      if (b > real) {
        setErrorMsg(`En ${it.nombre}: no puedes botar más de lo que contaste.`);
        return;
      }
    }
    setErrorMsg('');
    setConfirmarAbierto(true);
  };

  const ejecutarCerrarDia = async () => {
    const dto: CierreDiaDto = {
      fecha: new Date().toISOString(),
      filas: items.map((it) => ({
        insumoId: it.insumoId,
        productoId: it.productoId,
        nombre: it.nombre,
        sistema: it.sistema,
        contado: parseFloat(it.conteoReal) || 0,
        botar: parseFloat(it.desechoMerma) || 0,
        destino: it.destino || 'Desecho',
        unidad: it.unidad,
      })),
    };

    try {
      setCargando(true);
      setErrorMsg('');
      await almacenApi.cerrarDia(dto);
      setConfirmarAbierto(false);
      alGuardar();
      alCerrar();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar el cierre del día.');
      setConfirmarAbierto(false);
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <div
        onClick={alCerrar}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          background: 'rgba(11,44,62,0.55)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cerrar el día (sobrantes a merma)"
        style={{
          position: 'fixed',
          zIndex: 60,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 'min(640px, calc(100% - 24px))',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--cp-white)',
          borderRadius: 16,
          boxShadow: 'rgba(11, 44, 62, 0.25) 0px 10px 30px',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          color: 'var(--cp-navy)',
          fontFamily: '"Open Sans", system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2
              style={{
                margin: 0,
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: 18,
                color: 'var(--cp-rust)',
              }}
            >
              Cerrar el día (sobrantes a merma)
            </h2>
            <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
              Verifica el stock sobrante de productos de producción e insumos frescos. Lo que botas pasa a merma y la diferencia de conteo queda registrada.
            </div>
          </div>
          <button
            onClick={alCerrar}
            style={{
              border: 0,
              background: 'transparent',
              fontSize: 20,
              cursor: 'pointer',
              color: 'var(--cp-soft)',
            }}
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgb(253, 236, 232)',
              color: 'var(--cp-rust)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {errorMsg}
          </div>
        )}

        {cargando && items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--cp-soft)' }}>
            Cargando productos del día...
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--cp-soft)' }}>
            No se encontraron productos de producción ni insumos frescos para cerrar hoy.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map((it, idx) => {
                const c = parseFloat(it.conteoReal);
                const b = parseFloat(it.desechoMerma);
                const valido = !isNaN(c) && !isNaN(b) && c >= 0 && b >= 0 && b <= c;
                const queda = valido ? Math.round((c - b) * 100) / 100 : 0;
                const dif = valido ? Math.round(Math.max(0, it.sistema - c) * 100) / 100 : 0;

                return (
                  <div
                    key={it.productoId ? `prod-${it.productoId}` : `ins-${it.insumoId || idx}`}
                    style={{
                      background: 'var(--cp-cream)',
                      borderRadius: 10,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{it.nombre}</span>
                      <span style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
                        Stock sistema: <b>{it.sistema} {it.unidad}</b>
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--cp-soft)', display: 'block' }}>
                          Conteo físico real
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={it.conteoReal}
                          onChange={(e) => {
                            const updated = [...items];
                            updated[idx].conteoReal = e.target.value;
                            setItems(updated);
                          }}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            minHeight: 36,
                            borderRadius: 6,
                            border: '1px solid var(--cp-line)',
                            padding: '0 8px',
                            background: 'var(--cp-white)',
                            fontSize: 13,
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11, color: 'var(--cp-soft)', display: 'block' }}>
                          Desecho a merma
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={it.desechoMerma}
                          onChange={(e) => {
                            const updated = [...items];
                            updated[idx].desechoMerma = e.target.value;
                            setItems(updated);
                          }}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            minHeight: 36,
                            borderRadius: 6,
                            border: '1px solid var(--cp-line)',
                            padding: '0 8px',
                            background: 'var(--cp-white)',
                            fontSize: 13,
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11, color: 'var(--cp-soft)', display: 'block' }}>
                          Destino de merma
                        </label>
                        <select
                          value={it.destino}
                          onChange={(e) => {
                            const updated = [...items];
                            updated[idx].destino = e.target.value;
                            setItems(updated);
                          }}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            minHeight: 36,
                            borderRadius: 6,
                            border: '1px solid var(--cp-line)',
                            padding: '0 8px',
                            background: 'var(--cp-white)',
                            fontSize: 13,
                          }}
                        >
                          <option value="Desecho">Desecho</option>
                          <option value="Donación">Donación</option>
                          <option value="Personal">Personal</option>
                        </select>
                      </div>
                    </div>

                    {valido && (
                      <div style={{ fontSize: 12, color: 'var(--cp-soft)', marginTop: 2 }}>
                        Queda en stock: <b>{queda} {it.unidad}</b>
                        {b > 0 && ` · Merma: ${b} ${it.unidad} (${it.destino.toLowerCase()})`}
                        {dif > 0 && ` · Diferencia de conteo: ${dif} ${it.unidad}`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 10,
                borderTop: '1px solid var(--cp-line)',
                paddingTop: 14,
              }}
            >
              <button
                type="button"
                onClick={alCerrar}
                style={{
                  minHeight: 44,
                  padding: '0 16px',
                  borderRadius: 9999,
                  border: '1.5px solid var(--cp-navy)',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={cargando}
                style={{
                  minHeight: 44,
                  padding: '0 20px',
                  borderRadius: 9999,
                  border: 0,
                  background: 'var(--cp-rust)',
                  color: 'var(--cp-white)',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: cargando ? 'not-allowed' : 'pointer',
                  opacity: cargando ? 0.7 : 1,
                }}
              >
                {cargando ? 'Procesando...' : 'Confirmar cierre del día'}
              </button>
            </div>
          </form>
        )}
      </div>

      {confirmarAbierto && (
        <Confirmar
          abierto={confirmarAbierto}
          titulo="¿Confirmar cierre del día?"
          mensaje="Lo que botas pasa a merma con el destino elegido, la diferencia de conteo queda registrada y lo demás sigue en el stock."
          textoConfirmar="Sí, confirmar cierre"
          alConfirmar={ejecutarCerrarDia}
          alCancelar={() => setConfirmarAbierto(false)}
        />
      )}
    </>
  );
};

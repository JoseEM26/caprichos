import { comoLista } from '../../comun/comoLista';
import React, { useState, useEffect } from 'react';
import { almacenApi, RecetaProduccionItem, RegistrarProduccionDto } from './almacenApi';
import { Confirmar } from '../../comun/Confirmar';

interface ModalRegistrarProduccionProps {
  abierto: boolean;
  alCerrar: () => void;
  alGuardar: () => void;
}

export const ModalRegistrarProduccion: React.FC<ModalRegistrarProduccionProps> = ({
  abierto,
  alCerrar,
  alGuardar,
}) => {
  const [recetas, setRecetas] = useState<RecetaProduccionItem[]>([]);
  const [recetaId, setRecetaId] = useState('');
  const [unidades, setUnidades] = useState('');
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);

  useEffect(() => {
    if (abierto) {
      setCargando(true);
      setErrorMsg('');
      setUnidades('');
      setConfirmarAbierto(false);
      almacenApi
        .listarRecetasProduccion()
        .then((res) => {
          setRecetas(comoLista<RecetaProduccionItem>(res));
          if (res.length > 0) {
            setRecetaId(res[0].id);
          }
        })
        .catch((err: any) => {
          setErrorMsg(err.message || 'Error al cargar recetas de producción.');
        })
        .finally(() => setCargando(false));
    }
  }, [abierto]);

  if (!abierto) return null;

  const recetaSel = recetas.find((r) => r.id === recetaId);
  const unidadesNum = parseFloat(unidades) || 0;
  const rinde = (recetaSel?.rindePorTanda || 1);
  const factor = rinde > 0 ? unidadesNum / rinde : 0;

  // Cálculo de insumos consumidos en vivo
  const insumosCalculados = (recetaSel?.insumos || []).map((ins) => {
    const cantBase = ins.cantidadPorTanda || 0;
    const gasto = Math.round(cantBase * factor * 1000) / 1000;
    const stockCocina = ins.stockCocina ?? 0;
    const falta = gasto > stockCocina;
    return {
      ...ins,
      gasto,
      stockCocina,
      falta,
    };
  });

  const hayStockInsuficiente = insumosCalculados.some((i) => i.falta);

  const lineaVivaInsumos = insumosCalculados.length > 0 && unidadesNum > 0
    ? insumosCalculados.map((i) => `${i.gasto} ${i.unidad} de ${i.nombre}`).join(', ')
    : '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recetaId) {
      setErrorMsg('Debe seleccionar una receta.');
      return;
    }
    if (unidadesNum <= 0) {
      setErrorMsg('Escriba cuántas unidades salieron (mayor a 0).');
      return;
    }
    setErrorMsg('');
    setConfirmarAbierto(true);
  };

  const ejecutarGuardar = async () => {
    const dto: RegistrarProduccionDto = {
      recetaId,
      unidadesObtenidas: unidadesNum,
      tandas: factor,
    };

    try {
      setCargando(true);
      setErrorMsg('');
      await almacenApi.registrarProduccion(dto);
      setConfirmarAbierto(false);
      alGuardar();
      alCerrar();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar la producción.');
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
        aria-label="Hoy preparé..."
        style={{
          position: 'fixed',
          zIndex: 60,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 'min(580px, calc(100% - 24px))',
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
              }}
            >
              Hoy preparé...
            </h2>
            <div style={{ fontSize: 12, color: 'var(--cp-soft)', marginTop: 2 }}>
              Los insumos que se gastan se descuentan de cocina; lo que preparaste suma al stock de cocina.
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

        <div
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: 'var(--cp-cream)',
            borderLeft: '4px solid var(--cp-blue, #2563eb)',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--cp-navy)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Se descuenta de: <strong>Salados</strong></span>
          <span style={{ fontSize: 11, color: 'var(--cp-soft)' }}>Ingresa a: <strong>Salados</strong></span>
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Receta */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Producto elaborado (se prepara por tanda)
            </label>
            {recetas.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
                No hay recetas configuradas de tipo "Se prepara por tanda".
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {recetas.map((r) => {
                  const sel = r.id === recetaId;
                  const rindeTexto = r.rindePorTanda;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRecetaId(r.id)}
                      style={{
                        minHeight: 36,
                        padding: '0 12px',
                        borderRadius: 9999,
                        border: '1.5px solid var(--cp-navy)',
                        fontWeight: 700,
                        fontSize: 12,
                        background: sel ? 'var(--cp-navy)' : 'transparent',
                        color: sel ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        cursor: 'pointer',
                      }}
                    >
                      {r.nombre} ({rindeTexto} {r.unidadResultado || 'und'}/tanda)
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cuántas unidades salieron */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              Cuántas unidades salieron
            </label>
            <input
              type="number"
              step="any"
              min="0.1"
              placeholder="Ej: 12"
              value={unidades}
              onChange={(e) => setUnidades(e.target.value)}
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: 42,
                borderRadius: 8,
                border: '1.5px solid var(--cp-line)',
                padding: '0 12px',
                background: 'var(--cp-cream)',
                fontSize: 15,
                fontWeight: 600,
              }}
            />
          </div>

          {/* Línea viva de cálculo */}
          {recetaSel && unidadesNum > 0 && (
            <div
              style={{
                background: 'var(--cp-cream)',
                borderRadius: 12,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                border: '1px solid var(--cp-line)',
              }}
            >
              <div style={{ fontSize: 13, color: 'var(--cp-navy)', fontWeight: 600 }}>
                Se gastará de cocina: {lineaVivaInsumos}
              </div>

              {insumosCalculados.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  {insumosCalculados.map((ins) => (
                    <div
                      key={ins.insumoId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        color: ins.falta ? 'var(--cp-rust)' : 'var(--cp-navy)',
                      }}
                    >
                      <span>
                        • {ins.nombre}: {ins.gasto} {ins.unidad}
                      </span>
                      <span>
                        (Salados disponible: {ins.stockCocina} {ins.unidad})
                        {ins.falta && ' - Insuficiente'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {hayStockInsuficiente && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--cp-rust)',
                    fontWeight: 700,
                    marginTop: 4,
                  }}
                >
                  Atención: No hay suficiente stock en Salados para completar esta cantidad.
                </div>
              )}
            </div>
          )}

          {/* Botones */}
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
              disabled={cargando || recetas.length === 0 || unidadesNum <= 0}
              style={{
                minHeight: 44,
                padding: '0 20px',
                borderRadius: 9999,
                border: 0,
                background: 'var(--cp-orange)',
                color: 'var(--cp-navy)',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: 14,
                cursor: cargando || recetas.length === 0 || unidadesNum <= 0 ? 'not-allowed' : 'pointer',
                opacity: cargando || recetas.length === 0 || unidadesNum <= 0 ? 0.7 : 1,
              }}
            >
              {cargando ? 'Registrando...' : 'Registrar producción'}
            </button>
          </div>
        </form>
      </div>

      {confirmarAbierto && (
        <Confirmar
          abierto={confirmarAbierto}
          titulo="¿Confirmar producción del día?"
          mensaje={`Se prepararon ${unidadesNum} unidades de ${recetaSel?.nombre || 'producto'}. Se descontará materia prima de Salados y sumará al stock de Salados.`}
          textoConfirmar="Sí, registrar producción"
          alConfirmar={ejecutarGuardar}
          alCancelar={() => setConfirmarAbierto(false)}
        />
      )}
    </>
  );
};

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
  const [tandas, setTandas] = useState('1');
  const [unidadesReales, setUnidadesReales] = useState('');
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);

  useEffect(() => {
    if (abierto) {
      setCargando(true);
      setErrorMsg('');
      setTandas('1');
      setUnidadesReales('');
      setConfirmarAbierto(false);
      almacenApi
        .listarRecetasProduccion()
        .then((res) => {
          setRecetas(res);
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
  const tandasNum = parseFloat(tandas) || 0;
  const unidadesEstimadas = recetaSel ? Math.round(recetaSel.rindePorTanda * tandasNum) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recetaId) {
      setErrorMsg('Debe seleccionar una receta.');
      return;
    }
    if (tandasNum <= 0) {
      setErrorMsg('El número de tandas debe ser mayor a 0.');
      return;
    }
    setErrorMsg('');
    setConfirmarAbierto(true);
  };

  const ejecutarGuardar = async () => {
    const dto: RegistrarProduccionDto = {
      recetaId,
      tandas: tandasNum,
      unidadesReales: unidadesReales ? parseFloat(unidadesReales) : undefined,
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
        aria-label="Registrar producción del día"
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
              Registrar producción del día
            </h2>
            <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
              La producción entra al almacén y descuenta insumos de cocina o almacén (acta 02).
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Receta */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              Receta de producción
            </label>
            {recetas.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
                No hay recetas configuradas con producción en lote.
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {recetas.map((r) => {
                  const sel = r.id === recetaId;
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
                      {r.nombre} ({r.rindePorTanda} {r.unidadResultado}/tanda)
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tandas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                Número de tandas
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={tandas}
                onChange={(e) => setTandas(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 40,
                  borderRadius: 8,
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 10px',
                  background: 'var(--cp-cream)',
                  fontSize: 14,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                Unidades reales obtenidas (opcional)
              </label>
              <input
                type="number"
                placeholder={`Sugerido: ${unidadesEstimadas}`}
                value={unidadesReales}
                onChange={(e) => setUnidadesReales(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 40,
                  borderRadius: 8,
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 10px',
                  background: 'var(--cp-cream)',
                  fontSize: 14,
                }}
              />
            </div>
          </div>

          {/* Resumen de producción calculada */}
          {recetaSel && (
            <div
              style={{
                background: 'var(--cp-cream)',
                borderRadius: 12,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--cp-soft)' }}>Resultado de producción:</span>
                <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16 }}>
                  {unidadesReales ? unidadesReales : unidadesEstimadas} {recetaSel.unidadResultado}
                </span>
              </div>

              {recetaSel.insumos.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, marginBottom: 4 }}>
                    Insumos a descontar automáticamente:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                    {recetaSel.insumos.map((ins) => {
                      const cantTotal = Math.round(ins.cantidadPorTanda * tandasNum * 100) / 100;
                      return (
                        <div key={ins.insumoId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>• {ins.nombre}:</span>
                          <b>
                            {cantTotal} {ins.unidad} (Stock disponible: {ins.stockCocina + ins.stockAlmacen} {ins.unidad})
                          </b>
                        </div>
                      );
                    })}
                  </div>
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
              disabled={cargando || recetas.length === 0}
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
                cursor: cargando || recetas.length === 0 ? 'not-allowed' : 'pointer',
                opacity: cargando || recetas.length === 0 ? 0.7 : 1,
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
          mensaje={`Se consumirá materia prima y se añadirán ${unidadesReales || unidadesEstimadas} unidades de ${recetaSel?.productoNombre || 'producto'}.`}
          textoConfirmar="Sí, registrar producción"
          alConfirmar={ejecutarGuardar}
          alCancelar={() => setConfirmarAbierto(false)}
        />
      )}
    </>
  );
};

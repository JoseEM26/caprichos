import { useState, useEffect, useCallback } from 'react';
import type { EstadoAdminImpresion } from '@caprichos/compartido';
import { Confirmar } from '../../comun/Confirmar';
import { Cargando } from '../../comun/Cargando';
import { impresionApi, TrabajoImpresionAdmin } from './impresionApi';
import { ColaImpresion } from './ColaImpresion';
import { PruebaImpresion } from './PruebaImpresion';
import { useEstadoMaquinas } from './useEstadoMaquinas';

/** Sección «Cola y pruebas»: trabajos pendientes y fallidos (con reintento) y pruebas de cada máquina. */
export function SeccionColaPruebas() {
  const { maquinas } = useEstadoMaquinas();

  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoAdminImpresion | null>(null);
  const [fallidos, setFallidos] = useState<TrabajoImpresionAdmin[]>([]);
  const [mostrarFallidos, setMostrarFallidos] = useState<boolean>(false);
  const [verCola, setVerCola] = useState<boolean>(false);
  const [trabajoParaReintentar, setTrabajoParaReintentar] = useState<string | null>(null);
  const [reintentando, setReintentando] = useState<boolean>(false);

  const cargarDatos = useCallback(async () => {
    setError(null);
    try {
      const est = await impresionApi.obtenerEstado();
      setEstado(est);
      if (est.fallidos > 0) {
        const resFallidos = await impresionApi.listarTrabajos({ estado: 'FALLIDO', limite: 20 });
        setFallidos(resFallidos.items);
      } else {
        setFallidos([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al cargar la cola de impresión');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
    const intervalo = setInterval(() => void cargarDatos(), 10000); // Actualiza cada 10s
    return () => clearInterval(intervalo);
  }, [cargarDatos]);

  const handleEjecutarReintentar = async () => {
    if (!trabajoParaReintentar) return;
    setReintentando(true);
    setError(null);
    try {
      await impresionApi.reintentarTrabajo(trabajoParaReintentar);
      setMensajeExito(`Trabajo #${trabajoParaReintentar} devuelto a la cola de impresión.`);
      setTrabajoParaReintentar(null);
      await cargarDatos();
    } catch (err: any) {
      setError(err?.message || 'Error al reintentar el trabajo');
    } finally {
      setReintentando(false);
    }
  };

  if (cargando && !estado) {
    return <Cargando mensaje="Consultando la cola de impresión..." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <h3 style={{ margin: 0, fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 17, color: 'var(--cp-navy, #0B2C3E)' }}>
            Cola y pruebas
          </h3>
          <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)', marginTop: 2 }}>
            Las etiquetas y tickets esperando salir, los trabajos que fallaron y la prueba de cada máquina.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setVerCola(true)}
          style={{ minHeight: 44, padding: '0 12px', border: 0, borderRadius: 8, background: 'var(--cp-navy, #0B2C3E)', color: 'var(--cp-cream, #FBF4EC)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          Gestionar cola
        </button>
      </div>

      {error && (
        <div role="alert" style={{ background: '#FBE9DF', color: 'var(--cp-rust, #B2500F)', padding: '10px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
          {error}
        </div>
      )}
      {mensajeExito && (
        <div role="status" style={{ background: 'var(--cp-sand, #EDE1D1)', color: 'var(--cp-green, #2F7A45)', padding: '10px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
          {mensajeExito}
        </div>
      )}

      {/* Conteo de la cola */}
      <div
        data-cfg-id="impresion-cola"
        tabIndex={-1}
        style={{ border: '1px solid var(--cp-line, #E3D6C6)', borderRadius: 12, padding: 12, background: 'var(--cp-cream, #FBF4EC)', display: 'flex', flexDirection: 'column', gap: 4 }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft, #2C4C5D)' }}>Cola de trabajos</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginTop: 2 }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--cp-navy, #0B2C3E)' }}>{estado?.pendientes || 0} pendientes</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: (estado?.fallidos || 0) > 0 ? 'var(--cp-rust, #B2500F)' : 'var(--cp-soft, #2C4C5D)' }}>
            {estado?.fallidos || 0} fallidos
          </span>
        </div>
        {(estado?.fallidos || 0) > 0 && (
          <button
            type="button"
            onClick={() => setMostrarFallidos(!mostrarFallidos)}
            style={{ alignSelf: 'flex-start', marginTop: 4, minHeight: 44, border: 0, background: 'transparent', color: 'var(--cp-rust, #B2500F)', fontSize: 12, fontWeight: 800, cursor: 'pointer', padding: '0 4px', textDecoration: 'underline' }}
          >
            {mostrarFallidos ? 'Ocultar fallidos' : 'Ver y reintentar fallidos'}
          </button>
        )}
      </div>

      {/* Lista de trabajos fallidos */}
      {mostrarFallidos && (estado?.fallidos || 0) > 0 && (
        <div style={{ border: '1.5px solid var(--cp-rust, #B2500F)', borderRadius: 12, padding: 14, background: '#FDF7F4', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--cp-rust, #B2500F)' }}>Trabajos de impresión fallidos</div>
          <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
            Llegaron a 5 intentos sin respuesta exitosa. Puedes devolverlos a la cola con Reintentar.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {fallidos.map((f) => (
              <div
                key={f.id}
                style={{ border: '1px solid var(--cp-line, #E3D6C6)', borderRadius: 8, padding: '8px 12px', background: 'var(--cp-white, #FFFFFF)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>
                    Trabajo #{f.id} · {f.tipo} · {f.pedidoId ? `Pedido ${f.pedidoCodigo}` : 'Prueba de impresión'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                    Intentos: {f.intentos}/5 · Error: {f.error || 'Sin detalle de error'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setTrabajoParaReintentar(f.id)}
                  style={{ minHeight: 44, padding: '0 12px', borderRadius: 8, border: '1.5px solid var(--cp-navy, #0B2C3E)', background: 'transparent', color: 'var(--cp-navy, #0B2C3E)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  Reintentar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pruebas de impresión: comprueban cada máquina sin hacer un pedido */}
      <div
        data-testid="pruebas-impresion"
        data-cfg-id="impresion-pruebas"
        tabIndex={-1}
        style={{ borderTop: '1px solid var(--cp-line, #E3D6C6)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 15, color: 'var(--cp-navy, #0B2C3E)' }}>
          Pruebas de impresión
        </div>
        <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
          Imprimen una pieza de ejemplo marcada como PRUEBA para comprobar que la máquina está bien conectada. No hacen ningún pedido.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft, #2C4C5D)' }}>
              Etiquetera: {maquinas?.ETIQUETERA?.conectada ? 'conectada' : 'no conectada'}
            </div>
            <PruebaImpresion rol="ETIQUETERA" maquina={maquinas?.ETIQUETERA} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft, #2C4C5D)' }}>
              Ticketera: {maquinas?.TICKETERA?.conectada ? 'conectada' : 'no conectada'}
            </div>
            <PruebaImpresion rol="TICKETERA" maquina={maquinas?.TICKETERA} />
          </div>
        </div>
      </div>

      {/* Confirmar: reintentar trabajo */}
      {Boolean(trabajoParaReintentar) && (
        <Confirmar
          abierto={Boolean(trabajoParaReintentar)}
          titulo={`¿Reintentar trabajo #${trabajoParaReintentar}?`}
          mensaje="El trabajo volverá al estado PENDIENTE para que el agente local de caja lo tome e imprima nuevamente."
          textoSi="Sí, reintentar"
          textoNo="No, cancelar"
          cargando={reintentando}
          alConfirmar={handleEjecutarReintentar}
          alCancelar={() => setTrabajoParaReintentar(null)}
        />
      )}

      {verCola && (
        <ColaImpresion
          alCerrar={() => {
            setVerCola(false);
            void cargarDatos();
          }}
        />
      )}
    </div>
  );
}

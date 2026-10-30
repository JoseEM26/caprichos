import { useState, useEffect, useCallback } from 'react';
import { useSesion } from '../../comun/sesion';
import { Confirmar } from '../../comun/Confirmar';
import { Cargando } from '../../comun/Cargando';
import {
  impresionApi,
  LlaveAgenteAdmin,
  TrabajoImpresionAdmin,
} from './impresionApi';
import { EstadoAdminImpresion } from '@caprichos/compartido';
import { ColaImpresion } from './ColaImpresion';

export function TarjetaImpresionEtiquetas() {
  const { usuario } = useSesion();
  const esAdmin = (usuario?.rol || '').toUpperCase() === 'ADMIN';

  const [verCola, setVerCola] = useState<boolean>(false);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const [estado, setEstado] = useState<EstadoAdminImpresion | null>(null);
  const [fallidos, setFallidos] = useState<TrabajoImpresionAdmin[]>([]);
  const [mostrarFallidos, setMostrarFallidos] = useState<boolean>(false);
  const [trabajoParaReintentar, setTrabajoParaReintentar] = useState<string | null>(null);
  const [reintentando, setReintentando] = useState<boolean>(false);

  // Gestión de llaves
  const [llaves, setLlaves] = useState<LlaveAgenteAdmin[]>([]);
  const [cargandoLlaves, setCargandoLlaves] = useState<boolean>(false);
  const [nombreNuevaLlave, setNombreNuevaLlave] = useState<string>('Agente Caja');
  const [creandoLlave, setCreandoLlave] = useState<boolean>(false);
  const [llaveCreadaReciente, setLlaveCreadaReciente] = useState<{
    nombre: string;
    llave: string;
  } | null>(null);
  const [copiado, setCopiado] = useState<boolean>(false);
  const [llaveParaDesactivar, setLlaveParaDesactivar] = useState<LlaveAgenteAdmin | null>(null);
  const [desactivando, setDesactivando] = useState<boolean>(false);

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

      if (esAdmin) {
        setCargandoLlaves(true);
        const lvs = await impresionApi.listarLlaves();
        setLlaves(lvs);
        setCargandoLlaves(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al cargar estado de impresión');
    } finally {
      setCargando(false);
    }
  }, [esAdmin]);

  useEffect(() => {
    cargarDatos();
    const interval = setInterval(cargarDatos, 10000); // Actualiza cada 10s
    return () => clearInterval(interval);
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

  const handleCrearLlave = async () => {
    setCreandoLlave(true);
    setError(null);
    try {
      const res = await impresionApi.crearLlave(nombreNuevaLlave.trim() || undefined);
      setLlaveCreadaReciente({ nombre: res.nombre, llave: res.llave });
      setCopiado(false);
      setMensajeExito('Llave del agente generada exitosamente.');
      await cargarDatos();
    } catch (err: any) {
      setError(err?.message || 'Error al generar la llave del agente');
    } finally {
      setCreandoLlave(false);
    }
  };

  const handleEjecutarDesactivar = async () => {
    if (!llaveParaDesactivar) return;
    setDesactivando(true);
    setError(null);
    try {
      await impresionApi.desactivarLlave(llaveParaDesactivar.id);
      setMensajeExito(`Llave "${llaveParaDesactivar.nombre}" desactivada.`);
      setLlaveParaDesactivar(null);
      await cargarDatos();
    } catch (err: any) {
      setError(err?.message || 'Error al desactivar la llave');
    } finally {
      setDesactivando(false);
    }
  };

  const copiarPortapapeles = async () => {
    if (!llaveCreadaReciente?.llave) return;
    try {
      await navigator.clipboard.writeText(llaveCreadaReciente.llave);
      setCopiado(true);
    } catch {
      // Fallback
    }
  };

  if (cargando && !estado) {
    return <Cargando mensaje="Consultando subsistema de impresión de etiquetas..." />;
  }

  const estaConectado = estado?.agente === 'conectado';
  const colorConexion = estaConectado ? 'var(--cp-green, #2F7A45)' : 'var(--cp-rust, #B2500F)';
  const bgConexion = estaConectado ? 'var(--cp-sand, #EDE1D1)' : '#FBE9DF';

  return (
    <div
      style={{
        background: 'var(--cp-white, #FFFFFF)',
        border: '1.5px solid var(--cp-line, #E3D6C6)',
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: '0 2px 8px rgba(11, 44, 62, 0.06)',
      }}
    >
      {/* Cabecera de la tarjeta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2
            style={{
              margin: 0,
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: 17,
              color: 'var(--cp-navy, #0B2C3E)',
            }}
          >
            Impresión de etiquetas
          </h2>
          <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)', marginTop: 2 }}>
            Agente local de caja (4BARCODE 4B-2054TH · 63.5 x 101.6 mm). Imprime las etiquetas de los pedidos; aquí ves si está conectado, el estado de la impresora y la cola de trabajos.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setVerCola(true)}
          style={{
            minHeight: 44,
            padding: '0 12px',
            border: 0,
            borderRadius: 8,
            background: 'var(--cp-navy, #0B2C3E)',
            color: 'var(--cp-cream, #FBF4EC)',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Gestionar cola
        </button>
        <button
          type="button"
          data-cfg-id="impresion-actualizar"
          title="Vuelve a consultar el estado del agente, la impresora y la cola. No cambia ninguna configuración."
          onClick={cargarDatos}
          style={{
            minHeight: 44,
            padding: '0 12px',
            border: '1px solid var(--cp-line, #E3D6C6)',
            borderRadius: 8,
            background: 'transparent',
            color: 'var(--cp-navy, #0B2C3E)',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Actualizar estado
        </button>
        </div>
      </div>

      {/* Avisos */}
      {error && (
        <div
          role="alert"
          style={{
            background: '#FBE9DF',
            color: 'var(--cp-rust, #B2500F)',
            padding: '10px 12px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      )}
      {mensajeExito && (
        <div
          role="status"
          style={{
            background: 'var(--cp-sand, #EDE1D1)',
            color: 'var(--cp-green, #2F7A45)',
            padding: '10px 12px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {mensajeExito}
        </div>
      )}

      {/* Panel de estado del agente e impresora */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
        }}
      >
        {/* Agente */}
        <div
          data-cfg-id="impresion-agente"
          tabIndex={-1}
          style={{
            border: '1px solid var(--cp-line, #E3D6C6)',
            borderRadius: 12,
            padding: 12,
            background: 'var(--cp-cream, #FBF4EC)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft, #2C4C5D)' }}>
            Agente local (PC Caja)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <span
              style={{
                display: 'inline-block',
                padding: '4px 8px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 800,
                color: colorConexion,
                background: bgConexion,
              }}
            >
              {estaConectado ? 'Conectado' : 'Sin conexión'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--cp-soft, #2C4C5D)', marginTop: 4 }}>
            {estado?.ultimoLatido
              ? `Último latido: ${new Date(estado.ultimoLatido).toLocaleTimeString()}`
              : 'Sin latidos registrados'}
          </div>
        </div>

        {/* Impresora */}
        <div
          style={{
            border: '1px solid var(--cp-line, #E3D6C6)',
            borderRadius: 12,
            padding: 12,
            background: 'var(--cp-cream, #FBF4EC)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft, #2C4C5D)' }}>
            Estado de impresora
          </div>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--cp-navy, #0B2C3E)', marginTop: 2 }}>
            {estado?.impresora === 'lista' && 'Lista para imprimir'}
            {estado?.impresora === 'sin_papel' && 'Sin papel'}
            {estado?.impresora === 'desconectada' && 'Desconectada'}
            {estado?.impresora === 'error' && 'Error reportado'}
            {!['lista', 'sin_papel', 'desconectada', 'error'].includes(estado?.impresora || '') &&
              (estado?.impresora || 'Desconocido')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--cp-soft, #2C4C5D)', marginTop: 4 }}>
            Sensor de rollo y cabezal. Si el agente no está conectado, las etiquetas esperan en la cola.
          </div>
        </div>

        {/* Cola de trabajos */}
        <div
          data-cfg-id="impresion-cola"
          tabIndex={-1}
          style={{
            border: '1px solid var(--cp-line, #E3D6C6)',
            borderRadius: 12,
            padding: 12,
            background: 'var(--cp-cream, #FBF4EC)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft, #2C4C5D)' }}>
            Cola de trabajos
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginTop: 2 }}>
            <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--cp-navy, #0B2C3E)' }}>
              {estado?.pendientes || 0} pendientes
            </span>
            <span
              style={{
                fontWeight: 700,
                fontSize: 13,
                color: (estado?.fallidos || 0) > 0 ? 'var(--cp-rust, #B2500F)' : 'var(--cp-soft, #2C4C5D)',
              }}
            >
              {estado?.fallidos || 0} fallidos
            </span>
          </div>
          {(estado?.fallidos || 0) > 0 && (
            <button
              type="button"
              onClick={() => setMostrarFallidos(!mostrarFallidos)}
              style={{
                alignSelf: 'flex-start',
                marginTop: 4,
                border: 0,
                background: 'transparent',
                color: 'var(--cp-rust, #B2500F)',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              {mostrarFallidos ? 'Ocultar fallidos' : 'Ver y reintentar fallidos'}
            </button>
          )}
        </div>
      </div>

      {/* Lista de trabajos fallidos */}
      {mostrarFallidos && (estado?.fallidos || 0) > 0 && (
        <div
          style={{
            border: '1.5px solid var(--cp-rust, #B2500F)',
            borderRadius: 12,
            padding: 14,
            background: '#FDF7F4',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--cp-rust, #B2500F)' }}>
            Trabajos de impresión fallidos
          </div>
          <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
            Llegaron a 5 intentos sin respuesta exitosa. Puedes devolverlos a la cola con Reintentar.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {fallidos.map((f) => (
              <div
                key={f.id}
                style={{
                  border: '1px solid var(--cp-line, #E3D6C6)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  background: 'var(--cp-white, #FFFFFF)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>
                    Trabajo #{f.id} · {f.tipo} · Pedido {f.pedidoCodigo}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                    Intentos: {f.intentos}/5 · Error: {f.error || 'Sin detalle de error'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setTrabajoParaReintentar(f.id)}
                  style={{
                    minHeight: 38,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: '1.5px solid var(--cp-navy, #0B2C3E)',
                    background: 'transparent',
                    color: 'var(--cp-navy, #0B2C3E)',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Reintentar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sección Gestión de llaves del agente (solo ADMIN) */}
      <div
        data-cfg-id="impresion-llaves"
        tabIndex={-1}
        style={{
          borderTop: '1px solid var(--cp-line, #E3D6C6)',
          paddingTop: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 15, color: 'var(--cp-navy, #0B2C3E)' }}>
              Llaves de autenticación del agente
            </div>
            <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
              Solo administradores. El agente local de la PC de Caja se autentica mediante esta llave.
            </div>
          </div>
        </div>

        {!esAdmin ? (
          <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)', fontStyle: 'italic' }}>
            Inicia sesión como Administrador para crear o desactivar llaves del agente.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Formulario para crear llave */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
                background: 'var(--cp-sand, #EDE1D1)',
                padding: 12,
                borderRadius: 10,
              }}
            >
              <input
                type="text"
                data-cfg-id="impresion-llave-nombre"
                aria-label="Nombre de la nueva llave"
                aria-describedby="impresion-llave-nombre-ayuda"
                value={nombreNuevaLlave}
                onChange={(e) => setNombreNuevaLlave(e.target.value)}
                placeholder="Nombre (ej: Agente PC Caja 1)"
                style={{
                  minHeight: 40,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: '1px solid var(--cp-line, #E3D6C6)',
                  flex: '1 1 200px',
                  fontSize: 13,
                }}
              />
              <button
                type="button"
                data-cfg-id="impresion-llave-crear"
                title="Genera una llave nueva; se muestra una sola vez."
                disabled={creandoLlave}
                onClick={handleCrearLlave}
                style={{
                  minHeight: 44,
                  padding: '0 16px',
                  borderRadius: 8,
                  border: 0,
                  background: 'var(--cp-navy, #0B2C3E)',
                  color: 'var(--cp-cream, #FBF4EC)',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: creandoLlave ? 'not-allowed' : 'pointer',
                }}
              >
                {creandoLlave ? 'Generando...' : 'Crear llave de agente'}
              </button>
            </div>

            <div id="impresion-llave-nombre-ayuda" style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
              El nombre solo sirve para reconocer a qué PC pertenece la llave (por ejemplo, Agente PC Caja 1). Al crearla se muestra una sola vez: cópiala antes de cerrar el aviso. Desactivar una llave deja a esa PC sin imprimir hasta darle una nueva.
            </div>

            {/* Lista de llaves */}
            {cargandoLlaves ? (
              <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>Cargando llaves...</div>
            ) : llaves.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                No hay llaves de agente registradas. Crea una para conectar la PC de Caja.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {llaves.map((ll) => (
                  <div
                    key={ll.id}
                    style={{
                      border: '1px solid var(--cp-line, #E3D6C6)',
                      borderRadius: 10,
                      padding: '10px 14px',
                      background: ll.activo ? 'var(--cp-white, #FFFFFF)' : '#F5F5F5',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                      opacity: ll.activo ? 1 : 0.7,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--cp-navy, #0B2C3E)' }}>
                        {ll.nombre}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                        {ll.llaveMuestra} · Creada el {new Date(ll.creadoEn).toLocaleDateString()}
                        {ll.ultimoLatido && ` · Último latido: ${new Date(ll.ultimoLatido).toLocaleTimeString()}`}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: ll.activo ? 'var(--cp-green, #2F7A45)' : 'var(--cp-soft, #2C4C5D)',
                        }}
                      >
                        {ll.activo ? 'Activa' : 'Desactivada'}
                      </span>
                      {ll.activo && (
                        <button
                          type="button"
                          onClick={() => setLlaveParaDesactivar(ll)}
                          style={{
                            minHeight: 36,
                            padding: '0 12px',
                            borderRadius: 8,
                            border: '1.5px solid var(--cp-rust, #B2500F)',
                            background: 'transparent',
                            color: 'var(--cp-rust, #B2500F)',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Desactivar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Llave creada mostrada una sola vez */}
      {llaveCreadaReciente && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Llave de agente creada"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 120,
            background: 'rgba(11, 44, 62, 0.7)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              background: 'var(--cp-white, #FFFFFF)',
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 16px 40px rgba(11, 44, 62, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: 18,
                color: 'var(--cp-navy, #0B2C3E)',
              }}
            >
              Llave generada para {llaveCreadaReciente.nombre}
            </h3>

            <div
              role="alert"
              style={{
                fontSize: 13,
                lineHeight: '19px',
                color: 'var(--cp-rust, #B2500F)',
                background: '#FBE9DF',
                padding: '10px 14px',
                borderRadius: 8,
                fontWeight: 700,
              }}
            >
              IMPORTANTE: Esta llave se muestra una sola vez. No se volverá a mostrar en el sistema ni se guarda en texto plano en la base de datos.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft, #2C4C5D)' }}>
                Llave de autorización (Bearer Token):
              </span>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <input
                  type="text"
                  readOnly
                  value={llaveCreadaReciente.llave}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    padding: '0 12px',
                    fontFamily: 'monospace',
                    fontSize: 13,
                    borderRadius: 8,
                    border: '1.5px solid var(--cp-navy, #0B2C3E)',
                    background: '#F8F9FA',
                  }}
                />
                <button
                  type="button"
                  onClick={copiarPortapapeles}
                  style={{
                    minHeight: 44,
                    padding: '0 14px',
                    borderRadius: 8,
                    border: '1.5px solid var(--cp-navy, #0B2C3E)',
                    background: copiado ? 'var(--cp-green, #2F7A45)' : 'var(--cp-navy, #0B2C3E)',
                    color: 'var(--cp-white, #FFFFFF)',
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setLlaveCreadaReciente(null)}
                style={{
                  minHeight: 44,
                  padding: '0 20px',
                  borderRadius: 10,
                  border: 0,
                  background: 'var(--cp-navy, #0B2C3E)',
                  color: 'var(--cp-cream, #FBF4EC)',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Entendido, ya la copié
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar: Reintentar trabajo */}
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

      {/* Confirmar: Desactivar llave */}
      {Boolean(llaveParaDesactivar) && (
        <Confirmar
          abierto={Boolean(llaveParaDesactivar)}
          titulo={`¿Desactivar llave de agente "${llaveParaDesactivar?.nombre}"?`}
          mensaje="El agente que utilice esta llave ya no podrá autenticarse. Nada se elimina de la base de datos."
          textoSi="Sí, desactivar"
          textoNo="No, cancelar"
          peligro
          cargando={desactivando}
          alConfirmar={handleEjecutarDesactivar}
          alCancelar={() => setLlaveParaDesactivar(null)}
        />
      )}
      {verCola && <ColaImpresion alCerrar={() => { setVerCola(false); void cargarDatos(); }} />}
    </div>
  );
}

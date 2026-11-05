import { useState, useEffect, useCallback } from 'react';
import type { EstadoAdminImpresion, RolImpresora } from '@caprichos/compartido';
import { useSesion } from '../../comun/sesion';
import { Confirmar } from '../../comun/Confirmar';
import { Cargando } from '../../comun/Cargando';
import { impresionApi, LlaveAgenteAdmin } from './impresionApi';
import { PanelInstalarPrograma } from './PanelInstalarPrograma';
import { NOMBRE_MAQUINA, useEstadoMaquinas } from './useEstadoMaquinas';

const TIPO_MAQUINA: Record<RolImpresora, string> = { ETIQUETERA: 'etiquetas', TICKETERA: 'tickets' };

const tarjeta = {
  border: '1px solid var(--cp-line, #E3D6C6)',
  borderRadius: 12,
  padding: 12,
  background: 'var(--cp-cream, #FBF4EC)',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 4,
};

/** Sección «Equipos y estado»: agente de la PC de Caja, impresoras, llaves de vinculación e instalar programa. */
export function SeccionEquipos() {
  const { usuario } = useSesion();
  const esAdmin = (usuario?.rol || '').toUpperCase() === 'ADMIN';
  const { maquinas, recargar: recargarMaquinas } = useEstadoMaquinas();

  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoAdminImpresion | null>(null);
  const [instalar, setInstalar] = useState<boolean>(false);

  // Gestión de llaves
  const [llaves, setLlaves] = useState<LlaveAgenteAdmin[]>([]);
  const [cargandoLlaves, setCargandoLlaves] = useState<boolean>(false);
  const [nombreNuevaLlave, setNombreNuevaLlave] = useState<string>('Agente Caja');
  const [creandoLlave, setCreandoLlave] = useState<boolean>(false);
  const [llaveCreadaReciente, setLlaveCreadaReciente] = useState<{ nombre: string; llave: string } | null>(null);
  const [copiado, setCopiado] = useState<boolean>(false);
  const [llaveParaDesactivar, setLlaveParaDesactivar] = useState<LlaveAgenteAdmin | null>(null);
  const [desactivando, setDesactivando] = useState<boolean>(false);

  const cargarDatos = useCallback(async () => {
    setError(null);
    try {
      setEstado(await impresionApi.obtenerEstado());
      if (esAdmin) {
        setCargandoLlaves(true);
        setLlaves(await impresionApi.listarLlaves());
        setCargandoLlaves(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al cargar el estado de los equipos');
    } finally {
      setCargando(false);
      setCargandoLlaves(false);
    }
  }, [esAdmin]);

  useEffect(() => {
    void cargarDatos();
    const intervalo = setInterval(() => void cargarDatos(), 10000); // Actualiza cada 10s
    return () => clearInterval(intervalo);
  }, [cargarDatos]);

  const actualizar = () => {
    void recargarMaquinas();
    void cargarDatos();
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
    return <Cargando mensaje="Consultando el estado de los equipos de impresión..." />;
  }

  const estaConectado = estado?.agente === 'conectado';
  const colorConexion = estaConectado ? 'var(--cp-green, #2F7A45)' : 'var(--cp-rust, #B2500F)';
  const bgConexion = estaConectado ? 'var(--cp-sand, #EDE1D1)' : '#FBE9DF';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <h3 style={{ margin: 0, fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 17, color: 'var(--cp-navy, #0B2C3E)' }}>
            Equipos y estado
          </h3>
          <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)', marginTop: 2 }}>
            Agente local de la PC de Caja (4BARCODE 4B-2054TH · 63.5 x 101.6 mm). Aquí ves si está conectado, el estado de cada impresora y las llaves con las que se vincula.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            data-cfg-id="impresion-actualizar"
            title="Vuelve a consultar el estado del agente, la impresora y la cola. No cambia ninguna configuración."
            onClick={actualizar}
            style={{ minHeight: 44, padding: '0 12px', borderRadius: 8, border: '1px solid var(--cp-line, #E3D6C6)', background: 'transparent', color: 'var(--cp-navy, #0B2C3E)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Actualizar estado
          </button>
          <button
            type="button"
            data-cfg-id="impresion-instalar"
            title="Descarga el programa para la PC de Caja y lo vincula con un código de un solo uso."
            onClick={() => setInstalar(true)}
            style={{ minHeight: 44, padding: '0 12px', borderRadius: 8, border: 0, background: 'var(--cp-navy, #0B2C3E)', color: 'var(--cp-cream, #FBF4EC)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Instalar o vincular programa
          </button>
        </div>
      </div>

      <section aria-labelledby="equipos-agregar" style={tarjeta}>
        <h4 id="equipos-agregar" style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--cp-navy, #0B2C3E)' }}>
          Agregar un equipo a un área
        </h4>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
          El mismo programa sirve para todas las computadoras: el área se elige aquí, no en el programa.
        </p>
        <ol style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: 13, lineHeight: '22px' }}>
          <li>Genera un código de vinculación con «Instalar o vincular programa».</li>
          <li>Instala el programa en la computadora de esa área y vincúlala con el código.</li>
          <li>En el Mapa, elige su área con «+ Asignar equipo» (o con su selector «Imprime lo de»).</li>
        </ol>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
          Un solo equipo por área y tipo de máquina, y uno en Caja. Si el área ya tiene uno, el Mapa pregunta antes de reemplazarlo.
        </p>
      </section>

      <section aria-labelledby="equipos-cambiar" style={tarjeta}>
        <h4 id="equipos-cambiar" style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--cp-navy, #0B2C3E)' }}>
          Cambiar la computadora de un área
        </h4>
        <ol style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: 13, lineHeight: '22px' }}>
          <li>Instala el programa en la computadora nueva y vincúlala con un código de vinculación.</li>
          <li>En el Mapa, pulsa «Reemplazar este equipo» en la máquina del área y elige la nueva.</li>
          <li>Listo: la vieja se desactiva y sus trabajos pendientes los imprime la nueva.</li>
        </ol>
      </section>

      <section aria-labelledby="equipos-red" style={tarjeta}>
        <h4 id="equipos-red" style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--cp-navy, #0B2C3E)' }}>
          Ticketera de red (por IP)
        </h4>
        <ol style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: 13, lineHeight: '22px' }}>
          <li>Ticketera de red: instálala con su IP fija. En el programa elige «Impresora de RED por IP» y escribe su IP.</li>
          <li>Pide a quien instale que reserve esa IP en el router para que no cambie.</li>
        </ol>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
          Si se va el internet, la computadora y la impresora de red siguen hablándose por la red local, pero los pedidos nuevos no llegan hasta que vuelva internet. Los trabajos ya en cola se imprimen al reconectar (hasta 3 horas, parámetro impresion_vence_min).
        </p>
      </section>

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {/* Agente */}
        <div data-cfg-id="impresion-agente" tabIndex={-1} style={tarjeta}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft, #2C4C5D)' }}>Agente local (PC Caja)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 800, color: colorConexion, background: bgConexion }}>
              {estaConectado ? 'Conectado' : 'Sin conexión'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--cp-soft, #2C4C5D)', marginTop: 4 }}>
            {estado?.ultimoLatido ? `Último latido: ${new Date(estado.ultimoLatido).toLocaleTimeString()}` : 'Sin latidos registrados'}
          </div>
        </div>

        {/* Impresora */}
        <div style={tarjeta}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft, #2C4C5D)' }}>Estado de impresora</div>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--cp-navy, #0B2C3E)', marginTop: 2 }}>
            {estado?.impresora === 'lista' && 'Lista para imprimir'}
            {estado?.impresora === 'sin_papel' && 'Sin papel'}
            {estado?.impresora === 'desconectada' && 'Desconectada'}
            {estado?.impresora === 'sin_permiso' && 'Sin permiso para usar la impresora'}
            {estado?.impresora === 'error' && 'Error reportado'}
            {!['lista', 'sin_papel', 'desconectada', 'sin_permiso', 'error'].includes(estado?.impresora || '') &&
              (estado?.impresora || 'Desconocido')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--cp-soft, #2C4C5D)', marginTop: 4 }}>
            Sensor de rollo y cabezal. Si el agente no está conectado, las etiquetas esperan en la cola.
          </div>
        </div>

        {/* Máquinas: etiquetera y ticketera */}
        {(['ETIQUETERA', 'TICKETERA'] as RolImpresora[]).map((rol) => {
          const m = maquinas?.[rol];
          return (
            <div key={rol} data-testid={`maquina-${rol.toLowerCase()}`} style={tarjeta}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft, #2C4C5D)' }}>
                {NOMBRE_MAQUINA[rol]} ({TIPO_MAQUINA[rol]})
              </div>
              <div style={{ fontWeight: 800, fontSize: 14, color: m?.conectada ? 'var(--cp-green, #2F7A45)' : 'var(--cp-rust, #B2500F)', marginTop: 2 }}>
                {m?.conectada ? 'Conectada' : 'No conectada'}
              </div>
              {m?.conectada && m?.detalle && (
                <div style={{ fontSize: 11, color: 'var(--cp-soft, #2C4C5D)', marginTop: 4 }}>{m.detalle}</div>
              )}
              {!m?.conectada && m?.motivo && (
                <div style={{ fontSize: 11, color: 'var(--cp-soft, #2C4C5D)', marginTop: 4 }}>{m.motivo}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Llaves de autenticación del agente (solo ADMIN crea o desactiva) */}
      <div
        data-cfg-id="impresion-llaves"
        tabIndex={-1}
        style={{ borderTop: '1px solid var(--cp-line, #E3D6C6)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 15, color: 'var(--cp-navy, #0B2C3E)' }}>
            Llaves de autenticación del agente
          </div>
          <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
            Solo administradores. El agente local de la PC de Caja se autentica mediante esta llave.
          </div>
        </div>

        {!esAdmin ? (
          <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)', fontStyle: 'italic' }}>
            Inicia sesión como Administrador para crear o desactivar llaves del agente.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Formulario para crear llave */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'var(--cp-sand, #EDE1D1)', padding: 12, borderRadius: 10 }}>
              <input
                type="text"
                data-cfg-id="impresion-llave-nombre"
                aria-label="Nombre de la nueva llave"
                aria-describedby="impresion-llave-nombre-ayuda"
                value={nombreNuevaLlave}
                onChange={(e) => setNombreNuevaLlave(e.target.value)}
                placeholder="Nombre (ej: Agente PC Caja 1)"
                style={{ minHeight: 44, padding: '0 12px', borderRadius: 8, border: '1px solid var(--cp-line, #E3D6C6)', flex: '1 1 200px', fontSize: 13 }}
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
                      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--cp-navy, #0B2C3E)' }}>{ll.nombre}</div>
                      <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                        {ll.llaveMuestra} · Creada el {new Date(ll.creadoEn).toLocaleDateString()}
                        {ll.ultimoLatido && ` · Último latido: ${new Date(ll.ultimoLatido).toLocaleTimeString()}`}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: ll.activo ? 'var(--cp-green, #2F7A45)' : 'var(--cp-soft, #2C4C5D)' }}>
                        {ll.activo ? 'Activa' : 'Desactivada'}
                      </span>
                      {ll.activo && (
                        <button
                          type="button"
                          onClick={() => setLlaveParaDesactivar(ll)}
                          style={{ minHeight: 44, padding: '0 12px', borderRadius: 8, border: '1.5px solid var(--cp-rust, #B2500F)', background: 'transparent', color: 'var(--cp-rust, #B2500F)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
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

      {/* Modal: llave creada, se muestra una sola vez */}
      {llaveCreadaReciente && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Llave de agente creada"
          style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(11, 44, 62, 0.7)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div style={{ width: '100%', maxWidth: 480, background: 'var(--cp-white, #FFFFFF)', borderRadius: 20, padding: 24, boxShadow: '0 16px 40px rgba(11, 44, 62, 0.25)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--cp-navy, #0B2C3E)' }}>
              Llave generada para {llaveCreadaReciente.nombre}
            </h3>

            <div role="alert" style={{ fontSize: 13, lineHeight: '19px', color: 'var(--cp-rust, #B2500F)', background: '#FBE9DF', padding: '10px 14px', borderRadius: 8, fontWeight: 700 }}>
              IMPORTANTE: Esta llave se muestra una sola vez. No se volverá a mostrar en el sistema ni se guarda en texto plano en la base de datos.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft, #2C4C5D)' }}>Llave de autorización (Bearer Token):</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  readOnly
                  value={llaveCreadaReciente.llave}
                  style={{ flex: 1, minHeight: 44, padding: '0 12px', fontFamily: 'monospace', fontSize: 13, borderRadius: 8, border: '1.5px solid var(--cp-navy, #0B2C3E)', background: '#F8F9FA' }}
                />
                <button
                  type="button"
                  onClick={copiarPortapapeles}
                  style={{ minHeight: 44, padding: '0 14px', borderRadius: 8, border: '1.5px solid var(--cp-navy, #0B2C3E)', background: copiado ? 'var(--cp-green, #2F7A45)' : 'var(--cp-navy, #0B2C3E)', color: 'var(--cp-white, #FFFFFF)', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                >
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setLlaveCreadaReciente(null)}
                style={{ minHeight: 44, padding: '0 20px', borderRadius: 10, border: 0, background: 'var(--cp-navy, #0B2C3E)', color: 'var(--cp-cream, #FBF4EC)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
              >
                Entendido, ya la copié
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar: desactivar llave */}
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

      {instalar && <PanelInstalarPrograma alCerrar={() => setInstalar(false)} />}
    </div>
  );
}

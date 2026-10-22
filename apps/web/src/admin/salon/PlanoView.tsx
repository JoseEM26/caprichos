import { useCallback, useEffect, useState } from 'react';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { DisenoCompletoJson, PisoPlano, PisoSalon } from './tipos';
import { BarraControlesPlano } from './componentes/BarraControlesPlano';
import { CuadriculaPlano } from './componentes/CuadriculaPlano';
import { ModalEditarElemento } from './componentes/ModalEditarElemento';
import { ModalDisenoTexto } from './componentes/ModalDisenoTexto';
import { ModalNuevoPedidoMesa } from './componentes/ModalNuevoPedidoMesa';
import { useSalonSocket } from './useSalonSocket';
import { salonApi } from './api';

export function PlanoView() {
  const { tiene } = useSesion();
  const puedeVer = tiene('plano/ver');
  const puedeEditar = tiene('plano/editar');

  // Pisos del plano
  const [pisos, setPisos] = useState<PisoPlano[]>([]);
  const [pisoActivoId, setPisoActivoId] = useState<string>('1');

  // Mesas formateadas del salón (con estado derivado LIBRE / OCUPADA)
  const [pisosSalon, setPisosSalon] = useState<PisoSalon[]>([]);

  // Herramienta activa para colocar elementos tocando la cuadrícula
  const [herramientaActiva, setHerramientaActiva] = useState<string | null>(null);

  // Elemento seleccionado para inspeccionar / editar
  const [elementoSeleccionadoId, setElementoSeleccionadoId] = useState<string | null>(null);

  // Modales
  const [modalDisenoAbierto, setModalDisenoAbierto] = useState(false);
  const [modalNuevoPedidoAbierto, setModalNuevoPedidoAbierto] = useState(false);

  // Estados de carga y error
  const [cargando, setCargando] = useState(true);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [errorOperacion, setErrorOperacion] = useState<string | null>(null);
  const [errorCuadricula, setErrorCuadricula] = useState<string | null>(null);
  const [elementosFuera, setElementosFuera] = useState<
    Array<{ id: string; tipo: string; nombre?: string; numero?: number }>
  >([]);

  // Detalles ante MESA_EN_USO
  const [detallesMesaEnUso, setDetallesMesaEnUso] = useState<{
    motivo: string;
    mensaje: string;
    sugerencia?: string;
  } | null>(null);

  // Cargar datos del plano y salón
  const cargarDatos = useCallback(async () => {
    try {
      setErrorGlobal(null);
      const [datosPlano, datosSalon] = await Promise.all([
        salonApi.obtenerPlano(),
        salonApi.obtenerMesas(),
      ]);

      setPisos(datosPlano || []);
      setPisosSalon(datosSalon.pisos || []);

      // Conservar piso seleccionado si existe, sino tomar el primero
      setPisoActivoId((prev) => {
        if (datosPlano && datosPlano.some((p) => p.id === prev)) {
          return prev;
        }
        return datosPlano?.[0]?.id || '1';
      });
    } catch (err: any) {
      setErrorGlobal(
        err?.message || 'No fue posible cargar el plano del local.',
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Socket en tiempo real para avisos y estado de mesas
  const { avisoListo, cerrarAvisoListo } = useSalonSocket({
    onMesaCambio: () => {
      // Refrescar estado de mesas ante evento salon:mesa
      salonApi.obtenerMesas().then((res) => {
        if (res?.pisos) setPisosSalon(res.pisos);
      }).catch(() => {});
    },
    onPlanoCambio: () => {
      cargarDatos();
    },
  });

  // Piso actual en vista
  const pisoActual = pisos.find((p) => p.id === pisoActivoId) || pisos[0];
  const pisoSalonActual = pisosSalon.find((p) => p.id === pisoActivoId);

  // Elemento actualmente seleccionado
  const elementoSeleccionado =
    pisoActual?.elementos?.find((e) => e.id === elementoSeleccionadoId) || null;

  // 1. Colocar elemento tocando la cuadrícula
  const handleColocarElemento = async (x: number, y: number) => {
    if (!puedeEditar) {
      setErrorOperacion('No tienes permiso para editar el plano.');
      return;
    }
    if (!herramientaActiva || !pisoActual) return;

    setErrorOperacion(null);
    setDetallesMesaEnUso(null);

    const esMesa = herramientaActiva === 'MESA';
    let ancho = 2;
    let alto = 2;

    if (herramientaActiva === 'PARED') {
      ancho = 4;
      alto = 1;
    } else if (herramientaActiva === 'COCINA') {
      ancho = 5;
      alto = 3;
    } else if (herramientaActiva === 'BARRA') {
      ancho = 6;
      alto = 2;
    } else if (herramientaActiva === 'BANO') {
      ancho = 3;
      alto = 3;
    } else if (herramientaActiva === 'ENTRADA') {
      ancho = 4;
      alto = 1;
    } else if (herramientaActiva === 'ESCALERA') {
      ancho = 2;
      alto = 3;
    } else if (herramientaActiva === 'CAJA') {
      ancho = 3;
      alto = 2;
    }

    try {
      const nuevo = await salonApi.crearElemento({
        pisoId: pisoActual.id,
        tipo: herramientaActiva,
        x,
        y,
        ancho,
        alto,
        asientos: esMesa ? 4 : undefined,
      });

      await cargarDatos();
      if (nuevo?.id) {
        setElementoSeleccionadoId(String(nuevo.id));
      }
    } catch (err: any) {
      if (err?.codigo === 'SUPERPUESTO') {
        setErrorOperacion(
          'No se puede colocar el elemento: se superpone con otro elemento activo en esa posición.',
        );
      } else if (err?.codigo === 'FUERA_DE_CUADRICULA') {
        setErrorOperacion(
          'El elemento no cabe en esa posición: queda fuera de los límites de la cuadrícula.',
        );
      } else {
        setErrorOperacion(err?.message || 'Error al colocar elemento en el plano.');
      }
    }
  };

  // 2. Mover elemento arrastrándolo
  const handleMoverElemento = async (
    id: string,
    nuevoX: number,
    nuevoY: number,
  ) => {
    if (!puedeEditar) {
      setErrorOperacion('No tienes permiso para editar el plano.');
      return;
    }
    setErrorOperacion(null);
    setDetallesMesaEnUso(null);

    try {
      await salonApi.actualizarElemento(id, { x: nuevoX, y: nuevoY });
      await cargarDatos();
    } catch (err: any) {
      if (err?.codigo === 'SUPERPUESTO') {
        setErrorOperacion(
          'No se puede mover aquí: se superpone con otro elemento activo.',
        );
      } else if (err?.codigo === 'FUERA_DE_CUADRICULA') {
        setErrorOperacion('El elemento quedaría fuera de la cuadrícula.');
      } else {
        setErrorOperacion(err?.message || 'Error al mover elemento.');
      }
      // Revertir recargando datos
      await cargarDatos();
    }
  };

  // 3. Girar elemento
  const handleGirarElemento = async (id: string) => {
    if (!puedeEditar) {
      setErrorOperacion('No tienes permiso para editar el plano.');
      return;
    }
    setErrorOperacion(null);
    setDetallesMesaEnUso(null);

    try {
      await salonApi.girarElemento(id);
      await cargarDatos();
    } catch (err: any) {
      if (err?.codigo === 'NO_CABE' || err?.codigo === 'SUPERPUESTO') {
        setErrorOperacion(
          err.message ||
            'El elemento no cabe en la cuadrícula al girar en su posición actual o se superpone con otro elemento.',
        );
      } else {
        setErrorOperacion(err?.message || 'Error al girar elemento.');
      }
    }
  };

  // 4. Actualizar propiedades (nombre, asientos, ancho, alto)
  const handleActualizarPropiedades = async (
    id: string,
    cambios: {
      nombre?: string;
      asientos?: number;
      ancho?: number;
      alto?: number;
    },
  ) => {
    if (!puedeEditar) {
      setErrorOperacion('No tienes permiso para editar el plano.');
      return;
    }
    setErrorOperacion(null);
    setDetallesMesaEnUso(null);

    try {
      await salonApi.actualizarElemento(id, cambios);
      await cargarDatos();
    } catch (err: any) {
      if (err?.codigo === 'SUPERPUESTO') {
        setErrorOperacion(
          'No se puede redimensionar: se superpondría con otro elemento activo.',
        );
      } else if (err?.codigo === 'FUERA_DE_CUADRICULA') {
        setErrorOperacion('El nuevo tamaño sobrepasa los límites de la cuadrícula.');
      } else {
        setErrorOperacion(err?.message || 'Error al actualizar elemento.');
      }
    }
  };

  // 5. Alternar activo / desactivar elemento
  const handleAlternarActivo = async (id: string, nuevoActivo: boolean) => {
    if (!puedeEditar) {
      setErrorOperacion('No tienes permiso para editar el plano.');
      return;
    }
    setErrorOperacion(null);
    setDetallesMesaEnUso(null);

    try {
      await salonApi.actualizarElemento(id, { activo: nuevoActivo });
      await cargarDatos();
    } catch (err: any) {
      if (err?.codigo === 'SUPERPUESTO') {
        setErrorOperacion(
          'No se puede activar: su posición se superpone con otro elemento actualmente activo.',
        );
      } else {
        setErrorOperacion(err?.message || 'Error al cambiar estado del elemento.');
      }
    }
  };

  // 6. Eliminar elemento (manejo de MESA_EN_USO)
  const handleEliminarElemento = async (id: string) => {
    if (!puedeEditar) {
      setErrorOperacion('No tienes permiso para editar el plano.');
      return;
    }
    setErrorOperacion(null);
    setDetallesMesaEnUso(null);

    try {
      await salonApi.eliminarElemento(id);
      setElementoSeleccionadoId(null);
      await cargarDatos();
    } catch (err: any) {
      if (err?.codigo === 'MESA_EN_USO') {
        setDetallesMesaEnUso({
          motivo:
            err.detalles?.motivo ||
            err.motivo ||
            'Tiene un pedido abierto o reserva activa hoy',
          mensaje:
            err.message ||
            'Esta mesa tiene un pedido abierto o una reserva activa hoy y no se puede eliminar. Puedes desactivarla en su lugar.',
          sugerencia: 'desactivar',
        });
      } else {
        setErrorOperacion(err?.message || 'Error al eliminar elemento.');
      }
    }
  };

  // 7. Alternar activación de piso (piso 1 no desactivable: PISO_PRINCIPAL)
  const handleAlternarPiso = async (id: string, nuevoActivo: boolean) => {
    if (!puedeEditar) {
      setErrorOperacion('No tienes permiso para editar pisos.');
      return;
    }
    setErrorOperacion(null);

    try {
      await salonApi.actualizarPiso(id, { activo: nuevoActivo });
      await cargarDatos();
    } catch (err: any) {
      if (err?.codigo === 'PISO_PRINCIPAL') {
        setErrorOperacion('El piso 1 no se puede desactivar.');
      } else {
        setErrorOperacion(err?.message || 'Error al cambiar estado del piso.');
      }
    }
  };

  // 8. Cambiar tamaño de cuadrícula (ELEMENTOS_FUERA con lista)
  const handleCambiarCuadricula = async (
    pisoId: string,
    nuevoAncho: number,
    nuevoAlto: number,
  ) => {
    if (!puedeEditar) {
      setErrorCuadricula('No tienes permiso para modificar la cuadrícula.');
      return;
    }
    setErrorCuadricula(null);
    setElementosFuera([]);

    try {
      await salonApi.actualizarPiso(pisoId, {
        cuadriculaAncho: nuevoAncho,
        cuadriculaAlto: nuevoAlto,
      });
      await cargarDatos();
    } catch (err: any) {
      if (err?.codigo === 'ELEMENTOS_FUERA') {
        setErrorCuadricula(
          err.message ||
            'Existen elementos que quedarían fuera del nuevo tamaño de cuadrícula.',
        );
        const elems = err.detalles?.elementos || err.elementos || [];
        setElementosFuera(elems);
      } else {
        setErrorCuadricula(err?.message || 'Error al cambiar tamaño de cuadrícula.');
      }
    }
  };

  // 9. Aplicar diseño pegado en texto
  const handleAplicarDiseno = async (diseno: DisenoCompletoJson) => {
    if (!puedeEditar) {
      throw new Error('No tienes permiso para editar el diseño del plano.');
    }
    await salonApi.aplicarDiseno(diseno);
    await cargarDatos();
  };

  // Estado sin permiso
  if (!puedeVer) {
    return (
      <div
        role="region"
        aria-label="Sin permiso para ver el plano"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '24px',
          textAlign: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '28px',
            background: '#FBEDE9',
            border: '2px solid var(--cp-rust)',
            color: 'var(--cp-rust)',
            fontSize: '24px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          !
        </div>
        <h2
          style={{
            fontFamily: 'var(--fuente-titulos)',
            fontWeight: 800,
            fontSize: '18px',
            color: 'var(--cp-navy)',
          }}
        >
          No tienes permiso
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--cp-soft)', maxWidth: '380px' }}>
          No tienes los permisos requeridos (plano/ver) para acceder al plano del local.
        </p>
      </div>
    );
  }

  if (cargando) {
    return <Cargando mensaje="Cargando plano del local..." pantallaCompleta={false} />;
  }

  if (errorGlobal) {
    return (
      <EstadoError
        titulo="Error al cargar plano"
        mensaje={errorGlobal}
        alReintentar={cargarDatos}
      />
    );
  }

  const columnas =
    pisoActual?.cuadriculaAncho || pisoActual?.cuadricula_ancho || 20;
  const filas =
    pisoActual?.cuadriculaAlto || pisoActual?.cuadricula_alto || 12;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
        minHeight: '85vh',
      }}
    >
      {/* Toast de aviso en vivo de Socket.IO (salon:listo) */}
      {avisoListo && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            zIndex: 90,
            bottom: '24px',
            right: '24px',
            maxWidth: '420px',
            background: 'var(--cp-navy)',
            color: 'var(--cp-cream)',
            borderLeft: '6px solid var(--cp-ok)',
            borderRadius: '14px',
            padding: '12px 16px',
            boxShadow: '0 12px 36px rgba(11, 44, 62, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: '#7DDB9B',
                letterSpacing: '0.04em',
              }}
            >
              ¡PEDIDO LISTO EN COCINA!
            </div>
            <div style={{ fontWeight: 800, fontSize: '15px' }}>
              Pedido {avisoListo.codigo} de {avisoListo.mesas.join(', ')}
            </div>
            <div style={{ fontSize: '11px', color: '#C9D6DD' }}>
              Hora: {avisoListo.recibidoEn} · Listo para servir en mesa
            </div>
          </div>
          <button
            type="button"
            onClick={cerrarAvisoListo}
            aria-label="Cerrar aviso"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '16px',
              border: 0,
              background: 'rgba(255,255,255,0.15)',
              color: 'var(--cp-cream)',
              fontSize: '16px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            x
          </button>
        </div>
      )}

      {/* 1. BARRA DE CONTROLES ARRIBA */}
      <BarraControlesPlano
        pisos={pisos}
        pisoActivoId={pisoActivoId}
        onCambiarPiso={(id) => {
          setPisoActivoId(id);
          setElementoSeleccionadoId(null);
          setHerramientaActiva(null);
        }}
        onAlternarPiso={handleAlternarPiso}
        onCambiarCuadricula={handleCambiarCuadricula}
        herramientaActiva={herramientaActiva}
        onSeleccionarHerramienta={(t) => {
          setHerramientaActiva(t);
          if (t) setElementoSeleccionadoId(null);
        }}
        onAbrirDisenoTexto={() => setModalDisenoAbierto(true)}
        onAbrirNuevoPedidoMesa={() => setModalNuevoPedidoAbierto(true)}
        errorCuadricula={errorCuadricula}
        elementosFuera={elementosFuera}
        alLimpiarError={() => {
          setErrorCuadricula(null);
          setElementosFuera([]);
        }}
      />

      {/* 2. ÁREA PRINCIPAL: PLANO A PANTALLA COMPLETA + INSPECTOR */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'flex-start',
        }}
      >
        {/* Contenedor del plano casi a pantalla completa */}
        <div
          style={{
            flex: '3 1 600px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <CuadriculaPlano
            columnas={columnas}
            filas={filas}
            elementos={pisoActual?.elementos || []}
            elementoSeleccionadoId={elementoSeleccionadoId}
            onSeleccionarElemento={(elem) => {
              setElementoSeleccionadoId(elem ? elem.id : null);
              setErrorOperacion(null);
              setDetallesMesaEnUso(null);
            }}
            herramientaActiva={herramientaActiva}
            onColocarElemento={handleColocarElemento}
            onMoverElemento={handleMoverElemento}
            mesasSalon={pisoSalonActual?.mesas || []}
            modoSalon={false}
          />

          <div style={{ fontSize: '12px', color: 'var(--cp-soft)', lineHeight: '18px' }}>
            Arrastra los elementos con el dedo o ratón para moverlos dentro de los límites de la cuadrícula. Se puede eliminar cualquier elemento; una mesa con pedidos cerrados conserva su nombre histórico. Solo una mesa con pedido abierto o reserva activa hoy no se elimina: se desactiva.
          </div>
        </div>

        {/* Panel lateral de edición de elemento seleccionado */}
        {elementoSeleccionado && (
          <div style={{ flex: '1 1 300px', minWidth: '280px' }}>
            <ModalEditarElemento
              elemento={elementoSeleccionado}
              alCerrar={() => setElementoSeleccionadoId(null)}
              alActualizarPropiedades={handleActualizarPropiedades}
              alGirar={handleGirarElemento}
              alAlternarActivo={handleAlternarActivo}
              alEliminar={handleEliminarElemento}
              errorOperacion={errorOperacion}
              alLimpiarError={() => {
                setErrorOperacion(null);
                setDetallesMesaEnUso(null);
              }}
              detallesMesaEnUso={detallesMesaEnUso}
            />
          </div>
        )}
      </div>

      {/* Modal para ver, copiar y pegar diseño completo en texto */}
      <ModalDisenoTexto
        abierto={modalDisenoAbierto}
        disenoActual={{
          floors: pisos.map((p) => ({
            id: p.id,
            n: p.nombre,
            on: p.activo,
          })),
          dims: pisos.reduce((acc, p) => {
            acc[p.id] = {
              c: p.cuadriculaAncho || p.cuadricula_ancho || 20,
              r: p.cuadriculaAlto || p.cuadricula_alto || 12,
            };
            return acc;
          }, {} as Record<string, { c?: number; r?: number }>),
          plan: pisos.reduce((acc, p) => {
            acc[p.id] = (p.elementos || []).map((e) => ({
              id: e.id,
              t: e.tipo.toLowerCase(),
              x: e.x,
              y: e.y,
              w: e.ancho,
              h: e.alto,
              label: e.nombre || undefined,
              seats: e.asientos || undefined,
              on: e.activo,
            }));
            return acc;
          }, {} as Record<string, any[]>),
        }}
        alCerrar={() => setModalDisenoAbierto(false)}
        alAplicarDiseno={handleAplicarDiseno}
      />

      {/* Modal de Nuevo Pedido de Mesa del mozo */}
      <ModalNuevoPedidoMesa
        abierto={modalNuevoPedidoAbierto}
        alCerrar={() => setModalNuevoPedidoAbierto(false)}
        pisos={pisosSalon}
        alRefrescarMesas={cargarDatos}
      />
    </div>
  );
}

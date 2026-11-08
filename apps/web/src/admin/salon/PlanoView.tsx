import { useCallback, useEffect, useState, useMemo } from 'react';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import { ElementoPlano, MesaSalon, PisoPlano, PisoSalon } from './tipos';
import { ModalNuevoPedidoMesa } from './componentes/ModalNuevoPedidoMesa';
import { ModalPrecuenta } from './componentes/ModalPrecuenta';
import { useSalonSocket } from './useSalonSocket';
import { useMantenerPresionado } from './useMantenerPresionado';
import { VistaPreviaMesa } from './componentes/VistaPreviaMesa';
import { useCambioDeMesa, useSumarMesas } from './componentes/CambioDeMesa';
import { salonApi } from './api';
import './salon.css';

export const EL_CONFIG: Record<
  string,
  { n: string; bg: string; bd: string; fg: string; dw: number; dh: number }
> = {
  mesa: { n: 'Mesa', bg: 'var(--cp-white)', bd: 'var(--cp-navy)', fg: 'var(--cp-navy)', dw: 2, dh: 2 },
  pared: { n: 'Pared', bg: 'var(--cp-navy)', bd: 'var(--cp-navy)', fg: 'var(--cp-cream)', dw: 4, dh: 1 },
  cocina: { n: 'Cocina', bg: '#8FA9B8', bd: 'var(--cp-soft)', fg: 'var(--cp-navy)', dw: 5, dh: 3 },
  barra: { n: 'Barra', bg: 'var(--cp-gold)', bd: 'var(--cp-rust)', fg: 'var(--cp-navy)', dw: 6, dh: 2 },
  bano: { n: 'Baños', bg: 'var(--cp-line2)', bd: 'var(--cp-soft)', fg: 'var(--cp-navy)', dw: 3, dh: 3 },
  entrada: { n: 'Entrada', bg: '#5DD38A', bd: 'var(--cp-ok)', fg: 'var(--cp-navy)', dw: 4, dh: 1 },
  caja: { n: 'Caja', bg: 'var(--cp-line)', bd: 'var(--cp-soft)', fg: 'var(--cp-navy)', dw: 3, dh: 2 },
  escalera: { n: 'Escalera', bg: '#F6E3C3', bd: 'var(--cp-rust)', fg: 'var(--cp-navy)', dw: 2, dh: 3 },
};

export function PlanoView() {
  const { tiene } = useSesion();
  const puedeVer = tiene('plano/ver');
  const puedeEditar = tiene('plano/editar');
  const puedeForzar = tiene('mesas/liberar');

  // Pisos del plano
  const [pisos, setPisos] = useState<PisoPlano[]>([]);
  const [pisoActivoId, setPisoActivoId] = useState<string>('1');

  // Mesas formateadas del salón (con estado derivado LIBRE / OCUPADA)
  const [pisosSalon, setPisosSalon] = useState<PisoSalon[]>([]);

  // Herramienta activa para colocar elementos tocando la cuadrícula
  const [herramientaActiva, setHerramientaActiva] = useState<string | null>(null);

  // Elemento seleccionado para inspeccionar / editar
  const [elementoSeleccionadoId, setElementoSeleccionadoId] = useState<string | null>(null);

  // Sección "Guardar o cambiar el diseño"
  const [pioAbierto, setPioAbierto] = useState(false);
  const [pioTextoPegar, setPioTextoPegar] = useState('');
  const [pioMensaje, setPioMensaje] = useState<string | null>(null);
  const [confirmarAplicarDiseno, setConfirmarAplicarDiseno] = useState(false);

  // Modales adicionales
  const [modalNuevoPedidoAbierto, setModalNuevoPedidoAbierto] = useState(false);
  // Cuenta de una mesa ocupada: el mozo la envía a Caja (no la cobra)
  const [mesaParaCuenta, setMesaParaCuenta] = useState<MesaSalon | null>(null);
  // Mesa ocupada mantenida presionada 2 s -> vista previa (ahí viven cuenta, cambio de mesa y forzar liberación)
  const [vistaPreviaId, setVistaPreviaId] = useState<string | null>(null);
  const mantenerMesa = useMantenerPresionado<MesaSalon>((mesa) => setVistaPreviaId(String(mesa.id)), 2000);
  const cambio = useCambioDeMesa(() => void cargarDatos());
  const sumar = useSumarMesas(() => void cargarDatos());
  // Mesas del mismo pedido que esta (la vista previa y «Quitar mesa» las necesitan)
  const mesasDelPedidoDe = (m: MesaSalon): MesaSalon[] =>
    m.pedido ? pisosSalon.flatMap((p) => p.mesas || []).filter((x) => x.pedido?.id === m.pedido?.id) : [];
  const [mesasParaPedido, setMesasParaPedido] = useState<string[]>([]);

  // Confirmaciones obligatorias Sí/No
  const [confirmarEliminar, setConfirmarEliminar] = useState<ElementoPlano | null>(null);
  const [confirmarAlternarElemento, setConfirmarAlternarElemento] = useState<ElementoPlano | null>(
    null,
  );
  const [confirmarAlternarPiso, setConfirmarAlternarPiso] = useState<PisoPlano | null>(null);

  // Drag & drop en cuadrícula
  const [dragOffset, setDragOffset] = useState<{ id: string; dc: number; dr: number } | null>(
    null,
  );

  // Estados de carga y error
  const [cargando, setCargando] = useState(true);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [dimNote, setDimNote] = useState<string | null>(null);

  // Zoom del plano (1 = ancho de la pantalla); el lienzo se desplaza con el dedo
  const [zoomPlano, setZoomPlano] = useState(1);

  // Cargar datos
  const cargarDatos = useCallback(async () => {
    try {
      setErrorGlobal(null);
      const [datosPlano, datosSalon] = await Promise.all([
        salonApi.obtenerPlano(),
        salonApi.obtenerMesas(),
      ]);

      setPisos(datosPlano || []);
      setPisosSalon(datosSalon.pisos || []);

      setPisoActivoId((prev) => {
        if (datosPlano && datosPlano.some((p) => p.id === prev)) {
          return prev;
        }
        return datosPlano?.[0]?.id || '1';
      });
    } catch (err: any) {
      setErrorGlobal(err?.message || 'No fue posible cargar el plano del local.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Socket en tiempo real
  const { avisoListo, cerrarAvisoListo } = useSalonSocket({
    onMesaCambio: () => {
      salonApi
        .obtenerMesas()
        .then((res) => {
          if (res?.pisos) setPisosSalon(res.pisos);
        })
        .catch(() => {});
    },
    onPlanoCambio: () => {
      cargarDatos();
    },
  });

  // Piso actual
  const pisoActual = pisos.find((p) => p.id === pisoActivoId) || pisos[0];
  const elementosPiso = pisoActual?.elementos || [];

  const ECOLS = pisoActual?.cuadriculaAncho || pisoActual?.cuadricula_ancho || 20;
  const EROWS = pisoActual?.cuadriculaAlto || pisoActual?.cuadricula_alto || 12;

  // Datos del salón de la mesa seleccionada (estado, pedido abierto y su cuenta)
  const mesaSalonSeleccionada = useMemo<MesaSalon | null>(() => {
    if (!elementoSeleccionadoId) return null;
    return pisosSalon.flatMap((p) => p.mesas || []).find((m) => String(m.id) === String(elementoSeleccionadoId)) || null;
  }, [pisosSalon, elementoSeleccionadoId]);

  const mesasSalonPorId = useMemo(
    () => new Map(pisosSalon.flatMap((p) => p.mesas || []).map((m) => [String(m.id), m] as const)),
    [pisosSalon],
  );

  // Elemento seleccionado
  const elementoSeleccionado = useMemo(() => {
    return elementosPiso.find((e) => e.id === elementoSeleccionadoId) || null;
  }, [elementosPiso, elementoSeleccionadoId]);

  // Totales para los 5 KPIs de la cabecera
  const todosLosElementos = useMemo(() => pisos.flatMap((p) => p.elementos || []), [pisos]);
  const todasLasMesas = useMemo(
    () => todosLosElementos.filter((e) => e.tipo.toLowerCase() === 'mesa'),
    [todosLosElementos],
  );
  const mesasActivasTotal = useMemo(() => todasLasMesas.filter((m) => m.activo).length, [
    todasLasMesas,
  ]);
  const capacidadTotal = useMemo(
    () =>
      todasLasMesas
        .filter((m) => m.activo)
        .reduce((acc, m) => acc + (Number(m.asientos) || 4), 0),
    [todasLasMesas],
  );

  const mesasEnEstePiso = useMemo(
    () => elementosPiso.filter((e) => e.tipo.toLowerCase() === 'mesa' && e.activo),
    [elementosPiso],
  );
  const capacidadEnEstePiso = useMemo(
    () => mesasEnEstePiso.reduce((acc, m) => acc + (Number(m.asientos) || 4), 0),
    [mesasEnEstePiso],
  );
  const pisosActivosCount = useMemo(() => pisos.filter((p) => p.activo).length, [pisos]);

  // JSON del diseño actual
  const pioJson = useMemo(() => {
    return JSON.stringify(
      {
        floors: pisos.map((p) => ({ id: p.id, n: p.nombre, on: p.activo })),
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
      },
      null,
      1,
    );
  }, [pisos]);

  // Colocar elemento al hacer clic en cuadrícula si hay herramienta activa
  const handleClicCuadricula = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!herramientaActiva) {
      setElementoSeleccionadoId(null);
      return;
    }
    if (!puedeEditar) {
      setDimNote('No tienes permiso para editar el plano.');
      return;
    }

    const t = EL_CONFIG[herramientaActiva.toLowerCase()] || EL_CONFIG.mesa;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = Math.floor(((e.clientX - rect.left) / rect.width) * ECOLS);
    const clickY = Math.floor(((e.clientY - rect.top) / rect.height) * EROWS);

    const x = Math.max(0, Math.min(ECOLS - t.dw, clickX));
    const y = Math.max(0, Math.min(EROWS - t.dh, clickY));

    const esMesa = herramientaActiva.toLowerCase() === 'mesa';
    try {
      const nuevo = await salonApi.crearElemento({
        pisoId: pisoActual.id,
        tipo: herramientaActiva.toUpperCase(),
        x,
        y,
        ancho: t.dw,
        alto: t.dh,
        asientos: esMesa ? 4 : undefined,
      });
      await cargarDatos();
      if (nuevo?.id) {
        setElementoSeleccionadoId(String(nuevo.id));
      }
    } catch (err: any) {
      setDimNote(err?.message || 'Error al colocar elemento.');
    }
  };

  // Girar elemento
  const handleGirar = async () => {
    if (!elementoSeleccionado || !puedeEditar) return;
    try {
      setDimNote(null);
      await salonApi.girarElemento(elementoSeleccionado.id);
      await cargarDatos();
    } catch (err: any) {
      setDimNote(err?.message || 'No se puede girar el elemento en esa posición.');
    }
  };

  // Cambiar dimensiones stepper
  const handleCambiarDimensiones = async (key: 'c' | 'r', delta: number) => {
    if (!puedeEditar) return;
    setDimNote(null);

    const extC = Math.max(8, ...elementosPiso.map((e) => e.x + e.ancho));
    const extR = Math.max(6, ...elementosPiso.map((e) => e.y + e.alto));

    const nuevoAncho = key === 'c' ? ECOLS + delta : ECOLS;
    const nuevoAlto = key === 'r' ? EROWS + delta : EROWS;

    if (key === 'c' && nuevoAncho < extC) {
      setDimNote(`No se puede achicar más: hay elementos hasta la columna ${extC}. Muévelos primero.`);
      return;
    }
    if (key === 'r' && nuevoAlto < extR) {
      setDimNote(`No se puede achicar más: hay elementos hasta la fila ${extR}. Muévelos primero.`);
      return;
    }

    try {
      await salonApi.actualizarPiso(pisoActual.id, {
        cuadriculaAncho: nuevoAncho,
        cuadriculaAlto: nuevoAlto,
      });
      await cargarDatos();
    } catch (err: any) {
      setDimNote(err?.message || 'Error al cambiar tamaño de la cuadrícula.');
    }
  };

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, elem: ElementoPlano) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const dc = Math.floor(((e.clientX - rect.left) / rect.width) * elem.ancho);
    const dr = Math.floor(((e.clientY - rect.top) / rect.height) * elem.alto);
    setDragOffset({ id: elem.id, dc, dr });
    setElementoSeleccionadoId(elem.id);
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', elem.id);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!dragOffset || !puedeEditar) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const elem = elementosPiso.find((x) => x.id === dragOffset.id);
    if (!elem) return;

    const cellW = rect.width / ECOLS;
    const cellH = rect.height / EROWS;
    const dropCol = Math.floor((e.clientX - rect.left) / cellW);
    const dropRow = Math.floor((e.clientY - rect.top) / cellH);

    const targetX = Math.max(0, Math.min(ECOLS - elem.ancho, dropCol - dragOffset.dc));
    const targetY = Math.max(0, Math.min(EROWS - elem.alto, dropRow - dragOffset.dr));

    setDragOffset(null);
    try {
      await salonApi.actualizarElemento(elem.id, { x: targetX, y: targetY });
      await cargarDatos();
    } catch (err: any) {
      setDimNote(err?.message || 'Error al mover elemento.');
    }
  };

  // Copiar diseño
  const handleCopiarDiseno = () => {
    let ok = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(pioJson);
        ok = true;
      }
    } catch {
      ok = false;
    }
    setPioMensaje(
      ok
        ? 'Copiado. Pégalo donde lo necesites.'
        : 'Selecciona el texto de abajo y cópialo (Ctrl+C).',
    );
  };

  // Aplicar diseño pegado
  const handleAplicarDisenoPegado = async () => {
    let d: any = null;
    try {
      d = JSON.parse(pioTextoPegar);
    } catch {
      setPioMensaje('El texto no es un diseño válido.');
      setConfirmarAplicarDiseno(false);
      return;
    }
    if (!d || !d.plan || typeof d.plan !== 'object') {
      setPioMensaje('El texto no contiene una estructura válida de diseño.');
      setConfirmarAplicarDiseno(false);
      return;
    }

    try {
      await salonApi.aplicarDiseno(d);
      setPioTextoPegar('');
      setPioMensaje('Diseño aplicado correctamente.');
      setConfirmarAplicarDiseno(false);
      await cargarDatos();
    } catch (err: any) {
      setPioMensaje(err?.message || 'Error al aplicar el diseño.');
      setConfirmarAplicarDiseno(false);
    }
  };

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
        <h2 style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: '18px' }}>
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

  const isFloor1 = pisoActual?.id === '1' || pisoActual?.id === 'p1';

  return (
    <div
      className={`salon-raiz${elementoSeleccionado ? ' salon-con-hoja' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
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
            ×
          </button>
        </div>
      )}

      {/* 1. TEXTO EXPLICATIVO SUPERIOR */}
      <div style={{ fontSize: '13px', lineHeight: '19px', color: 'var(--cp-soft)' }}>
        Dibuja el local: elige un elemento a la derecha y toca el plano para colocarlo; toca uno
        para editarlo o arrástralo para moverlo. El mozo verá este plano al tomar un pedido de mesa.
      </div>

      {/* 2. 5 TARJETAS DE KPIS SUPERIORES */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '10px',
        }}
      >
        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '10px 14px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>
            Mesas activas
          </div>
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '22px',
              color: 'var(--cp-navy)',
            }}
          >
            {mesasActivasTotal}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
            de {todasLasMesas.length} en total
          </div>
        </div>

        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '10px 14px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>
            Capacidad
          </div>
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '22px',
              color: 'var(--cp-navy)',
            }}
          >
            {capacidadTotal} personas
          </div>
          <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
            sentadas en las mesas activas
          </div>
        </div>

        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '10px 14px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>
            En este piso
          </div>
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '22px',
              color: 'var(--cp-navy)',
            }}
          >
            {mesasEnEstePiso.length} mesas
          </div>
          <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
            {capacidadEnEstePiso} personas
          </div>
        </div>

        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '10px 14px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>
            Pisos activos
          </div>
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '22px',
              color: 'var(--cp-navy)',
            }}
          >
            {pisosActivosCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>de {pisos.length}</div>
        </div>

        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '10px 14px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>
            Elementos
          </div>
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              fontSize: '22px',
              color: 'var(--cp-navy)',
            }}
          >
            {elementosPiso.length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>dibujados en este piso</div>
        </div>
      </div>

      {/* 3. DOS COLUMNAS: PLANO (IZQ) Y CONTROLES (DER) */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'flex-start',
        }}
      >
        {/* COLUMNA IZQUIERDA: PISOS + CUADRÍCULA + NOTA */}
        <div
          style={{
            flex: '3 1 520px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Fila de controles de piso */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div className="salon-pisos" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  color: 'var(--cp-soft)',
                }}
              >
                PISO
              </span>
              {pisos.map((f) => {
                const activo = f.id === pisoActivoId;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setPisoActivoId(f.id);
                      setElementoSeleccionadoId(null);
                    }}
                    style={{
                      minHeight: '34px',
                      padding: '0 12px',
                      borderRadius: '9999px',
                      border: '1.5px solid var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '12px',
                      background: activo ? 'var(--cp-navy)' : 'transparent',
                      color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      cursor: 'pointer',
                    }}
                  >
                    {f.nombre}
                    {!f.activo ? ' (desactivado)' : ''}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  if (isFloor1) {
                    setDimNote(
                      'El Piso 1 siempre está activo. Para el segundo piso, elige "Piso 2" y actívalo.',
                    );
                  } else {
                    setConfirmarAlternarPiso(pisoActual);
                  }
                }}
                style={{
                  minHeight: '34px',
                  padding: '0 12px',
                  borderRadius: '9999px',
                  border: '1.5px dashed var(--cp-navy)',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '12px',
                  opacity: isFloor1 ? 0.5 : 1,
                  cursor: isFloor1 ? 'default' : 'pointer',
                }}
              >
                {isFloor1
                  ? 'Siempre activo'
                  : pisoActual?.activo
                  ? 'Desactivar este piso'
                  : 'Activar este piso'}
              </button>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--cp-soft)', fontWeight: 700 }}>
              {herramientaActiva
                ? `Toca el plano para colocar: ${
                    EL_CONFIG[herramientaActiva.toLowerCase()]?.n || herramientaActiva
                  }. Vuelve a tocar el botón para soltar la herramienta.`
                : 'Toca un elemento para editarlo o arrástralo para moverlo.'}
            </div>
          </div>

          {/* Aviso de error o dimensión */}
          {dimNote && (
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-rust)' }}>
              {dimNote}
            </div>
          )}

          {/* Zoom del plano: en celular se desplaza el lienzo con el dedo */}
          <div className="salon-zoom" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>Zoom</span>
            <button
              type="button"
              aria-label="Alejar plano"
              disabled={zoomPlano <= 1}
              onClick={() => setZoomPlano((z) => Math.max(1, Math.round((z - 0.25) * 100) / 100))}
              style={{
                minHeight: '34px',
                minWidth: '34px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 800,
                cursor: zoomPlano <= 1 ? 'default' : 'pointer',
                opacity: zoomPlano <= 1 ? 0.5 : 1,
              }}
            >
              −
            </button>
            <span style={{ minWidth: '44px', textAlign: 'center', fontWeight: 800, fontSize: '12px' }}>
              {Math.round(zoomPlano * 100)}%
            </span>
            <button
              type="button"
              aria-label="Acercar plano"
              disabled={zoomPlano >= 3}
              onClick={() => setZoomPlano((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))}
              style={{
                minHeight: '34px',
                minWidth: '34px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontWeight: 800,
                cursor: zoomPlano >= 3 ? 'default' : 'pointer',
                opacity: zoomPlano >= 3 ? 0.5 : 1,
              }}
            >
              +
            </button>
            {zoomPlano !== 1 && (
              <button
                type="button"
                onClick={() => setZoomPlano(1)}
                style={{
                  minHeight: '34px',
                  padding: '0 12px',
                  borderRadius: '9999px',
                  border: '1.5px solid var(--cp-navy)',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Ajustar al ancho
              </button>
            )}
          </div>

          {/* Leyenda del estado de las mesas (lo que dice el servidor) */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12px', fontWeight: 700, color: 'var(--cp-soft)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span aria-hidden="true" style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--cp-greenbg)', border: '1.5px solid var(--cp-ok)' }} />
              Libre
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span aria-hidden="true" style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#F6C9A5', border: '1.5px solid var(--cp-orange)' }} />
              Ocupada
            </span>
          </div>

          {cambio.ui}
          {sumar.ui}
          {/* Contenedor del plano con aspecto exacto del mockup */}
          <div
            className="salon-lienzo"
            style={{
              background: 'var(--cp-cream)',
              border: '1px solid var(--cp-line)',
              borderRadius: '12px',
              padding: '8px',
              minHeight: '60vh',
            }}
          >
            <div
              onClick={handleClicCuadricula}
              onDragOver={(ev) => ev.preventDefault()}
              onDrop={handleDrop}
              style={{
                position: 'relative',
                width: `${zoomPlano * 100}%`,
                minWidth: '100%',
                aspectRatio: `${ECOLS} / ${EROWS}`,
                boxSizing: 'border-box',
                border: '2px solid var(--cp-navy)',
                borderRadius: '8px',
                backgroundColor: 'var(--cp-white)',
                backgroundImage:
                  'linear-gradient(#EFE6D9 1px, transparent 1px), linear-gradient(90deg, #EFE6D9 1px, transparent 1px)',
                backgroundSize: `${100 / ECOLS}% ${100 / EROWS}%`,
                overflow: 'hidden',
                cursor: herramientaActiva ? 'crosshair' : 'default',
              }}
            >
              {elementosPiso.map((e) => {
                const t = EL_CONFIG[e.tipo.toLowerCase()] || EL_CONFIG.mesa;
                const sel = e.id === elementoSeleccionadoId;
                const esMesa = e.tipo.toLowerCase() === 'mesa';
                // Mesa elegida para sumar a un pedido (modo «Agregar mesa»)
                const elegidaParaSumar = sumar.seleccionadas.includes(String(e.id));
                const numMesa = parseInt(String(e.nombre || '').replace(/\D/g, ''), 10) || e.numero || 0;
                const mesaSalonElem = esMesa ? mesasSalonPorId.get(String(e.id)) : undefined;
                // Estado real del servidor (LIBRE / OCUPADA) para pintar la mesa
                const ocupadaSalon = mesaSalonElem?.estado === 'OCUPADA';
                const libreSalon = mesaSalonElem?.estado === 'LIBRE';
                const pulsaMesa =
                  mesaSalonElem?.estado === 'OCUPADA' ? mantenerMesa.manejadores(mesaSalonElem) : null;

                return (
                  <div
                    key={e.id}
                    data-testid={`elemento-plano-${e.id}`}
                    className="salon-celda"
                    draggable={puedeEditar}
                    onDragStart={(ev) => handleDragStart(ev, e)}
                    {...(pulsaMesa ?? {})}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      // Eligiendo destino de un cambio de mesa, tocar una libre es la elección
                      if (cambio.modoDestino || sumar.modoDestino) {
                        if (mesaSalonElem && !sumar.tocarMesa(mesaSalonElem)) cambio.tocarMesa(mesaSalonElem);
                        return;
                      }
                      setElementoSeleccionadoId(e.id);
                      setHerramientaActiva(null);
                    }}
                    style={{
                      position: 'absolute',
                      boxSizing: 'border-box',
                      left: `${(e.x * 100) / ECOLS}%`,
                      top: `${(e.y * 100) / EROWS}%`,
                      width: `${(e.ancho * 100) / ECOLS}%`,
                      height: `${(e.alto * 100) / EROWS}%`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      lineHeight: 1.15,
                      overflow: 'hidden',
                      fontWeight: 800,
                      fontSize: 'clamp(8px, 1.1vw, 13px)',
                      borderRadius: esMesa ? '10px' : '3px',
                      background: ocupadaSalon ? '#F6C9A5' : libreSalon ? 'var(--cp-greenbg)' : t.bg,
                      color: t.fg,
                      border: sel || elegidaParaSumar
                        ? '3px solid var(--cp-orange)'
                        : (cambio.modoDestino || sumar.modoDestino) && libreSalon
                        ? '2.5px solid var(--cp-orange)'
                        : e.activo
                        ? `1.5px solid ${ocupadaSalon ? 'var(--cp-orange)' : libreSalon ? 'var(--cp-ok)' : t.bd}`
                        : `1.5px dashed ${t.bd}`,
                      opacity: e.activo ? 1 : 0.35,
                      cursor: 'grab',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      WebkitTouchCallout: 'none',
                      touchAction: pulsaMesa ? 'manipulation' : undefined,
                      zIndex: sel ? 4 : e.tipo.toLowerCase() === 'pared' ? 1 : 2,
                    }}
                  >
                    {pulsaMesa && mantenerMesa.objetivo?.id === e.id && (
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          left: 0,
                          bottom: 0,
                          height: '4px',
                          width: `${Math.round(mantenerMesa.progreso * 100)}%`,
                          background: 'var(--cp-orange)',
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                    <span>{e.tipo.toLowerCase() === 'pared' ? '' : esMesa ? (numMesa ? String(numMesa) : e.nombre || 'M') : e.nombre || t.n}</span>
                    {ocupadaSalon && mesaSalonElem?.pedido && (
                      <span
                        data-testid={`resumen-mesa-${e.id}`}
                        style={{ fontSize: '9px', fontWeight: 700, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {[
                          mesaSalonElem.pedido.cliente || mesaSalonElem.pedido.mozo || null,
                          mesaSalonElem.pedido.lineas ? `${mesaSalonElem.pedido.lineas.reduce((acc, l) => acc + l.cantidad, 0)} prod.` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                    {ocupadaSalon && (
                      <span style={{ fontSize: '9px', fontWeight: 800 }}>ocupada</span>
                    )}
                    {ocupadaSalon && mesaSalonElem?.pedido?.codigo && (
                      <span style={{ fontSize: '8px', fontWeight: 600, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {mesaSalonElem.pedido.codigo}
                      </span>
                    )}
                    {esMesa && ECOLS <= 30 && !ocupadaSalon && (
                      <span style={{ fontSize: '9px', fontWeight: 600 }}>
                        {e.asientos || 4} pers.
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
            Se puede eliminar cualquier elemento, incluso una mesa que ya se usó: los pedidos y
            reservas cerrados conservan el nombre de la mesa para consultas. Solo no se elimina una
            mesa que tiene hoy un pedido abierto o una reserva activa; mientras tanto se puede
            desactivar.
          </div>
        </div>

        {/* COLUMNA DERECHA: HERRAMIENTAS, INSPECTOR, DISEÑO Y TAMAÑO */}
        <div
          style={{
            flex: '1 1 300px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Card 1: AGREGAR AL PLANO (solo con plano/editar) */}
          {puedeEditar && (
          <div
            style={{
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '15px',
                  color: 'var(--cp-navy)',
                }}
              >
                Agregar al plano
              </div>
              <div style={{ fontSize: '12px', lineHeight: '17px', color: 'var(--cp-soft)' }}>
                Elige uno y toca el plano para colocarlo. Vuelve a tocarlo para soltarlo.
              </div>
            </div>

            {[
              { n: 'PARA SENTARSE', tools: ['mesa', 'barra'] },
              { n: 'ESTRUCTURA', tools: ['pared', 'entrada', 'escalera'] },
              { n: 'SERVICIOS', tools: ['cocina', 'caja', 'bano'] },
            ].map((g) => (
              <div key={g.n} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    color: 'var(--cp-soft)',
                  }}
                >
                  {g.n}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {g.tools.map((k) => {
                    const cfg = EL_CONFIG[k];
                    const activo = herramientaActiva === k.toUpperCase();
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setHerramientaActiva(activo ? null : k.toUpperCase());
                          if (!activo) setElementoSeleccionadoId(null);
                        }}
                        style={{
                          minHeight: '40px',
                          padding: '0 14px',
                          borderRadius: '9999px',
                          border: '1.5px solid var(--cp-navy)',
                          fontWeight: 700,
                          fontSize: '13px',
                          background: activo ? 'var(--cp-navy)' : 'transparent',
                          color: activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                          cursor: 'pointer',
                        }}
                      >
                        {cfg.n}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          )}

          {/* Card 2: INSPECTOR DE ELEMENTO SELECCIONADO (en celular, hoja inferior) */}
          {elementoSeleccionado ? (
            <div
              className="salon-inspector"
              style={{
                background: 'var(--cp-white)',
                border: '2px solid var(--cp-orange)',
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    fontSize: '15px',
                    color: 'var(--cp-rust)',
                  }}
                >
                  {EL_CONFIG[elementoSeleccionado.tipo.toLowerCase()]?.n || elementoSeleccionado.tipo}
                </div>
                <button
                  type="button"
                  className="salon-solo-movil"
                  aria-label="Cerrar panel del elemento"
                  onClick={() => setElementoSeleccionadoId(null)}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '22px',
                    border: '1.5px solid var(--cp-navy)',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 800,
                    fontSize: '16px',
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>

              {/* Estado de la mesa según el servidor */}
              {elementoSeleccionado.tipo.toLowerCase() === 'mesa' && mesaSalonSeleccionada && (
                <div
                  data-testid="estado-mesa"
                  style={{
                    alignSelf: 'flex-start',
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 800,
                    background: mesaSalonSeleccionada.estado === 'OCUPADA' ? '#F6C9A5' : 'var(--cp-greenbg)',
                    border: `1.5px solid ${mesaSalonSeleccionada.estado === 'OCUPADA' ? 'var(--cp-orange)' : 'var(--cp-ok)'}`,
                    color: 'var(--cp-navy)',
                  }}
                >
                  {mesaSalonSeleccionada.estado === 'OCUPADA'
                    ? `Ocupada${mesaSalonSeleccionada.pedido?.codigo ? ` · pedido ${mesaSalonSeleccionada.pedido.codigo}` : ''}${mesaSalonSeleccionada.pedido?.estado ? ` (${mesaSalonSeleccionada.pedido.estado})` : ''}`
                    : 'Libre'}
                </div>
              )}

              {/* Tarjeta de la cuenta: quién es, mozo, pedido, líneas y total */}
              {elementoSeleccionado.tipo.toLowerCase() === 'mesa' && mesaSalonSeleccionada?.estado === 'OCUPADA' && mesaSalonSeleccionada.pedido && (
                <div
                  data-testid="tarjeta-pedido-mesa"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '10px',
                    borderRadius: '10px',
                    border: '1px solid var(--cp-line)',
                    background: 'var(--cp-cream)',
                  }}
                >
                  <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '14px', color: 'var(--cp-navy)' }}>
                    {mesaSalonSeleccionada.pedido.cliente || mesaSalonSeleccionada.pedido.mozo || 'Sin nombre'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                    Mozo: {mesaSalonSeleccionada.pedido.mozo || 'sin asignar'} · {mesaSalonSeleccionada.pedido.codigo}
                    {mesaSalonSeleccionada.pedido.estado ? ` · ${mesaSalonSeleccionada.pedido.estado}` : ''}
                  </div>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {(mesaSalonSeleccionada.pedido.lineas || []).map((l, i) => (
                      <li key={i} style={{ fontSize: '12px', color: 'var(--cp-navy)' }}>
                        {l.cantidad} × {l.nombre}
                        {l.detalle && <span style={{ display: 'block', fontSize: '11px', color: 'var(--cp-soft)' }}>{l.detalle}</span>}
                      </li>
                    ))}
                  </ul>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--cp-navy)' }}>
                    Total: S/ {Number(mesaSalonSeleccionada.pedido.total ?? 0).toFixed(2)}
                  </div>
                </div>
              )}

              {!puedeEditar && (
                <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                  {elementoSeleccionado.nombre || 'Sin nombre'}
                </div>
              )}

              {puedeEditar && elementoSeleccionado.tipo.toLowerCase() !== 'pared' && (
                <input
                  id="pl-name"
                  type="text"
                  value={elementoSeleccionado.nombre || ''}
                  onChange={async (ev) => {
                    const val = ev.target.value;
                    try {
                      await salonApi.actualizarElemento(elementoSeleccionado.id, { nombre: val });
                      await cargarDatos();
                    } catch { /* best-effort: si falla, el valor anterior se mantiene */ }
                  }}
                  aria-label="Nombre"
                  style={{
                    width: '130px',
                    boxSizing: 'border-box',
                    minHeight: '34px',
                    borderRadius: '9999px',
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-cream)',
                    padding: '0 12px',
                    fontSize: '13px',
                  }}
                />
              )}

              {puedeEditar && elementoSeleccionado.tipo.toLowerCase() === 'mesa' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Personas</span>
                  <button
                    type="button"
                    onClick={async () => {
                      const cur = Number(elementoSeleccionado.asientos) || 4;
                      if (cur > 1) {
                        await salonApi.actualizarElemento(elementoSeleccionado.id, {
                          asientos: cur - 1,
                        });
                        await cargarDatos();
                      }
                    }}
                    aria-label="Menos personas"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '16px',
                      border: '1.5px solid var(--cp-navy)',
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    −
                  </button>
                  <span style={{ minWidth: '22px', textAlign: 'center', fontWeight: 800, fontSize: '13px' }}>
                    {elementoSeleccionado.asientos || 4}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      const cur = Number(elementoSeleccionado.asientos) || 4;
                      if (cur < 12) {
                        await salonApi.actualizarElemento(elementoSeleccionado.id, {
                          asientos: cur + 1,
                        });
                        await cargarDatos();
                      }
                    }}
                    aria-label="Más personas"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '16px',
                      border: '1.5px solid var(--cp-navy)',
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                </span>
              )}

              {puedeEditar && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Ancho</span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (elementoSeleccionado.ancho > 1) {
                        await salonApi.actualizarElemento(elementoSeleccionado.id, {
                          ancho: elementoSeleccionado.ancho - 1,
                        });
                        await cargarDatos();
                      }
                    }}
                    aria-label="Menos ancho"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '16px',
                      border: '1.5px solid var(--cp-navy)',
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    −
                  </button>
                  <span style={{ minWidth: '22px', textAlign: 'center', fontWeight: 800, fontSize: '13px' }}>
                    {elementoSeleccionado.ancho}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (elementoSeleccionado.x + elementoSeleccionado.ancho < ECOLS) {
                        await salonApi.actualizarElemento(elementoSeleccionado.id, {
                          ancho: elementoSeleccionado.ancho + 1,
                        });
                        await cargarDatos();
                      }
                    }}
                    aria-label="Más ancho"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '16px',
                      border: '1.5px solid var(--cp-navy)',
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                </span>

                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>Alto</span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (elementoSeleccionado.alto > 1) {
                        await salonApi.actualizarElemento(elementoSeleccionado.id, {
                          alto: elementoSeleccionado.alto - 1,
                        });
                        await cargarDatos();
                      }
                    }}
                    aria-label="Menos alto"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '16px',
                      border: '1.5px solid var(--cp-navy)',
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    −
                  </button>
                  <span style={{ minWidth: '22px', textAlign: 'center', fontWeight: 800, fontSize: '13px' }}>
                    {elementoSeleccionado.alto}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (elementoSeleccionado.y + elementoSeleccionado.alto < EROWS) {
                        await salonApi.actualizarElemento(elementoSeleccionado.id, {
                          alto: elementoSeleccionado.alto + 1,
                        });
                        await cargarDatos();
                      }
                    }}
                    aria-label="Más alto"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '16px',
                      border: '1.5px solid var(--cp-navy)',
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                </span>
              </div>
              )}

              {puedeEditar && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleGirar}
                  style={{
                    minHeight: '34px',
                    padding: '0 12px',
                    borderRadius: '9999px',
                    border: '1.5px solid var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    cursor: 'pointer',
                  }}
                >
                  ↻ Girar (horizontal / vertical)
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmarAlternarElemento(elementoSeleccionado)}
                  style={{
                    minHeight: '34px',
                    padding: '0 12px',
                    borderRadius: '9999px',
                    border: '1.5px solid var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    cursor: 'pointer',
                  }}
                >
                  {elementoSeleccionado.activo ? 'Desactivar' : 'Activar'}
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmarEliminar(elementoSeleccionado)}
                  style={{
                    minHeight: '34px',
                    padding: '0 12px',
                    borderRadius: '9999px',
                    border: '1.5px solid var(--cp-rust)',
                    background: 'transparent',
                    color: 'var(--cp-rust)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Eliminar
                </button>
              </div>
              )}

              {!elementoSeleccionado.activo && (
                <div style={{ fontSize: '12px', color: 'var(--cp-rust)', fontWeight: 700 }}>
                  Desactivado: no se ve en el pedido del mozo.
                </div>
              )}

              {/* Mesa ocupada con pedido: el mozo ve la cuenta y la envía a Caja */}
              {elementoSeleccionado.tipo.toLowerCase() === 'mesa' && mesaSalonSeleccionada?.estado === 'OCUPADA' && mesaSalonSeleccionada?.pedido && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    type="button"
                    data-testid="btn-cuenta-mesa"
                    onClick={() => setMesaParaCuenta(mesaSalonSeleccionada)}
                    style={{
                      flex: 1,
                      minHeight: '40px',
                      borderRadius: '10px',
                      border: 0,
                      background: 'var(--cp-green, #2F7A45)',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Cobrar mesa (enviar a Caja)
                  </button>
                </div>
              )}

              {/* Botón rápido para tomar pedido si es mesa */}
              {elementoSeleccionado.tipo.toLowerCase() === 'mesa' && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMesasParaPedido([elementoSeleccionado.id]);
                      setModalNuevoPedidoAbierto(true);
                    }}
                    style={{
                      flex: 1,
                      minHeight: '40px',
                      borderRadius: '10px',
                      border: 0,
                      background: 'var(--cp-orange)',
                      color: 'var(--cp-navy)',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Tomar pedido en esta mesa
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                background: 'var(--cp-white)',
                border: '1px dashed var(--cp-soft)',
                borderRadius: '14px',
                padding: '14px',
                fontSize: '13px',
                color: 'var(--cp-soft)',
              }}
            >
              Toca un elemento del plano para cambiar su nombre, tamaño, personas o desactivarlo.
            </div>
          )}

          {/* Card 3: GUARDAR O CAMBIAR EL DISEÑO (solo con plano/editar) */}
          {puedeEditar && (
          <div
            style={{
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '15px',
                  color: 'var(--cp-navy)',
                }}
              >
                Guardar o cambiar el diseño
              </div>
              <div style={{ fontSize: '12px', lineHeight: '17px', color: 'var(--cp-soft)' }}>
                Copia todo el plano como texto para guardarlo o mandarlo, o pega un diseño para
                reemplazar el actual.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setPioAbierto(!pioAbierto);
                  setPioMensaje(null);
                }}
                style={{
                  flex: '1 1 130px',
                  minHeight: '44px',
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: '10px',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {pioAbierto ? 'Ocultar el diseño' : 'Ver / copiar el diseño'}
              </button>

              <button
                type="button"
                onClick={handleCopiarDiseno}
                style={{
                  flex: '1 1 110px',
                  minHeight: '44px',
                  border: 0,
                  borderRadius: '10px',
                  background: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Copiar
              </button>
            </div>

            {pioMensaje && (
              <div
                role="status"
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: pioMensaje.includes('Error') || pioMensaje.includes('no')
                    ? 'var(--cp-rust)'
                    : 'var(--cp-green)',
                }}
              >
                {pioMensaje}
              </div>
            )}

            {pioAbierto && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label htmlFor="pio-t" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)' }}>
                  Diseño actual
                </label>
                <textarea
                  id="pio-t"
                  rows={6}
                  readOnly
                  value={pioJson}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-cream)',
                    color: 'var(--cp-navy)',
                    padding: '8px',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                  }}
                />

                <label htmlFor="pio-p" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)' }}>
                  Pegar un diseño
                </label>
                <textarea
                  id="pio-p"
                  rows={4}
                  value={pioTextoPegar}
                  onChange={(e) => {
                    setPioTextoPegar(e.target.value);
                    setPioMensaje(null);
                  }}
                  placeholder="Pega aquí el texto del diseño"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    borderRadius: '10px',
                    border: '1.5px solid var(--cp-line)',
                    background: 'var(--cp-white)',
                    color: 'var(--cp-navy)',
                    padding: '8px',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                  }}
                />

                <button
                  type="button"
                  disabled={!pioTextoPegar.trim()}
                  onClick={() => setConfirmarAplicarDiseno(true)}
                  style={{
                    minHeight: '44px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: '10px',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '13px',
                    opacity: pioTextoPegar.trim() ? 1 : 0.5,
                    cursor: pioTextoPegar.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Aplicar el diseño pegado
                </button>
              </div>
            )}
          </div>
          )}

          {/* Card 4: TAMAÑO DEL PLANO (solo con plano/editar) */}
          {puedeEditar && (
          <div
            style={{
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '15px',
                  color: 'var(--cp-navy)',
                }}
              >
                Tamaño del plano
              </div>
              <div style={{ fontSize: '12px', lineHeight: '17px', color: 'var(--cp-soft)' }}>
                Más columnas y filas dan más espacio para dibujar.
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700 }}>Columnas</span>
                <button
                  type="button"
                  onClick={() => handleCambiarDimensiones('c', -1)}
                  aria-label="Menos columnas"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '16px',
                    border: '1.5px solid var(--cp-navy)',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  −
                </button>
                <span style={{ minWidth: '22px', textAlign: 'center', fontWeight: 800, fontSize: '13px' }}>
                  {ECOLS}
                </span>
                <button
                  type="button"
                  onClick={() => handleCambiarDimensiones('c', 1)}
                  aria-label="Más columnas"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '16px',
                    border: '1.5px solid var(--cp-navy)',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  +
                </button>
              </span>

              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700 }}>Filas</span>
                <button
                  type="button"
                  onClick={() => handleCambiarDimensiones('r', -1)}
                  aria-label="Menos filas"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '16px',
                    border: '1.5px solid var(--cp-navy)',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  −
                </button>
                <span style={{ minWidth: '22px', textAlign: 'center', fontWeight: 800, fontSize: '13px' }}>
                  {EROWS}
                </span>
                <button
                  type="button"
                  onClick={() => handleCambiarDimensiones('r', 1)}
                  aria-label="Más filas"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '16px',
                    border: '1.5px solid var(--cp-navy)',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  +
                </button>
              </span>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* DIÁLOGOS DE CONFIRMACIÓN OBLIGATORIA SÍ / NO */}
      {confirmarEliminar && (
        <Confirmar
          abierto={true}
          titulo={`¿Eliminar "${confirmarEliminar.nombre || confirmarEliminar.tipo}"?`}
          mensaje="Se quita del plano. Los pedidos y reservas ya cerrados conservan el nombre de la mesa para consultas, así que no se pierde información."
          textoConfirmar="Sí, eliminar"
          textoNo="No, cancelar"
          alConfirmar={async () => {
            try {
              await salonApi.eliminarElemento(confirmarEliminar.id);
              setConfirmarEliminar(null);
              setElementoSeleccionadoId(null);
              await cargarDatos();
            } catch (err: any) {
              setConfirmarEliminar(null);
              setDimNote(err?.message || 'Error al eliminar elemento.');
            }
          }}
          alCancelar={() => setConfirmarEliminar(null)}
        />
      )}

      {confirmarAlternarElemento && (
        <Confirmar
          abierto={true}
          titulo={`¿${
            confirmarAlternarElemento.activo ? 'Desactivar' : 'Activar'
          } "${confirmarAlternarElemento.nombre || confirmarAlternarElemento.tipo}"?`}
          mensaje={
            confirmarAlternarElemento.activo
              ? 'Dejará de verse para el mozo. No se elimina y se puede activar de nuevo.'
              : 'Volverá a verse en el plano.'
          }
          textoConfirmar="Sí, continuar"
          textoNo="No, cancelar"
          alConfirmar={async () => {
            try {
              await salonApi.actualizarElemento(confirmarAlternarElemento.id, {
                activo: !confirmarAlternarElemento.activo,
              });
              setConfirmarAlternarElemento(null);
              await cargarDatos();
            } catch (err: any) {
              setConfirmarAlternarElemento(null);
              setDimNote(err?.message || 'Error al cambiar estado del elemento.');
            }
          }}
          alCancelar={() => setConfirmarAlternarElemento(null)}
        />
      )}

      {confirmarAlternarPiso && (
        <Confirmar
          abierto={true}
          titulo={`¿${confirmarAlternarPiso.activo ? 'Desactivar' : 'Activar'} ${
            confirmarAlternarPiso.nombre
          }?`}
          mensaje={
            confirmarAlternarPiso.activo
              ? 'El mozo ya no verá este piso al tomar pedidos. El plano no se pierde.'
              : 'El mozo elegirá primero el piso y luego la mesa.'
          }
          textoConfirmar="Sí, continuar"
          textoNo="No, cancelar"
          alConfirmar={async () => {
            try {
              await salonApi.actualizarPiso(confirmarAlternarPiso.id, {
                activo: !confirmarAlternarPiso.activo,
              });
              setConfirmarAlternarPiso(null);
              await cargarDatos();
            } catch (err: any) {
              setConfirmarAlternarPiso(null);
              setDimNote(err?.message || 'Error al cambiar estado del piso.');
            }
          }}
          alCancelar={() => setConfirmarAlternarPiso(null)}
        />
      )}

      {confirmarAplicarDiseno && (
        <Confirmar
          abierto={true}
          titulo="¿Reemplazar el plano por el diseño pegado?"
          mensaje="Se cambian los pisos y todos los elementos del plano por los del texto. Si no estás seguro, primero copia el diseño actual."
          textoConfirmar="Sí, aplicar diseño"
          textoNo="No, cancelar"
          alConfirmar={handleAplicarDisenoPegado}
          alCancelar={() => setConfirmarAplicarDiseno(false)}
        />
      )}

      {/* Cuenta de la mesa ocupada: el mozo envía el cobro a Caja */}
      {mesaParaCuenta?.pedido && (
        <ModalPrecuenta
          abierto={true}
          alCerrar={() => {
            setMesaParaCuenta(null);
            cargarDatos();
          }}
          mesa={mesaParaCuenta.nombre || `Mesa ${mesaParaCuenta.numero}`}
          lineas={mesaParaCuenta.pedido.lineas || []}
          descuentos={mesaParaCuenta.pedido.descuentos}
          subtotal={mesaParaCuenta.pedido.subtotal}
          envio={mesaParaCuenta.pedido.envio}
          notaPedido={mesaParaCuenta.pedido.nota}
          total={Number(mesaParaCuenta.pedido.total || 0)}
          mozo={mesaParaCuenta.pedido.mozo}
          pedidoId={mesaParaCuenta.pedido.id}
          alCambiarMesa={() => {
            const m = mesaParaCuenta;
            if (m?.pedido) cambio.iniciar({ pedidoId: m.pedido.id, codigo: m.pedido.codigo, mesa: m });
            setMesaParaCuenta(null);
          }}
        />
      )}

      {/* Modal Nuevo Pedido de Mesa */}
      {modalNuevoPedidoAbierto && (
        <ModalNuevoPedidoMesa
          abierto={true}
          alCerrar={() => {
            setModalNuevoPedidoAbierto(false);
            setMesasParaPedido([]);
          }}
          pisos={pisosSalon}
          mesasPreseleccionadasIds={mesasParaPedido}
          alRefrescarMesas={cargarDatos}
          puedeForzarLiberacion={puedeForzar}
        />
      )}

      {vistaPreviaId && mesasSalonPorId.get(vistaPreviaId) && (
        <VistaPreviaMesa
          mesa={mesasSalonPorId.get(vistaPreviaId) as MesaSalon}
          puedeForzar={puedeForzar}
          puedeDespachar={tiene('cocina/despachar')}
          alCerrar={() => setVistaPreviaId(null)}
          alAbrirCuenta={(m) => {
            setVistaPreviaId(null);
            setMesaParaCuenta(m);
          }}
          alCambiarMesa={(m) => {
            setVistaPreviaId(null);
            if (m.pedido) cambio.iniciar({ pedidoId: m.pedido.id, codigo: m.pedido.codigo, mesa: m });
          }}
          puedeAbrirMesas={tiene('mesas/abrir')}
          mesasDelPedido={mesasDelPedidoDe(mesasSalonPorId.get(vistaPreviaId) as MesaSalon)}
          alAgregarMesa={(m) => {
            setVistaPreviaId(null);
            if (m.pedido) sumar.iniciar({ pedidoId: m.pedido.id, codigo: m.pedido.codigo, mesa: m, mesasEnPedido: mesasDelPedidoDe(m).length });
          }}
          alCambiar={() => void cargarDatos()}
        />
      )}
    </div>
  );
}

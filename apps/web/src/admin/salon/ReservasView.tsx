import { useCallback, useEffect, useState } from 'react';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { Boton } from '../../comun/Boton';
import { PisoSalon, Reserva } from './tipos';
import { CalendarioAgendaReservas } from './componentes/CalendarioAgendaReservas';
import { ModalFormularioReserva } from './componentes/ModalFormularioReserva';
import { ModalCancelarReserva } from './componentes/ModalCancelarReserva';
import { ModalNuevoPedidoMesa } from './componentes/ModalNuevoPedidoMesa';
import { useSalonSocket } from './useSalonSocket';
import { salonApi } from './api';

export function ReservasView() {
  const { tiene } = useSesion();
  const puedeVer = tiene('reservas/ver');
  const puedeCrear = tiene('reservas/crear');
  const puedeEditar = tiene('reservas/editar');

  // Mesas activas para selector en formulario
  const [pisosSalon, setPisosSalon] = useState<PisoSalon[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);

  // Clave para forzar recarga de agenda y calendario ante cambios
  const [recargarKey, setRecargarKey] = useState(0);

  // Modales
  const [modalFormularioAbierto, setModalFormularioAbierto] = useState(false);
  const [reservaParaEditar, setReservaParaEditar] = useState<Reserva | null>(null);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);

  const [modalCancelarAbierto, setModalCancelarAbierto] = useState(false);
  const [reservaParaCancelar, setReservaParaCancelar] = useState<Reserva | null>(null);
  const [errorCancelar, setErrorCancelar] = useState<string | null>(null);

  // Modal Nuevo pedido de mesa (cuando se presiona botón directo o "Sentar")
  const [modalNuevoPedidoAbierto, setModalNuevoPedidoAbierto] = useState(false);
  const [mesasParaPedido, setMesasParaPedido] = useState<string[]>([]);
  const [reservaIdParaPedido, setReservaIdParaPedido] = useState<string | undefined>(undefined);

  // Cargar mesas
  const cargarMesas = useCallback(async () => {
    try {
      setErrorGlobal(null);
      const res = await salonApi.obtenerMesas();
      setPisosSalon(res.pisos || []);
    } catch (err: any) {
      setErrorGlobal(
        err?.message || 'No fue posible cargar las mesas del local.',
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarMesas();
  }, [cargarMesas]);

  // Socket en tiempo real
  const { avisoListo, cerrarAvisoListo } = useSalonSocket({
    onReservaCambio: () => {
      setRecargarKey((k) => k + 1);
      cargarMesas();
    },
    onMesaCambio: () => {
      cargarMesas();
    },
  });

  // Todas las mesas activas
  const mesasActivas = pisosSalon.flatMap((p) =>
    (p.mesas || []).filter((m) => m.activo),
  );

  // Guardar (Crear o Actualizar) reserva
  const handleGuardarReserva = async (datos: {
    id?: string;
    nombre: string;
    telefono: string;
    personas: number;
    hora: string;
    mesas: string[];
  }) => {
    setErrorFormulario(null);
    try {
      if (datos.id) {
        if (!puedeEditar) throw new Error('No tienes permiso para editar reservas.');
        await salonApi.actualizarReserva(datos.id, {
          nombre: datos.nombre,
          telefono: datos.telefono,
          personas: datos.personas,
          hora: datos.hora,
          mesas: datos.mesas,
        });
      } else {
        if (!puedeCrear) throw new Error('No tienes permiso para crear reservas.');
        await salonApi.crearReserva({
          nombre: datos.nombre,
          telefono: datos.telefono,
          personas: datos.personas,
          hora: datos.hora,
          mesas: datos.mesas,
        });
      }

      setModalFormularioAbierto(false);
      setReservaParaEditar(null);
      setRecargarKey((k) => k + 1);
      await cargarMesas();
    } catch (err: any) {
      if (err?.codigo === 'FUERA_DE_HORARIO') {
        setErrorFormulario(
          err.message ||
            'La hora seleccionada está fuera del horario de atención del restaurante.',
        );
      } else if (err?.codigo === 'HORA_PASADA') {
        setErrorFormulario(
          err.message ||
            'No se puede registrar una reserva en una fecha u hora que ya pasó.',
        );
      } else if (err?.codigo === 'ASIENTOS_INSUFICIENTES') {
        setErrorFormulario(
          err.message || 'Los asientos de las mesas elegidas no alcanzan.',
        );
      } else {
        setErrorFormulario(err?.message || 'Error al guardar la reserva.');
      }
      throw err;
    }
  };

  // Cancelar reserva con motivo obligatorio
  const handleCancelarReserva = async (id: string, motivo: string) => {
    if (!puedeEditar) throw new Error('No tienes permiso para cancelar reservas.');
    setErrorCancelar(null);
    try {
      await salonApi.cancelarReserva(id, motivo);
      setModalCancelarAbierto(false);
      setReservaParaCancelar(null);
      setRecargarKey((k) => k + 1);
      await cargarMesas();
    } catch (err: any) {
      setErrorCancelar(err?.message || 'Error al cancelar la reserva.');
      throw err;
    }
  };

  // Callback al presionar "Sentar" en una reserva
  const handleSentarReserva = (datos: {
    reservaId: string;
    mesas: string[];
    personas: number;
    nombre: string;
  }) => {
    setMesasParaPedido(datos.mesas);
    setReservaIdParaPedido(datos.reservaId);
    setModalNuevoPedidoAbierto(true);
    setRecargarKey((k) => k + 1);
  };

  if (!puedeVer) {
    return (
      <div
        role="region"
        aria-label="Sin permiso para ver reservas"
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
          No tienes los permisos requeridos (reservas/ver) para acceder al módulo de reservas.
        </p>
      </div>
    );
  }

  if (cargando) {
    return <Cargando mensaje="Cargando reservas y salón..." pantallaCompleta={false} />;
  }

  if (errorGlobal) {
    return (
      <EstadoError
        titulo="Error al cargar reservas"
        mensaje={errorGlobal}
        alReintentar={cargarMesas}
      />
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
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

      {/* Cabecera del módulo con accesos rápidos */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '16px',
          padding: '16px 20px',
        }}
      >
        <div style={{ flex: '1 1 300px' }}>
          <div
            style={{
              fontSize: '13px',
              lineHeight: '20px',
              color: 'var(--cp-soft)',
            }}
          >
            Las reservas llegan por WhatsApp como solicitud y un mozo o caja las registra en un solo formulario. La mesa se guarda 15 minutos de tolerancia. La marca R en el plano es solo un aviso visual: no bloquea la mesa.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {puedeCrear && (
            <Boton
              type="button"
              variante="primario"
              onClick={() => {
                setReservaParaEditar(null);
                setErrorFormulario(null);
                setModalFormularioAbierto(true);
              }}
            >
              + Nueva reserva
            </Boton>
          )}

          <Boton
            type="button"
            variante="secundario"
            onClick={() => {
              setMesasParaPedido([]);
              setReservaIdParaPedido(undefined);
              setModalNuevoPedidoAbierto(true);
            }}
          >
            + Nuevo pedido de mesa
          </Boton>
        </div>
      </div>

      {/* Calendario mensual y agenda interactiva */}
      <CalendarioAgendaReservas
        recargarKey={recargarKey}
        onSentarReserva={handleSentarReserva}
        onEditarReserva={(r) => {
          setReservaParaEditar(r);
          setErrorFormulario(null);
          setModalFormularioAbierto(true);
        }}
        onCancelarReserva={(r) => {
          setReservaParaCancelar(r);
          setErrorCancelar(null);
          setModalCancelarAbierto(true);
        }}
      />

      {/* Modal Formulario Único (Crear / Editar) */}
      <ModalFormularioReserva
        abierto={modalFormularioAbierto}
        reservaParaEditar={reservaParaEditar}
        mesasDisponibles={mesasActivas}
        alCerrar={() => {
          setModalFormularioAbierto(false);
          setReservaParaEditar(null);
        }}
        alGuardar={handleGuardarReserva}
        errorServidor={errorFormulario}
        alLimpiarError={() => setErrorFormulario(null)}
      />

      {/* Modal Cancelar Reserva */}
      <ModalCancelarReserva
        abierto={modalCancelarAbierto}
        reserva={reservaParaCancelar}
        alCerrar={() => {
          setModalCancelarAbierto(false);
          setReservaParaCancelar(null);
        }}
        alCancelarReserva={handleCancelarReserva}
        error={errorCancelar}
        alLimpiarError={() => setErrorCancelar(null)}
      />

      {/* Modal Nuevo Pedido de Mesa (conectado con Sentar) */}
      <ModalNuevoPedidoMesa
        abierto={modalNuevoPedidoAbierto}
        alCerrar={() => {
          setModalNuevoPedidoAbierto(false);
          setMesasParaPedido([]);
          setReservaIdParaPedido(undefined);
        }}
        pisos={pisosSalon}
        mesasPreseleccionadasIds={mesasParaPedido}
        reservaIdPreseleccionada={reservaIdParaPedido}
        alRefrescarMesas={cargarMesas}
      />
    </div>
  );
}

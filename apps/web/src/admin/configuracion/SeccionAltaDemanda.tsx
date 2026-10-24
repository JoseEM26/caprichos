import React, { useState, useEffect, useCallback } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { obtenerAltaDemanda, configurarAltaDemanda } from '../cocina/cocinaApi';
import type { AltaDemandaEstado } from '../cocina/cocinaTipos';
import { useEventos } from '../../comun/socket';
import { useSesion } from '../../comun/sesion';

export const ATAJOS_MINUTOS = [5, 10, 15, 20, 30, 45, 60] as const;

export interface SeccionAltaDemandaProps {
  puedeEditar?: boolean;
  alCambiarEstado?: (estado: AltaDemandaEstado) => void;
  /** Estado inicial opcional (útil en pruebas) */
  estadoInicial?: AltaDemandaEstado;
}

/**
 * Formatea una fecha ISO a hora local de Lima (America/Lima).
 * RNF-CAP-019.
 */
function formatearFechaLima(fechaIso?: string | Date | null): string {
  if (!fechaIso) return '';
  try {
    const d = typeof fechaIso === 'string' ? new Date(fechaIso) : fechaIso;
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return '';
  }
}

export function SeccionAltaDemanda({
  puedeEditar: puedeEditarProp,
  alCambiarEstado,
  estadoInicial,
}: SeccionAltaDemandaProps) {
  const { tiene, usuario } = useSesion();

  // Permiso: rol ADMIN, o permisos cocina/demanda, local/editar, configuracion/editar
  const tienePermisoEditar =
    puedeEditarProp ??
    (usuario?.rol === 'ADMIN' ||
      tiene('ADMIN') ||
      tiene('cocina/demanda') ||
      tiene('local/editar') ||
      tiene('configuracion/editar'));

  const [estado, setEstado] = useState<AltaDemandaEstado>(
    estadoInicial || {
      activa: false,
      minutos: 0,
      pausa: false,
    },
  );
  const [cargando, setCargando] = useState<boolean>(!estadoInicial);
  const [guardando, setGuardando] = useState<boolean>(false);

  // Valores seleccionados para el formulario de cambio
  const [minutosSeleccionados, setMinutosSeleccionados] = useState<number>(() => {
    return estadoInicial && estadoInicial.activa && estadoInicial.minutos > 0
      ? estadoInicial.minutos
      : 30;
  });
  const [minutosInput, setMinutosInput] = useState<string>(() => {
    return String(
      estadoInicial && estadoInicial.activa && estadoInicial.minutos > 0
        ? estadoInicial.minutos
        : 30,
    );
  });
  const [pausaPedidos, setPausaPedidos] = useState<boolean>(
    Boolean(estadoInicial?.pausa),
  );

  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Control de ayudas «?» desplegables
  const [ayudaAbierta, setAyudaAbierta] = useState<Record<string, boolean>>({});

  const toggleAyuda = (seccion: string) => {
    setAyudaAbierta((prev) => ({
      ...prev,
      [seccion]: !prev[seccion],
    }));
  };

  // Diálogo de confirmación Sí/No
  const [confirmandoAccion, setConfirmandoAccion] = useState<{
    activa: boolean;
    minutos: number;
    pausa: boolean;
  } | null>(null);

  // Cargar estado inicial desde API si no se proveyó estadoInicial
  const refrescarEstado = useCallback(async () => {
    try {
      setCargando(true);
      setErrorLocal(null);
      const res = await obtenerAltaDemanda();
      setEstado(res);
      if (res.activa && res.minutos > 0) {
        setMinutosSeleccionados(res.minutos);
        setMinutosInput(String(res.minutos));
      }
      setPausaPedidos(res.pausa);
      if (alCambiarEstado) alCambiarEstado(res);
    } catch (err: any) {
      setErrorLocal(
        err?.message || 'No se pudo obtener el estado de alta demanda.',
      );
    } finally {
      setCargando(false);
    }
  }, [alCambiarEstado]);

  useEffect(() => {
    if (!estadoInicial) {
      refrescarEstado();
    }
  }, [estadoInicial, refrescarEstado]);

  // Actualización en tiempo real vía socket (DT-58, RNF-CAP-002)
  useEventos('cocina:alta-demanda', (nuevo: AltaDemandaEstado) => {
    setEstado(nuevo);
    if (nuevo.activa && nuevo.minutos > 0) {
      setMinutosSeleccionados(nuevo.minutos);
      setMinutosInput(String(nuevo.minutos));
    }
    setPausaPedidos(nuevo.pausa);
    if (alCambiarEstado) alCambiarEstado(nuevo);
  });

  // Manejador del campo numérico personalizado "Otro (min)"
  const handleCambioInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setMinutosInput(valStr);

    if (valStr.trim() === '') {
      setErrorLocal('Ingresa los minutos de alta demanda (entre 5 y 180).');
      return;
    }

    const num = parseInt(valStr, 10);
    if (isNaN(num)) {
      setErrorLocal('Ingresa un número entero de minutos.');
      return;
    }

    if (num < 5 || num > 180) {
      setErrorLocal('Los minutos deben estar entre 5 y 180.');
    } else {
      setErrorLocal(null);
      setMinutosSeleccionados(num);
    }
  };

  const seleccionarAtajo = (min: number) => {
    setMinutosSeleccionados(min);
    setMinutosInput(String(min));
    setErrorLocal(null);
  };

  const alternarPausa = (nuevaPausa: boolean) => {
    // Regla de negocio RQ-COC-03-09: la pausa de pedidos solo se puede activar con alta demanda activa
    if (nuevaPausa && !estado.activa) {
      setErrorLocal(
        'La pausa de pedidos solo se puede activar cuando la alta demanda está activa.',
      );
      return;
    }
    setErrorLocal(null);
    setPausaPedidos(nuevaPausa);
  };

  // Abrir confirmación para apagar alta demanda
  const solicitarApagar = () => {
    setErrorLocal(null);
    setConfirmandoAccion({
      activa: false,
      minutos: 0,
      pausa: false,
    });
  };

  // Abrir confirmación para activar o modificar alta demanda
  const solicitarGuardarOActivar = () => {
    const num = parseInt(minutosInput, 10);
    if (isNaN(num) || num < 5 || num > 180) {
      setErrorLocal('Los minutos deben estar entre 5 y 180.');
      return;
    }

    setErrorLocal(null);
    setConfirmandoAccion({
      activa: true,
      minutos: num,
      pausa: pausaPedidos,
    });
  };

  // Ejecución confirmada mediante Sí/No (RN-CAP-015, RNF-CAP-012)
  const ejecutarAccionConfirmada = async () => {
    if (!confirmandoAccion) return;
    try {
      setGuardando(true);
      setErrorLocal(null);
      setMensajeExito(null);

      const res = await configurarAltaDemanda(confirmandoAccion);
      setEstado(res);
      if (res.activa && res.minutos > 0) {
        setMinutosSeleccionados(res.minutos);
        setMinutosInput(String(res.minutos));
      }
      setPausaPedidos(res.pausa);

      setMensajeExito(
        res.activa
          ? `Alta demanda activada con +${res.minutos} min${res.pausa ? ' y pedidos pausados' : ''}.`
          : 'Alta demanda apagada: la carta y el chatbot han vuelto a sus tiempos habituales.',
      );

      if (alCambiarEstado) alCambiarEstado(res);
      setConfirmandoAccion(null);
    } catch (err: any) {
      setErrorLocal(err?.message || 'Error al guardar la alta demanda');
      setConfirmandoAccion(null);
    } finally {
      setGuardando(false);
    }
  };

  const autorCambio =
    estado.activado_por ||
    (estado.mensaje?.replace(/^(activó|desactivó)\s+/, '') ??
      (estado.por ? `Usuario #${estado.por}` : ''));

  const fechaCambio = formatearFechaLima(estado.desde);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        fontFamily: 'Montserrat, system-ui, sans-serif',
      }}
    >
      {/* Banner de modo solo lectura si no tiene permisos */}
      {cargando && (
        <div
          role="status"
          style={{
            fontSize: '13px',
            color: 'var(--cp-soft)',
            padding: '8px 0',
          }}
        >
          Cargando estado de alta demanda...
        </div>
      )}

      {!tienePermisoEditar && (
        <div
          role="status"
          style={{
            background: 'var(--cp-sand)',
            border: '1px solid var(--cp-line)',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '13px',
            color: 'var(--cp-navy)',
            lineHeight: '18px',
          }}
        >
          Modo de sólo lectura. No tienes permisos para modificar la alta demanda ni la pausa de pedidos.
        </div>
      )}

      {/* Alertas locales de error y éxito */}
      {errorLocal && (
        <div
          role="alert"
          style={{
            background: '#FEF2F2',
            border: '1.5px solid var(--cp-rust)',
            color: 'var(--cp-rust)',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          {errorLocal}
        </div>
      )}

      {mensajeExito && (
        <div
          role="status"
          style={{
            background: '#F0FDF4',
            border: '1.5px solid #16A34A',
            color: '#15803D',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          {mensajeExito}
        </div>
      )}

      {/* TARJETA 1: ESTADO ACTUAL Y AUDITORÍA */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '0.04em',
                color: 'var(--cp-soft)',
                textTransform: 'uppercase',
              }}
            >
              Estado de la alta demanda
            </span>
            <button
              type="button"
              onClick={() => toggleAyuda('estado')}
              aria-label="Ayuda sobre qué es el estado de alta demanda"
              aria-expanded={Boolean(ayudaAbierta.estado)}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                border: '1.5px solid var(--cp-navy)',
                background: ayudaAbierta.estado ? 'var(--cp-navy)' : 'transparent',
                color: ayudaAbierta.estado ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              ?
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              data-testid="insignia-estado"
              style={{
                padding: '4px 14px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 800,
                background: estado.activa ? 'var(--cp-rust)' : 'var(--cp-navy)',
                color: estado.activa ? 'var(--cp-white)' : 'var(--cp-cream)',
              }}
            >
              {estado.activa
                ? `ACTIVADA (+${estado.minutos} min${
                    estado.pausa ? ', pedidos en pausa' : ''
                  })`
                : 'Apagada'}
            </span>
          </div>
        </div>

        {ayudaAbierta.estado && (
          <div
            style={{
              background: 'var(--cp-cream)',
              border: '1px dashed var(--cp-navy)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '12px',
              lineHeight: '18px',
              color: 'var(--cp-navy)',
            }}
          >
            <strong>¿Qué es la Alta Demanda?</strong> Cuando hay congestión en la
            cocina, la Alta Demanda suma los minutos que elijas al tiempo de entrega
            habitual (de 25 a 35 minutos). La carta virtual y el chatbot reflejan el
            nuevo tiempo prometido al instante y en tiempo real para todas las áreas.
          </div>
        )}

        {/* Quién lo cambió y cuándo */}
        <div
          data-testid="registro-auditoria"
          style={{
            fontSize: '12px',
            color: 'var(--cp-soft)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexWrap: 'wrap',
          }}
        >
          <span>Último cambio:</span>
          {autorCambio ? (
            <strong style={{ color: 'var(--cp-navy)' }}>
              {estado.activa ? 'Activó ' : 'Cambió '}
              {autorCambio}
              {fechaCambio ? ` · ${fechaCambio}` : ''}
            </strong>
          ) : (
            <span>Sin cambios recientes registrados</span>
          )}
          <button
            type="button"
            onClick={() => toggleAyuda('auditoria')}
            aria-label="Ayuda sobre el registro de auditoría de alta demanda"
            aria-expanded={Boolean(ayudaAbierta.auditoria)}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              border: '1px solid var(--cp-soft)',
              background: 'transparent',
              color: 'var(--cp-soft)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            ?
          </button>
        </div>

        {ayudaAbierta.auditoria && (
          <div
            style={{
              background: 'var(--cp-cream)',
              border: '1px dashed var(--cp-soft)',
              borderRadius: '10px',
              padding: '8px 12px',
              fontSize: '12px',
              lineHeight: '17px',
              color: 'var(--cp-soft)',
            }}
          >
            <strong>Registro de auditoría (RNF-CAP-009):</strong> Todo cambio de
            alta demanda guarda quién lo hizo y la fecha y hora exacta en Lima, para
            que los equipos de cocina, barra, caja y despacho sepan quién ajustó los
            tiempos.
          </div>
        )}

        {/* Botón rápido para apagar si está activa */}
        {estado.activa && (
          <div style={{ marginTop: '4px' }}>
            <button
              type="button"
              disabled={!tienePermisoEditar || guardando}
              onClick={solicitarApagar}
              style={{
                minHeight: '44px',
                padding: '0 16px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '13px',
                cursor: !tienePermisoEditar || guardando ? 'not-allowed' : 'pointer',
                border: '1.5px solid var(--cp-rust)',
                background: 'transparent',
                color: 'var(--cp-rust)',
                opacity: !tienePermisoEditar ? 0.6 : 1,
              }}
            >
              Apagar alta demanda (quitar minutos y pausa)
            </button>
          </div>
        )}
      </div>

      {/* TARJETA 2: PASO 1 - TIEMPO ADICIONAL (ATAJOS Y OTRO MINUTO) */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--cp-navy)' }}>
            Paso 1: Minutos adicionales de espera
          </span>
          <button
            type="button"
            onClick={() => toggleAyuda('minutos')}
            aria-label="Ayuda sobre los minutos adicionales de espera"
            aria-expanded={Boolean(ayudaAbierta.minutos)}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: '1.5px solid var(--cp-navy)',
              background: ayudaAbierta.minutos ? 'var(--cp-navy)' : 'transparent',
              color: ayudaAbierta.minutos ? 'var(--cp-cream)' : 'var(--cp-navy)',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            ?
          </button>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--cp-soft)', lineHeight: '18px' }}>
          Elige los minutos extra que se sumarán al tiempo base de entrega. Puedes
          elegir un atajo rápido o escribir entre 5 y 180 minutos.
        </div>

        {ayudaAbierta.minutos && (
          <div
            style={{
              background: 'var(--cp-cream)',
              border: '1px dashed var(--cp-navy)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '12px',
              lineHeight: '18px',
              color: 'var(--cp-navy)',
            }}
          >
            <strong>¿Cómo afecta a la carta y al chatbot?</strong> Si el tiempo base
            es de 25 a 35 minutos y eliges +{minutosSeleccionados} min, el cliente
            verá:{' '}
            <strong>
              de {25 + minutosSeleccionados} a {35 + minutosSeleccionados} minutos
            </strong>
            . El chatbot usará este mismo rango en todas sus respuestas automáticas.
          </div>
        )}

        {/* Atajos de minutos */}
        <div
          role="group"
          aria-label="Atajos de minutos extra de espera"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}
        >
          {ATAJOS_MINUTOS.map((min) => {
            const seleccionado = minutosSeleccionados === min;
            return (
              <button
                key={min}
                type="button"
                disabled={!tienePermisoEditar || guardando}
                onClick={() => seleccionarAtajo(min)}
                aria-pressed={seleccionado}
                style={{
                  minHeight: '44px',
                  padding: '0 14px',
                  borderRadius: '9999px',
                  border: '1.5px solid var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '13px',
                  background: seleccionado ? 'var(--cp-navy)' : 'transparent',
                  color: seleccionado ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  cursor: !tienePermisoEditar || guardando ? 'not-allowed' : 'pointer',
                  opacity: !tienePermisoEditar ? 0.6 : 1,
                  transition: 'background-color 0.15s ease',
                }}
              >
                +{min} min
              </button>
            );
          })}

          {/* Campo Otro (min) de 5 a 180 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
            <label
              htmlFor="input-otro-minutos"
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--cp-navy)',
              }}
            >
              Otro (min)
            </label>
            <input
              id="input-otro-minutos"
              type="number"
              min={5}
              max={180}
              step={1}
              disabled={!tienePermisoEditar || guardando}
              value={minutosInput}
              onChange={handleCambioInput}
              aria-label="Otro (min)"
              style={{
                width: '84px',
                boxSizing: 'border-box',
                minHeight: '44px',
                borderRadius: '10px',
                border: '1.5px solid var(--cp-navy)',
                background: !tienePermisoEditar ? 'var(--cp-sand)' : 'var(--cp-white)',
                padding: '0 8px',
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--cp-navy)',
                cursor: !tienePermisoEditar ? 'not-allowed' : 'text',
              }}
            />
          </div>
        </div>

        {/* Vista previa del tiempo resultante */}
        <div
          style={{
            fontSize: '12px',
            color: 'var(--cp-navy)',
            background: 'var(--cp-cream)',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--cp-line)',
          }}
        >
          Tiempo anunciado en la carta y chatbot con este ajuste:{' '}
          <strong>
            de {25 + (isNaN(minutosSeleccionados) ? 0 : minutosSeleccionados)} a{' '}
            {35 + (isNaN(minutosSeleccionados) ? 0 : minutosSeleccionados)} minutos
          </strong>{' '}
          (tiempo base 25-35 min + {minutosSeleccionados} min).
        </div>
      </div>

      {/* TARJETA 3: PASO 2 - MODO DE RECEPCIÓN (PAUSAR PEDIDOS) */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--cp-navy)' }}>
            Paso 2: Recepción de pedidos
          </span>
          <button
            type="button"
            onClick={() => toggleAyuda('pausa')}
            aria-label="Ayuda sobre la pausa de pedidos"
            aria-expanded={Boolean(ayudaAbierta.pausa)}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: '1.5px solid var(--cp-navy)',
              background: ayudaAbierta.pausa ? 'var(--cp-navy)' : 'transparent',
              color: ayudaAbierta.pausa ? 'var(--cp-cream)' : 'var(--cp-navy)',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            ?
          </button>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--cp-soft)', lineHeight: '18px' }}>
          La pausa detiene temporalmente la entrada de pedidos en la carta y el chatbot.
          Solo puede activarse cuando la alta demanda está activa.
        </div>

        {ayudaAbierta.pausa && (
          <div
            style={{
              background: 'var(--cp-cream)',
              border: '1px dashed var(--cp-navy)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '12px',
              lineHeight: '18px',
              color: 'var(--cp-navy)',
            }}
          >
            <strong>¿Qué pasa con la pausa de pedidos?</strong> Con la pausa activa, la
            carta virtual y el chatbot no reciben pedidos nuevos y el chatbot ofrece
            hablar con una persona (asesor). Sirve para emergencias o saturación
            extrema. Al apagar la alta demanda, la pausa se desactiva automáticamente.
          </div>
        )}

        <div
          role="group"
          aria-label="Modo de recepción de pedidos"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
        >
          <button
            type="button"
            disabled={!tienePermisoEditar || guardando}
            onClick={() => alternarPausa(false)}
            aria-pressed={!pausaPedidos}
            style={{
              minHeight: '44px',
              padding: '0 16px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-navy)',
              fontWeight: 700,
              fontSize: '13px',
              background: !pausaPedidos ? 'var(--cp-navy)' : 'transparent',
              color: !pausaPedidos ? 'var(--cp-cream)' : 'var(--cp-navy)',
              cursor: !tienePermisoEditar || guardando ? 'not-allowed' : 'pointer',
              opacity: !tienePermisoEditar ? 0.6 : 1,
            }}
          >
            Seguir recibiendo pedidos
          </button>

          <button
            type="button"
            disabled={!tienePermisoEditar || guardando}
            onClick={() => alternarPausa(true)}
            aria-pressed={pausaPedidos}
            style={{
              minHeight: '44px',
              padding: '0 16px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-rust)',
              fontWeight: 700,
              fontSize: '13px',
              background: pausaPedidos ? 'var(--cp-rust)' : 'transparent',
              color: pausaPedidos ? 'var(--cp-white)' : 'var(--cp-rust)',
              cursor: !tienePermisoEditar || guardando ? 'not-allowed' : 'pointer',
              opacity: !tienePermisoEditar ? 0.6 : 1,
            }}
          >
            Pausar pedidos
          </button>
        </div>

        {!estado.activa && (
          <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
            Nota: «Pausar pedidos» solo está disponible cuando la alta demanda esté
            activada.
          </div>
        )}
      </div>

      {/* TARJETA 4: PASO 3 - APLICAR CONFIGURACIÓN */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--cp-navy)' }}>
            Paso 3: Confirmar y guardar
          </span>
          <button
            type="button"
            onClick={() => toggleAyuda('confirmar')}
            aria-label="Ayuda sobre la confirmación de cambios"
            aria-expanded={Boolean(ayudaAbierta.confirmar)}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: '1.5px solid var(--cp-navy)',
              background: ayudaAbierta.confirmar ? 'var(--cp-navy)' : 'transparent',
              color: ayudaAbierta.confirmar ? 'var(--cp-cream)' : 'var(--cp-navy)',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            ?
          </button>
        </div>

        {ayudaAbierta.confirmar && (
          <div
            style={{
              background: 'var(--cp-cream)',
              border: '1px dashed var(--cp-navy)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '12px',
              lineHeight: '18px',
              color: 'var(--cp-navy)',
            }}
          >
            <strong>Confirmación obligatoria (RNF-CAP-012):</strong> Toda acción
            que altera la disponibilidad del restaurante solicita confirmación
            Sí/No con un diálogo accesible. Si eliges «No», la pantalla queda como
            estaba sin enviar nada a la API.
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={!tienePermisoEditar || guardando}
            onClick={solicitarGuardarOActivar}
            style={{
              flex: '1 1 220px',
              minHeight: '48px',
              border: 0,
              borderRadius: '12px',
              background: 'var(--cp-orange)',
              color: 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: '14px',
              cursor: !tienePermisoEditar || guardando ? 'not-allowed' : 'pointer',
              opacity: !tienePermisoEditar || guardando ? 0.6 : 1,
            }}
          >
            {estado.activa
              ? `Guardar cambios (+${minutosSeleccionados} min${
                  pausaPedidos ? ', con pausa' : ''
                })`
              : `Activar alta demanda (+${minutosSeleccionados} min)`}
          </button>

          {estado.activa && (
            <button
              type="button"
              disabled={!tienePermisoEditar || guardando}
              onClick={solicitarApagar}
              style={{
                flex: '1 1 180px',
                minHeight: '48px',
                border: '1.5px solid var(--cp-rust)',
                borderRadius: '12px',
                background: 'transparent',
                color: 'var(--cp-rust)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: !tienePermisoEditar || guardando ? 'not-allowed' : 'pointer',
                opacity: !tienePermisoEditar || guardando ? 0.6 : 1,
              }}
            >
              Apagar alta demanda
            </button>
          )}
        </div>
      </div>

      {/* DIÁLOGO DE CONFIRMACIÓN SÍ/NO (Componente Confirmar) */}
      <Confirmar
        abierto={Boolean(confirmandoAccion)}
        titulo={
          confirmandoAccion?.activa
            ? estado.activa
              ? '¿Guardar cambios en la alta demanda?'
              : '¿Activar la alta demanda?'
            : '¿Apagar la alta demanda?'
        }
        mensaje={
          confirmandoAccion?.activa
            ? `La carta virtual y el chatbot sumarán +${confirmandoAccion.minutos} minutos al tiempo estimado (de ${
                25 + confirmandoAccion.minutos
              } a ${
                35 + confirmandoAccion.minutos
              } min).${
                confirmandoAccion.pausa
                  ? ' Además, la carta y el chatbot dejarán de recibir pedidos nuevos.'
                  : ''
              } Todas las áreas de trabajo verán este cambio al instante.`
            : 'La carta y el chatbot volverán al tiempo de entrega normal (de 25 a 35 minutos), se eliminará cualquier pausa de pedidos y se reanudará la recepción normal.'
        }
        textoConfirmar={
          confirmandoAccion?.activa
            ? estado.activa
              ? 'Sí, guardar'
              : 'Sí, activar'
            : 'Sí, apagar'
        }
        textoNo="No, cancelar"
        peligro={confirmandoAccion ? !confirmandoAccion.activa : false}
        cargando={guardando}
        alConfirmar={ejecutarAccionConfirmada}
        alCancelar={() => setConfirmandoAccion(null)}
      />
    </div>
  );
}

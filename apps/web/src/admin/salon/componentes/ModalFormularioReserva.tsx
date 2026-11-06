import { useEffect, useState } from 'react';
import { Boton } from '../../../comun/Boton';
import { Confirmar } from '../../../comun/Confirmar';
import { Campo } from '../../../comun/Campo';
import { MesaSalon, PisoPlano, PisoSalon, Reserva } from '../tipos';
import { SelectorMesasCroquis } from './SelectorMesasCroquis';
import { hoyLima, partesLima } from '../fechaLima';

export interface ModalFormularioReservaProps {
  abierto: boolean;
  reservaParaEditar?: Reserva | null;
  fechaPorDefecto?: string; // YYYY-MM-DD
  mesasDisponibles: MesaSalon[];
  /** Con pisos se elige en el croquis (con `planos` dibuja paredes, barra, cocina...); sin ellos, botones. */
  pisos?: PisoSalon[];
  planos?: PisoPlano[];
  alCerrar: () => void;
  alGuardar: (datos: {
    id?: string;
    nombre: string;
    telefono: string;
    personas: number;
    hora: string; // ISO
    mesas: string[];
  }) => Promise<void>;
  errorServidor?: string | null;
  alLimpiarError?: () => void;
}

export function ModalFormularioReserva({
  abierto,
  reservaParaEditar,
  fechaPorDefecto,
  mesasDisponibles,
  pisos,
  planos,
  alCerrar,
  alGuardar,
  errorServidor,
  alLimpiarError,
}: ModalFormularioReservaProps) {
  const hoyIso = hoyLima();

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [personas, setPersonas] = useState(2);
  const [fecha, setFecha] = useState(fechaPorDefecto || hoyIso);
  const [hora, setHora] = useState('19:00');
  const [mesasElegidasIds, setMesasElegidasIds] = useState<string[]>([]);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);

  // Inicializar campos según si es nueva reserva o edición
  useEffect(() => {
    if (reservaParaEditar) {
      setNombre(reservaParaEditar.nombre || '');
      setTelefono(reservaParaEditar.telefono || '');
      setPersonas(reservaParaEditar.personas || 2);

      const lima = partesLima(reservaParaEditar.hora);
      if (lima.fecha) {
        setFecha(lima.fecha);
        setHora(lima.hora);
      }

      const mIds = (reservaParaEditar.mesas || [])
        .map((m) => m.mesa_id)
        .filter((id): id is string => Boolean(id));
      setMesasElegidasIds(mIds);
    } else {
      setNombre('');
      setTelefono('');
      setPersonas(2);
      setFecha(fechaPorDefecto || hoyIso);
      setHora('19:00');
      setMesasElegidasIds([]);
    }
    setErrorValidacion(null);
  }, [reservaParaEditar, fechaPorDefecto, abierto, hoyIso]);

  if (!abierto) return null;

  // Cálculo de asientos de las mesas elegidas
  const totalAsientosElegidos = mesasElegidasIds.reduce((sum, mId) => {
    const mesa = mesasDisponibles.find((m) => m.id === mId);
    return sum + (mesa?.asientos ?? 4);
  }, 0);

  const faltanAsientos = Math.max(0, personas - totalAsientosElegidos);

  const toggleMesa = (mId: string) => {
    alLimpiarError?.();
    setErrorValidacion(null);
    setMesasElegidasIds((prev) =>
      prev.includes(mId) ? prev.filter((id) => id !== mId) : [...prev, mId],
    );
  };

  const handleValidarYAbrirConfirmar = () => {
    alLimpiarError?.();
    setErrorValidacion(null);

    if (!nombre.trim()) {
      setErrorValidacion('El nombre del cliente es obligatorio.');
      return;
    }
    if (!telefono.trim()) {
      setErrorValidacion('El teléfono es obligatorio.');
      return;
    }
    if (personas < 1) {
      setErrorValidacion('El número de personas debe ser al menos 1.');
      return;
    }
    if (mesasElegidasIds.length === 0) {
      setErrorValidacion('Debe seleccionar al menos una mesa para la reserva.');
      return;
    }
    if (faltanAsientos > 0) {
      setErrorValidacion(`Faltan ${faltanAsientos} asientos.`);
      return;
    }

    setConfirmarAbierto(true);
  };

  const ejecutarGuardar = async () => {
    setCargando(true);
    try {
      // Formato con zona horaria de Lima (-05:00)
      const horaIso = `${fecha}T${hora}:00-05:00`;
      await alGuardar({
        id: reservaParaEditar?.id,
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        personas,
        hora: horaIso,
        mesas: mesasElegidasIds,
      });
      setConfirmarAbierto(false);
      alCerrar();
    } catch {
      setConfirmarAbierto(false);
    } finally {
      setCargando(false);
    }
  };

  const HORAS_SUGERIDAS = [
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
    '18:00',
    '19:00',
    '20:00',
    '21:00',
    '22:00',
  ];

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          background: 'rgba(11, 44, 62, 0.65)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
        onClick={alCerrar}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            reservaParaEditar ? 'Editar reserva' : 'Registrar nueva reserva'
          }
          style={{
            width: '100%',
            maxWidth: '620px',
            maxHeight: '92vh',
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '20px',
            boxShadow: '0 20px 48px rgba(11, 44, 62, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabecera */}
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--cp-line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: '18px',
                  color: 'var(--cp-navy)',
                }}
              >
                {reservaParaEditar ? 'Editar reserva' : 'Nueva reserva'}
              </h2>
              <div style={{ fontSize: '13px', color: 'var(--cp-soft)', marginTop: '2px' }}>
                Formulario único: nombre, teléfono, personas, hora exacta y mesas.
              </div>
            </div>
            <button
              onClick={alCerrar}
              aria-label="Cerrar ventana"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '20px',
                border: '1.5px solid var(--cp-navy)',
                background: 'transparent',
                color: 'var(--cp-navy)',
                fontSize: '18px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              x
            </button>
          </div>

          {/* Formulario scrolleable */}
          <div
            style={{
              padding: '20px 24px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {/* 1. Nombre y teléfono */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Campo
                etiqueta="Nombre del cliente"
                id="reserva-nombre"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  setErrorValidacion(null);
                  alLimpiarError?.();
                }}
                placeholder="Nombre"
              />
              <Campo
                etiqueta="Teléfono / Celular"
                id="reserva-telefono"
                value={telefono}
                onChange={(e) => {
                  setTelefono(e.target.value);
                  setErrorValidacion(null);
                  alLimpiarError?.();
                }}
                placeholder="Celular (opcional)"
              />
            </div>

            {/* 2. Personas */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--cp-cream)',
                padding: '10px 14px',
                borderRadius: '12px',
              }}
            >
              <div>
                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--cp-navy)' }}>
                  Número de personas
                </span>
                <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                  Los asientos de las mesas elegidas deben alcanzar.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setPersonas((p) => Math.max(1, p - 1))}
                  aria-label="Una persona menos"
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '19px',
                    border: '1.5px solid var(--cp-navy)',
                    background: 'var(--cp-white)',
                    color: 'var(--cp-navy)',
                    fontSize: '18px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  -
                </button>
                <span
                  style={{
                    fontFamily: 'var(--fuente-titulos)',
                    fontWeight: 800,
                    fontSize: '18px',
                    minWidth: '32px',
                    textAlign: 'center',
                  }}
                >
                  {personas}
                </span>
                <button
                  type="button"
                  onClick={() => setPersonas((p) => p + 1)}
                  aria-label="Una persona más"
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '19px',
                    border: '1.5px solid var(--cp-navy)',
                    background: 'var(--cp-white)',
                    color: 'var(--cp-navy)',
                    fontSize: '18px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  +
                </button>
              </div>
            </div>

            {/* 3. Fecha y Hora exacta */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="reserva-fecha" style={{ fontSize: '13px', fontWeight: 700 }}>
                    Fecha
                  </label>
                  <input
                    id="reserva-fecha"
                    type="date"
                    value={fecha}
                    onChange={(e) => {
                      setFecha(e.target.value);
                      setErrorValidacion(null);
                      alLimpiarError?.();
                    }}
                    style={{
                      minHeight: '44px',
                      boxSizing: 'border-box',
                      borderRadius: '12px',
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-white)',
                      padding: '0 12px',
                      fontSize: '14px',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="reserva-hora" style={{ fontSize: '13px', fontWeight: 700 }}>
                    Hora exacta (Lima)
                  </label>
                  <input
                    id="reserva-hora"
                    type="time"
                    value={hora}
                    onChange={(e) => {
                      setHora(e.target.value);
                      setErrorValidacion(null);
                      alLimpiarError?.();
                    }}
                    style={{
                      minHeight: '44px',
                      boxSizing: 'border-box',
                      borderRadius: '12px',
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-white)',
                      padding: '0 12px',
                      fontSize: '16px',
                      fontWeight: 700,
                    }}
                  />
                </div>
              </div>

              {/* Botones de horas sugeridas */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {HORAS_SUGERIDAS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHora(h)}
                    style={{
                      minHeight: '34px',
                      padding: '0 10px',
                      borderRadius: '9999px',
                      border: '1.5px solid var(--cp-navy)',
                      background: hora === h ? 'var(--cp-navy)' : 'var(--cp-cream)',
                      color: hora === h ? 'var(--cp-cream)' : 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Selección de Mesas y cálculo de asientos */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'var(--cp-cream)',
                padding: '12px 14px',
                borderRadius: '14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--cp-navy)' }}>
                  Asignar mesas
                </span>
                <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                  Capacidad elegida: <b>{totalAsientosElegidos} asientos</b> ({personas} personas requeridas)
                </span>
              </div>

              {pisos && pisos.length > 0 ? (
                <SelectorMesasCroquis
                  pisos={pisos}
                  planos={planos}
                  seleccionadas={mesasElegidasIds}
                  personas={personas}
                  onCambio={(ids) => {
                    alLimpiarError?.();
                    setErrorValidacion(null);
                    setMesasElegidasIds(ids);
                  }}
                />
              ) : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {mesasDisponibles.map((m) => {
                  const estaElegida = mesasElegidasIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMesa(m.id)}
                      style={{
                        minHeight: '44px',
                        padding: '0 14px',
                        borderRadius: '12px',
                        border: `2px solid ${
                          estaElegida ? 'var(--cp-navy)' : 'var(--cp-line)'
                        }`,
                        background: estaElegida
                          ? 'var(--cp-navy)'
                          : 'var(--cp-white)',
                        color: estaElegida
                          ? 'var(--cp-cream)'
                          : 'var(--cp-navy)',
                        fontWeight: 800,
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>{m.nombre || `Mesa ${m.numero}`}</span>
                      <span style={{ fontSize: '11px', opacity: 0.85 }}>
                        ({m.asientos || 4} as.)
                      </span>
                    </button>
                  );
                })}
              </div>
              )}

              {/* Cálculo dinámico: «Faltan N asientos» */}
              {faltanAsientos > 0 ? (
                <div
                  role="alert"
                  data-testid="aviso-faltan-asientos"
                  style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: '#FBEDE9',
                    border: '1.5px solid var(--cp-rust)',
                    color: 'var(--cp-rust)',
                    fontSize: '13px',
                    fontWeight: 800,
                  }}
                >
                  Faltan {faltanAsientos} asientos
                </div>
              ) : (
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--cp-ok)',
                  }}
                >
                  Capacidad suficiente: {totalAsientosElegidos} asientos para {personas} personas.
                </div>
              )}
            </div>

            {/* Error de validación local */}
            {errorValidacion && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  background: '#FBEDE9',
                  border: '1.5px solid var(--cp-rust)',
                  borderRadius: '10px',
                  color: 'var(--cp-rust)',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                {errorValidacion}
              </div>
            )}

            {/* Error del servidor (ej: FUERA_DE_HORARIO o HORA_PASADA) */}
            {errorServidor && (
              <div
                role="alert"
                style={{
                  padding: '12px 14px',
                  background: '#FBEDE9',
                  border: '1.5px solid var(--cp-rust)',
                  borderRadius: '12px',
                  color: 'var(--cp-rust)',
                  fontSize: '13px',
                  fontWeight: 700,
                  lineHeight: '18px',
                }}
              >
                {errorServidor}
              </div>
            )}
          </div>

          {/* Pie */}
          <div
            style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--cp-line)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              background: 'var(--cp-cream)',
            }}
          >
            <Boton type="button" variante="secundario" onClick={alCerrar}>
              Cancelar
            </Boton>
            <Boton
              type="button"
              variante="primario"
              disabled={faltanAsientos > 0 || mesasElegidasIds.length === 0}
              onClick={handleValidarYAbrirConfirmar}
            >
              {reservaParaEditar ? 'Guardar cambios' : 'Registrar reserva'}
            </Boton>
          </div>
        </div>
      </div>

      {/* Confirmación obligatoria Sí/No */}
      <Confirmar
        abierto={confirmarAbierto}
        titulo={reservaParaEditar ? '¿Guardar cambios en la reserva?' : '¿Registrar reserva?'}
        mensaje={`Se asignará la reserva para ${personas} persona(s) a nombre de ${nombre} a las ${hora} del ${fecha}. La mesa tendrá 15 minutos de tolerancia.`}
        textoSi={reservaParaEditar ? 'Sí, guardar cambios' : 'Sí, registrar reserva'}
        textoNo="No, revisar"
        cargando={cargando}
        alConfirmar={ejecutarGuardar}
        alCancelar={() => setConfirmarAbierto(false)}
      />
    </>
  );
}

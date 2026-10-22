import { useState, useEffect, useMemo } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';

export interface HorarioDiaItem {
  dia_semana: number;
  dia: string;
  abre: string | null;
  cierra: string | null;
  cerrado: boolean;
}

interface HorarioTabProps {
  puedeEditar: boolean;
}

const NOMBRES_DIAS: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

export function HorarioTab({ puedeEditar }: HorarioTabProps) {
  const [horarios, setHorarios] = useState<HorarioDiaItem[]>([]);
  const [original, setOriginal] = useState<HorarioDiaItem[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null);
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);

  const cargarHorarios = async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const res = await api.get<HorarioDiaItem[]>('/admin/local/horario');
      // Aseguramos que los 7 días estén presentes y ordenados 1 a 7
      const diasCompletos: HorarioDiaItem[] = [];
      for (let i = 1; i <= 7; i++) {
        const encontrado = res.find((h) => h.dia_semana === i);
        if (encontrado) {
          diasCompletos.push({
            ...encontrado,
            dia: encontrado.dia || NOMBRES_DIAS[i],
          });
        } else {
          diasCompletos.push({
            dia_semana: i,
            dia: NOMBRES_DIAS[i],
            abre: '14:00',
            cierra: '22:00',
            cerrado: false,
          });
        }
      }
      setHorarios(diasCompletos);
      setOriginal(JSON.parse(JSON.stringify(diasCompletos)));
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'No se pudo cargar el horario del local';
      setErrorCarga(msg);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarHorarios();
  }, []);

  const hayCambios = useMemo(() => {
    if (!original) return false;
    return JSON.stringify(horarios) !== JSON.stringify(original);
  }, [horarios, original]);

  // Validación de que abre < cierra si el día está abierto
  const errorValidacion = useMemo(() => {
    for (const h of horarios) {
      if (!h.cerrado) {
        if (!h.abre || !h.cierra) {
          return `Debe especificar hora de apertura y cierre para el ${h.dia}`;
        }
        if (h.abre >= h.cierra) {
          return `La hora de apertura (${h.abre}) debe ser menor a la hora de cierre (${h.cierra}) el ${h.dia}`;
        }
      }
    }
    return null;
  }, [horarios]);

  const toggleDiaCerrado = (diaSemana: number) => {
    if (!puedeEditar) return;
    setHorarios((prev) =>
      prev.map((h) => {
        if (h.dia_semana === diaSemana) {
          const nuevoCerrado = !h.cerrado;
          return {
            ...h,
            cerrado: nuevoCerrado,
            abre: nuevoCerrado ? null : (h.abre || '14:00'),
            cierra: nuevoCerrado ? null : (h.cierra || '22:00'),
          };
        }
        return h;
      }),
    );
    setMensajeGuardado(null);
  };

  const handleCambiarAbre = (diaSemana: number, valor: string) => {
    if (!puedeEditar) return;
    setHorarios((prev) =>
      prev.map((h) => (h.dia_semana === diaSemana ? { ...h, abre: valor } : h)),
    );
    setMensajeGuardado(null);
  };

  const handleCambiarCierra = (diaSemana: number, valor: string) => {
    if (!puedeEditar) return;
    setHorarios((prev) =>
      prev.map((h) => (h.dia_semana === diaSemana ? { ...h, cierra: valor } : h)),
    );
    setMensajeGuardado(null);
  };

  const handleGuardar = async () => {
    if (!puedeEditar || errorValidacion || !hayCambios) return;
    setGuardando(true);
    setErrorGuardar(null);
    try {
      const payload = horarios.map((h) => ({
        dia_semana: h.dia_semana,
        abre: h.cerrado ? null : h.abre,
        cierra: h.cerrado ? null : h.cierra,
        cerrado: h.cerrado,
      }));

      const res = await api.put<HorarioDiaItem[]>('/admin/local/horario', payload);
      setHorarios(res);
      setOriginal(JSON.parse(JSON.stringify(res)));
      const ahora = new Date();
      const horaStr = ahora.toLocaleTimeString('es-PE', { hour12: false });
      setMensajeGuardado(`Guardado a las ${horaStr}`);
      setConfirmarAbierto(false);
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'Error al actualizar el horario del local';
      setErrorGuardar(msg);
      setConfirmarAbierto(false);
    } finally {
      setGuardando(false);
    }
  };

  const handleDescartar = () => {
    if (original) {
      setHorarios(JSON.parse(JSON.stringify(original)));
      setErrorGuardar(null);
    }
  };

  if (cargando) {
    return <Cargando mensaje="Cargando horario semanal..." />;
  }

  if (errorCarga) {
    return (
      <EstadoError
        titulo="Error al cargar el horario"
        mensaje={errorCarga}
        alReintentar={cargarHorarios}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '18px',
              color: 'var(--cp-navy)',
            }}
          >
            Horario de atención por día
          </h2>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--cp-soft)',
              margin: '4px 0 0 0',
            }}
          >
            Define los días y horas en que el restaurante recibe pedidos y reservas.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {hayCambios ? (
            <Insignia variante="aviso">Cambios sin guardar</Insignia>
          ) : (
            <Insignia variante="neutro">Todo guardado</Insignia>
          )}
          {mensajeGuardado && !hayCambios && (
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--cp-green)',
              }}
            >
              {mensajeGuardado}
            </span>
          )}
        </div>
      </div>

      {!puedeEditar && (
        <div
          role="status"
          style={{
            background: 'var(--cp-sand)',
            border: '1px solid var(--cp-line)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '13px',
            color: 'var(--cp-soft)',
          }}
        >
          Modo sólo lectura. No tienes el permiso <b>local/editar</b> para modificar el horario.
        </div>
      )}

      {errorValidacion && (
        <div
          role="alert"
          style={{
            background: '#FBEDE9',
            border: '1px solid var(--cp-rust)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '13px',
            color: 'var(--cp-rust)',
            fontWeight: 600,
          }}
        >
          {errorValidacion}
        </div>
      )}

      {errorGuardar && (
        <div
          role="alert"
          style={{
            background: '#FBEDE9',
            border: '1px solid var(--cp-rust)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '13px',
            color: 'var(--cp-rust)',
            fontWeight: 600,
          }}
        >
          {errorGuardar}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {horarios.map((h) => {
          const estaAbierto = !h.cerrado;
          return (
            <div
              key={h.dia_semana}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '14px',
                gap: '12px',
                opacity: estaAbierto ? 1 : 0.75,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '130px' }}>
                <span
                  style={{
                    fontFamily: 'var(--fuente-titulos)',
                    fontWeight: 800,
                    fontSize: '15px',
                    color: 'var(--cp-navy)',
                  }}
                >
                  {h.dia}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    background: estaAbierto ? 'var(--cp-greenbg)' : 'var(--cp-sand)',
                    color: estaAbierto ? 'var(--cp-green)' : 'var(--cp-soft)',
                  }}
                >
                  {estaAbierto ? 'Abierto' : 'Cerrado'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                {estaAbierto ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <label
                        htmlFor={`abre-${h.dia_semana}`}
                        style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}
                      >
                        Abre
                      </label>
                      <input
                        id={`abre-${h.dia_semana}`}
                        aria-label={`Apertura ${h.dia}`}
                        type="time"
                        value={h.abre || ''}
                        disabled={!puedeEditar || guardando}
                        onChange={(e) => handleCambiarAbre(h.dia_semana, e.target.value)}
                        style={{
                          minHeight: '44px',
                          padding: '0 10px',
                          borderRadius: '10px',
                          border: '1.5px solid var(--cp-line)',
                          background: 'var(--cp-white)',
                          color: 'var(--cp-navy)',
                          fontSize: '14px',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <label
                        htmlFor={`cierra-${h.dia_semana}`}
                        style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}
                      >
                        Cierra
                      </label>
                      <input
                        id={`cierra-${h.dia_semana}`}
                        aria-label={`Cierre ${h.dia}`}
                        type="time"
                        value={h.cierra || ''}
                        disabled={!puedeEditar || guardando}
                        onChange={(e) => handleCambiarCierra(h.dia_semana, e.target.value)}
                        style={{
                          minHeight: '44px',
                          padding: '0 10px',
                          borderRadius: '10px',
                          border: '1.5px solid var(--cp-line)',
                          background: 'var(--cp-white)',
                          color: 'var(--cp-navy)',
                          fontSize: '14px',
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <span style={{ fontSize: '13px', color: 'var(--cp-soft)', fontStyle: 'italic' }}>
                    No atiende este día
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => toggleDiaCerrado(h.dia_semana)}
                  disabled={!puedeEditar || guardando}
                  aria-label={`${h.dia}: ${estaAbierto ? 'Marcar como cerrado' : 'Marcar como abierto'}`}
                  style={{
                    minHeight: '44px',
                    padding: '0 16px',
                    borderRadius: '9999px',
                    border: '1.5px solid var(--cp-navy)',
                    background: estaAbierto ? 'transparent' : 'var(--cp-navy)',
                    color: estaAbierto ? 'var(--cp-navy)' : 'var(--cp-cream)',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: !puedeEditar ? 'not-allowed' : 'pointer',
                    opacity: !puedeEditar ? 0.6 : 1,
                  }}
                >
                  {estaAbierto ? 'Cerrar este día' : 'Abrir este día'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          gap: '10px',
          marginTop: '8px',
          flexWrap: 'wrap',
        }}
      >
        <Boton
          type="button"
          variante="primario"
          disabled={!puedeEditar || !hayCambios || !!errorValidacion || guardando}
          cargando={guardando}
          onClick={() => setConfirmarAbierto(true)}
        >
          Guardar horario
        </Boton>

        <Boton
          type="button"
          variante="secundario"
          disabled={!hayCambios || guardando}
          onClick={handleDescartar}
        >
          Descartar
        </Boton>
      </div>

      <Confirmar
        abierto={confirmarAbierto}
        titulo="¿Guardar horario semanal?"
        mensaje="El nuevo horario se aplicará en la carta virtual, chatbot y módulo de reservas."
        textoSi="Sí, guardar horario"
        textoNo="No, revisar"
        cargando={guardando}
        alConfirmar={handleGuardar}
        alCancelar={() => setConfirmarAbierto(false)}
      />
    </div>
  );
}

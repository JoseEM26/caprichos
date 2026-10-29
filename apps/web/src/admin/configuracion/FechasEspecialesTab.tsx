import { comoLista } from '../../comun/comoLista';
import { useState, useEffect } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Campo } from '../../comun/Campo';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { CampoAyuda } from './AyudaCampo';
import { AyudaBloque } from './AyudaBloque';
import { propsAyuda } from './catalogo/propsAyuda';

export interface FechaEspecialItem {
  fecha: string; // YYYY-MM-DD
  cerrado: boolean;
  abre: string | null;
  cierra: string | null;
  motivo: string | null;
}

interface FechasEspecialesTabProps {
  puedeEditar: boolean;
}

// Obtener la fecha de mañana en Lima/local YYYY-MM-DD
function obtenerMananaIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function obtenerHoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FechasEspecialesTab({ puedeEditar }: FechasEspecialesTabProps) {
  const [fechas, setFechas] = useState<FechaEspecialItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Formulario nueva fecha especial
  const mananaIso = obtenerMananaIso();
  const [nuevaFecha, setNuevaFecha] = useState(mananaIso);
  const [nuevoCerrado, setNuevoCerrado] = useState(true);
  const [nuevoAbre, setNuevoAbre] = useState('12:00');
  const [nuevoCierra, setNuevoCierra] = useState('18:00');
  const [nuevoMotivo, setNuevoMotivo] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [errorOperacion, setErrorOperacion] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Modales de confirmación
  const [confirmarCrearAbierto, setConfirmarCrearAbierto] = useState(false);
  const [fechaAEliminar, setFechaAEliminar] = useState<string | null>(null);

  const cargarFechas = async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const res = await api.get<FechaEspecialItem[]>('/admin/local/fechas-especiales');
      setFechas(comoLista<FechaEspecialItem>(res));
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'No se pudieron cargar las fechas especiales';
      setErrorCarga(msg);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarFechas();
  }, []);

  const hoyIso = obtenerHoyIso();

  // Validación para nueva fecha
  const validarNueva = (): string | null => {
    if (!nuevaFecha) return 'Debe seleccionar una fecha';
    if (nuevaFecha <= hoyIso) {
      return 'Solo se pueden registrar fechas especiales futuras (posteriores a hoy)';
    }
    if (!nuevoCerrado) {
      if (!nuevoAbre || !nuevoCierra) {
        return 'Debe especificar horas de apertura y cierre para un horario especial';
      }
      if (nuevoAbre >= nuevoCierra) {
        return `La hora de apertura (${nuevoAbre}) debe ser menor a la hora de cierre (${nuevoCierra})`;
      }
    }
    return null;
  };

  const errorValidacion = validarNueva();

  const handleCrearFechaEspecial = async () => {
    if (!puedeEditar || errorValidacion) return;
    setGuardando(true);
    setErrorOperacion(null);
    try {
      await api.post('/admin/local/fechas-especiales', {
        fecha: nuevaFecha,
        cerrado: nuevoCerrado,
        abre: nuevoCerrado ? null : nuevoAbre,
        cierra: nuevoCerrado ? null : nuevoCierra,
        motivo: nuevoMotivo.trim() || undefined,
      });

      await cargarFechas();
      const ahora = new Date();
      const horaStr = ahora.toLocaleTimeString('es-PE', { hour12: false });
      setMensajeExito(`Guardado a las ${horaStr}`);
      setNuevoMotivo('');
      setConfirmarCrearAbierto(false);
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'Error al crear la fecha especial';
      setErrorOperacion(msg);
      setConfirmarCrearAbierto(false);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarFechaEspecial = async () => {
    if (!fechaAEliminar || !puedeEditar) return;
    setGuardando(true);
    setErrorOperacion(null);
    try {
      await api.delete(`/admin/local/fechas-especiales/${fechaAEliminar}`);
      await cargarFechas();
      const ahora = new Date();
      const horaStr = ahora.toLocaleTimeString('es-PE', { hour12: false });
      setMensajeExito(`Guardado a las ${horaStr}`);
      setFechaAEliminar(null);
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'Error al eliminar la fecha especial';
      setErrorOperacion(msg);
      setFechaAEliminar(null);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return <Cargando mensaje="Cargando fechas especiales..." />;
  }

  if (errorCarga) {
    return (
      <EstadoError
        titulo="Error al cargar fechas especiales"
        mensaje={errorCarga}
        alReintentar={cargarFechas}
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
            Fechas especiales y feriados
          </h2>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--cp-soft)',
              margin: '4px 0 0 0',
            }}
          >
            Las fechas especiales mandan sobre el horario normal. Solo se pueden programar y eliminar fechas futuras.
          </p>
        </div>

        {mensajeExito && (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--cp-green)',
            }}
          >
            {mensajeExito}
          </span>
        )}
      </div>

      <AyudaBloque id="fechas-especiales" />

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
          Modo sólo lectura. No tienes el permiso <b>local/editar</b> para agregar o quitar fechas especiales.
        </div>
      )}

      {errorOperacion && (
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
          {errorOperacion}
        </div>
      )}

      {/* Formulario para agregar fecha especial */}
      {puedeEditar && (
        <div
          style={{
            background: 'var(--cp-sand)',
            border: '1.5px dashed var(--cp-line)',
            borderRadius: '14px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '15px',
              color: 'var(--cp-navy)',
            }}
          >
            Agregar nueva fecha especial
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '14px',
            }}
          >
            <CampoAyuda id="input-fecha-especial" etiqueta="Fecha (solo futuras) *" cfgId="fechas-fecha" {...propsAyuda('fechas-fecha')}>
              <input
                type="date"
                min={mananaIso}
                value={nuevaFecha}
                disabled={guardando}
                onChange={(e) => {
                  setNuevaFecha(e.target.value);
                  setMensajeExito(null);
                }}
                style={{
                  minHeight: '44px',
                  padding: '0 12px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  fontSize: '14px',
                }}
              />
            </CampoAyuda>

            <CampoAyuda id="input-motivo-fecha" etiqueta="Motivo (se muestra al cliente)" cfgId="fechas-motivo" {...propsAyuda('fechas-motivo')}>
            <Campo
              placeholder="Ej: Feriado de Navidad, Mantenimiento..."
              value={nuevoMotivo}
              disabled={guardando}
              onChange={(e) => {
                setNuevoMotivo(e.target.value);
                setMensajeExito(null);
              }}
            />
            </CampoAyuda>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)' }}>
              Condición de atención
            </span>
            <AyudaBloque id="fechas-condicion" />
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setNuevoCerrado(true)}
                style={{
                  minHeight: '44px',
                  padding: '0 16px',
                  borderRadius: '9999px',
                  border: '1.5px solid var(--cp-navy)',
                  background: nuevoCerrado ? 'var(--cp-navy)' : 'var(--cp-white)',
                  color: nuevoCerrado ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '13px',
                }}
              >
                Cerrado todo el día
              </button>

              <button
                type="button"
                onClick={() => setNuevoCerrado(false)}
                style={{
                  minHeight: '44px',
                  padding: '0 16px',
                  borderRadius: '9999px',
                  border: '1.5px solid var(--cp-navy)',
                  background: !nuevoCerrado ? 'var(--cp-navy)' : 'var(--cp-white)',
                  color: !nuevoCerrado ? 'var(--cp-cream)' : 'var(--cp-navy)',
                  fontWeight: 700,
                  fontSize: '13px',
                }}
              >
                Horario especial
              </button>

              {!nuevoCerrado && (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '8px', marginLeft: '6px' }}>
                  <CampoAyuda id="nuevo-abre" etiqueta="Abre" cfgId="fechas-abre" {...propsAyuda('fechas-abre')}>
                  <input
                    type="time"
                    value={nuevoAbre}
                    onChange={(e) => setNuevoAbre(e.target.value)}
                    style={{
                      minHeight: '44px',
                      padding: '0 8px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-white)',
                      color: 'var(--cp-navy)',
                    }}
                  />
                  </CampoAyuda>

                  <CampoAyuda id="nuevo-cierra" etiqueta="Cierra" cfgId="fechas-cierra" {...propsAyuda('fechas-cierra')}>
                  <input
                    type="time"
                    value={nuevoCierra}
                    onChange={(e) => setNuevoCierra(e.target.value)}
                    style={{
                      minHeight: '44px',
                      padding: '0 8px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-white)',
                      color: 'var(--cp-navy)',
                    }}
                  />
                  </CampoAyuda>
                </div>
              )}
            </div>
          </div>

          {errorValidacion && (
            <div style={{ fontSize: '12px', color: 'var(--cp-rust)', fontWeight: 700 }}>
              {errorValidacion}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '6px' }}>
            <Boton
              type="button"
              variante="primario"
              disabled={!!errorValidacion || guardando}
              onClick={() => setConfirmarCrearAbierto(true)}
            >
              Registrar fecha especial
            </Boton>
          </div>
        </div>
      )}

      {/* Lista de fechas especiales */}
      <div>
        <h3
          style={{
            fontFamily: 'var(--fuente-titulos)',
            fontWeight: 800,
            fontSize: '16px',
            color: 'var(--cp-navy)',
            marginBottom: '12px',
          }}
        >
          Fechas registradas
        </h3>
        <AyudaBloque id="fechas-quitar" />

        {fechas.length === 0 ? (
          <EstadoVacio
            titulo="No hay fechas especiales registradas"
            descripcion="El local opera con su horario semanal estándar todos los días del año."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {fechas.map((f) => {
              const esFutura = f.fecha > hoyIso;
              return (
                <div
                  key={f.fecha}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'var(--cp-white)',
                    border: '1px solid var(--cp-line)',
                    borderRadius: '12px',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontFamily: 'var(--fuente-titulos)',
                          fontWeight: 800,
                          fontSize: '15px',
                          color: 'var(--cp-navy)',
                        }}
                      >
                        {f.fecha}
                      </span>
                      {f.cerrado ? (
                        <Insignia variante="peligro">Cerrado</Insignia>
                      ) : (
                        <Insignia variante="exito">
                          {f.abre} a {f.cierra}
                        </Insignia>
                      )}
                      {esFutura ? (
                        <Insignia variante="aviso">Programada</Insignia>
                      ) : (
                        <Insignia variante="neutro">Pasada</Insignia>
                      )}
                    </div>
                    {f.motivo && (
                      <span style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
                        {f.motivo}
                      </span>
                    )}
                  </div>

                  <div>
                    {esFutura && puedeEditar ? (
                      <Boton
                        type="button"
                        variante="peligro"
                        tamano="pequeno"
                        disabled={guardando}
                        onClick={() => setFechaAEliminar(f.fecha)}
                      >
                        Quitar
                      </Boton>
                    ) : (
                      <span
                        style={{
                          fontSize: '12px',
                          color: 'var(--cp-soft)',
                          fontStyle: 'italic',
                        }}
                      >
                        {!esFutura ? 'No eliminable (pasada)' : 'Sin permiso para quitar'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Confirmar
        abierto={confirmarCrearAbierto}
        titulo="¿Registrar fecha especial?"
        mensaje={`Se programará la fecha ${nuevaFecha} con estado ${
          nuevoCerrado ? 'Cerrado' : `Horario especial (${nuevoAbre} a ${nuevoCierra})`
        }.`}
        textoSi="Sí, registrar"
        textoNo="No, revisar"
        cargando={guardando}
        alConfirmar={handleCrearFechaEspecial}
        alCancelar={() => setConfirmarCrearAbierto(false)}
      />

      <Confirmar
        abierto={fechaAEliminar !== null}
        titulo="¿Eliminar fecha especial?"
        mensaje={`¿Estás seguro de quitar la fecha especial ${fechaAEliminar}? El local volverá a atender según su horario regular ese día.`}
        textoSi="Sí, eliminar"
        textoNo="Cancelar"
        peligro
        cargando={guardando}
        alConfirmar={handleEliminarFechaEspecial}
        alCancelar={() => setFechaAEliminar(null)}
      />
    </div>
  );
}

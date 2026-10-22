import { useEffect, useState } from 'react';
import { Boton } from '../../../comun/Boton';
import { Insignia, VarianteInsignia } from '../../../comun/Insignia';
import { Cargando } from '../../../comun/Cargando';
import { EstadoVacio } from '../../../comun/EstadoVacio';
import { Confirmar } from '../../../comun/Confirmar';
import { DiaCalendarioReserva, Reserva } from '../tipos';
import { salonApi } from '../api';

export interface CalendarioAgendaReservasProps {
  onSentarReserva: (datos: {
    reservaId: string;
    mesas: string[];
    personas: number;
    nombre: string;
  }) => void;
  onEditarReserva: (reserva: Reserva) => void;
  onCancelarReserva: (reserva: Reserva) => void;
  recargarKey?: number;
}

const NOMBRES_MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Setiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function CalendarioAgendaReservas({
  onSentarReserva,
  onEditarReserva,
  onCancelarReserva,
  recargarKey = 0,
}: CalendarioAgendaReservasProps) {
  const hoy = new Date();
  const hoyAno = hoy.getFullYear();
  const hoyMesNum = hoy.getMonth() + 1;
  const hoyDia = hoy.getDate();
  const hoyFechaIso = `${hoyAno}-${String(hoyMesNum).padStart(2, '0')}-${String(
    hoyDia,
  ).padStart(2, '0')}`;

  const [ano, setAno] = useState(hoyAno);
  const [mes, setMes] = useState(hoyMesNum); // 1-12
  const [diaSeleccionadoIso, setDiaSeleccionadoIso] = useState(hoyFechaIso);

  // Datos del calendario del mes
  const [diasMes, setDiasMes] = useState<DiaCalendarioReserva[]>([]);
  const [cargandoCalendario, setCargandoCalendario] = useState(false);

  // Agenda del día
  const [agenda, setAgenda] = useState<Reserva[]>([]);
  const [cargandoAgenda, setCargandoAgenda] = useState(false);
  const [errorAgenda, setErrorAgenda] = useState<string | null>(null);

  // Confirmar para Sentar reserva
  const [reservaParaSentar, setReservaParaSentar] = useState<Reserva | null>(
    null,
  );
  const [sentando, setSentando] = useState(false);

  const mesFormateado = `${ano}-${String(mes).padStart(2, '0')}`;

  // 1. Cargar calendario mensual
  useEffect(() => {
    let activo = true;
    async function cargarCal() {
      setCargandoCalendario(true);
      try {
        const datos = await salonApi.calendario(mesFormateado);
        if (activo) {
          setDiasMes(datos || []);
        }
      } catch {
        if (activo) {
          setDiasMes([]);
        }
      } finally {
        if (activo) {
          setCargandoCalendario(false);
        }
      }
    }
    cargarCal();
    return () => {
      activo = false;
    };
  }, [mesFormateado, recargarKey]);

  // 2. Cargar agenda del día seleccionado
  useEffect(() => {
    let activo = true;
    async function cargarDia() {
      setCargandoAgenda(true);
      setErrorAgenda(null);
      try {
        const datos = await salonApi.agenda(diaSeleccionadoIso);
        if (activo) {
          setAgenda(datos || []);
        }
      } catch (err: any) {
        if (activo) {
          setErrorAgenda(
            err?.message || 'No fue posible cargar la agenda del día.',
          );
        }
      } finally {
        if (activo) {
          setCargandoAgenda(false);
        }
      }
    }
    cargarDia();
    return () => {
      activo = false;
    };
  }, [diaSeleccionadoIso, recargarKey]);

  // Navegación de mes
  const irMesAnterior = () => {
    if (mes === 1) {
      setAno(ano - 1);
      setMes(12);
    } else {
      setMes(mes - 1);
    }
  };

  const irMesSiguiente = () => {
    if (mes === 12) {
      setAno(ano + 1);
      setMes(1);
    } else {
      setMes(mes + 1);
    }
  };

  const irAHoy = () => {
    setAno(hoyAno);
    setMes(hoyMesNum);
    setDiaSeleccionadoIso(hoyFechaIso);
  };

  // Matriz de días del mes para el calendario
  const celdasCalendario = (() => {
    // Primer día del mes
    const primerDia = new Date(ano, mes - 1, 1);
    // Día de la semana (0=Dom, 1=Lun, ..., 6=Sáb) convertimos a Lun=0 ... Dom=6
    const diaSemanaInicio = (primerDia.getDay() + 6) % 7;
    const totalDiasEnMes = new Date(ano, mes, 0).getDate();

    const mapaCantidades = new Map<string, number>();
    for (const d of diasMes) {
      mapaCantidades.set(d.fecha, d.cantidad);
    }

    const celdas: Array<{
      diaNum?: number;
      fechaIso?: string;
      cantidad?: number;
      esVacia: boolean;
      esHoy: boolean;
      esSeleccionada: boolean;
    }> = [];

    // Celdas vacías al inicio
    for (let i = 0; i < diaSemanaInicio; i++) {
      celdas.push({ esVacia: true, esHoy: false, esSeleccionada: false });
    }

    // Días del mes
    for (let d = 1; d <= totalDiasEnMes; d++) {
      const fechaIso = `${ano}-${String(mes).padStart(2, '0')}-${String(
        d,
      ).padStart(2, '0')}`;
      const cantidad = mapaCantidades.get(fechaIso) || 0;
      celdas.push({
        diaNum: d,
        fechaIso,
        cantidad,
        esVacia: false,
        esHoy: fechaIso === hoyFechaIso,
        esSeleccionada: fechaIso === diaSeleccionadoIso,
      });
    }

    return celdas;
  })();

  // Ejecutar Sentar reserva
  const ejecutarSentar = async () => {
    if (!reservaParaSentar) return;
    setSentando(true);
    try {
      const res = await salonApi.sentarReserva(reservaParaSentar.id);
      onSentarReserva({
        reservaId: reservaParaSentar.id,
        mesas: res.mesas || [],
        personas: res.personas || reservaParaSentar.personas,
        nombre: res.nombre || reservaParaSentar.nombre,
      });
      setReservaParaSentar(null);
    } catch (err: any) {
      setErrorAgenda(err?.message || 'Error al sentar la reserva.');
    } finally {
      setSentando(false);
    }
  };

  const formatearHoraLima = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const getVarianteInsignia = (estado: string): VarianteInsignia => {
    switch (estado) {
      case 'ACTIVA':
        return 'aviso';
      case 'SENTADA':
        return 'exito';
      case 'CANCELADA':
        return 'peligro';
      case 'NO_ASISTIO':
      default:
        return 'neutro';
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
      }}
    >
      {/* =================================================================== */}
      {/* CALENDARIO MENSUAL                                                 */}
      {/* =================================================================== */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(11, 44, 62, 0.04)',
        }}
      >
        {/* Cabecera del calendario: Navegación de mes */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '17px',
                color: 'var(--cp-navy)',
              }}
            >
              Calendario de reservas
            </h3>
            <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
              Toca un día para ver su agenda detallada por hora
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={irMesAnterior}
              aria-label="Mes anterior"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '22px',
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
              &lsaquo;
            </button>

            <span
              style={{
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '16px',
                minWidth: '150px',
                textAlign: 'center',
                color: 'var(--cp-navy)',
              }}
            >
              {NOMBRES_MESES[mes - 1]} {ano}
            </span>

            <button
              type="button"
              onClick={irMesSiguiente}
              aria-label="Mes siguiente"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '22px',
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
              &rsaquo;
            </button>

            <Boton
              type="button"
              variante="secundario"
              tamano="pequeno"
              onClick={irAHoy}
            >
              Hoy
            </Boton>
          </div>
        </div>

        {/* Cuadrícula de 7 columnas */}
        {cargandoCalendario ? (
          <Cargando mensaje="Cargando mes..." />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '6px',
              textAlign: 'center',
            }}
          >
            {/* Cabecera de días de la semana */}
            {DIAS_SEMANA.map((dia) => (
              <div
                key={dia}
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: 'var(--cp-soft)',
                  padding: '4px 0',
                }}
              >
                {dia}
              </div>
            ))}

            {/* Celdas de los días */}
            {celdasCalendario.map((celda, idx) => {
              if (celda.esVacia) {
                return (
                  <div
                    key={`vacia-${idx}`}
                    style={{ minHeight: '52px', opacity: 0.2 }}
                  />
                );
              }

              const tieneReservas = (celda.cantidad || 0) > 0;

              return (
                <button
                  key={celda.fechaIso}
                  type="button"
                  onClick={() =>
                    celda.fechaIso && setDiaSeleccionadoIso(celda.fechaIso)
                  }
                  style={{
                    minHeight: '54px',
                    padding: '4px 2px',
                    borderRadius: '10px',
                    border: celda.esSeleccionada
                      ? '2px solid var(--cp-navy)'
                      : celda.esHoy
                      ? '1.5px solid var(--cp-orange)'
                      : '1px solid var(--cp-line)',
                    background: celda.esSeleccionada
                      ? 'var(--cp-cream)'
                      : 'var(--cp-white)',
                    color: 'var(--cp-navy)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: '2px',
                    cursor: 'pointer',
                    boxShadow: celda.esSeleccionada
                      ? '0 0 0 2px var(--cp-navy)'
                      : 'none',
                  }}
                >
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: '13px',
                      color: celda.esHoy ? 'var(--cp-rust)' : 'var(--cp-navy)',
                    }}
                  >
                    {celda.diaNum}
                  </span>

                  {tieneReservas && (
                    <span
                      style={{
                        minWidth: '20px',
                        fontSize: '10px',
                        fontWeight: 800,
                        borderRadius: '9999px',
                        padding: '1px 6px',
                        background: 'var(--cp-orange)',
                        color: 'var(--cp-navy)',
                      }}
                    >
                      {celda.cantidad}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* AGENDA DEL DÍA SELECCIONADO                                        */}
      {/* =================================================================== */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(11, 44, 62, 0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--cp-line)',
            paddingBottom: '8px',
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontFamily: 'var(--fuente-titulos)',
                fontWeight: 800,
                fontSize: '16px',
                color: 'var(--cp-navy)',
              }}
            >
              Agenda del día: {diaSeleccionadoIso}
            </h3>
            <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
              {agenda.length} reserva(s) registrada(s)
            </div>
          </div>
        </div>

        {cargandoAgenda ? (
          <Cargando mensaje="Cargando agenda del día..." />
        ) : errorAgenda ? (
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
            {errorAgenda}
          </div>
        ) : agenda.length === 0 ? (
          <EstadoVacio
            titulo="No hay reservas para esta fecha"
            descripcion="No se encontraron reservas registradas para el día seleccionado."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {agenda.map((r) => {
              const esActiva = r.estado === 'ACTIVA';
              const nombresMesas = (r.mesas || [])
                .map((m) => m.nombre || `Mesa ${m.numero}`)
                .join(', ');

              return (
                <div
                  key={r.id}
                  style={{
                    border: '1.5px solid var(--cp-line)',
                    borderLeft: `6px solid ${
                      esActiva
                        ? 'var(--cp-orange)'
                        : r.estado === 'SENTADA'
                        ? 'var(--cp-ok)'
                        : 'var(--cp-line)'
                    }`,
                    borderRadius: '12px',
                    padding: '10px 14px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    background: esActiva ? 'var(--cp-cream)' : 'var(--cp-white)',
                  }}
                >
                  {/* Hora y datos principales */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        fontFamily: 'var(--fuente-titulos)',
                        fontWeight: 800,
                        fontSize: '18px',
                        color: 'var(--cp-navy)',
                        minWidth: '60px',
                      }}
                    >
                      {formatearHoraLima(r.hora)}
                    </div>

                    <div>
                      <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--cp-navy)' }}>
                        {r.nombre}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                        {r.telefono} · {r.personas} personas · {nombresMesas || 'Sin mesa'}
                      </div>
                      {r.motivo_cancelacion && (
                        <div style={{ fontSize: '11px', color: 'var(--cp-rust)', marginTop: '2px' }}>
                          Motivo: {r.motivo_cancelacion}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Estado y Acciones */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Insignia variante={getVarianteInsignia(r.estado)}>
                      {r.estado}
                    </Insignia>

                    {esActiva && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Boton
                          type="button"
                          variante="primario"
                          tamano="pequeno"
                          onClick={() => setReservaParaSentar(r)}
                        >
                          Sentar
                        </Boton>
                        <Boton
                          type="button"
                          variante="secundario"
                          tamano="pequeno"
                          onClick={() => onEditarReserva(r)}
                        >
                          Editar
                        </Boton>
                        <Boton
                          type="button"
                          variante="peligro"
                          tamano="pequeno"
                          onClick={() => onCancelarReserva(r)}
                        >
                          Cancelar
                        </Boton>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmación obligatoria para «Sentar» reserva */}
      {reservaParaSentar && (
        <Confirmar
          abierto={true}
          titulo="¿Sentar a los clientes de la reserva?"
          mensaje={`Se marcará la reserva de ${reservaParaSentar.nombre} como SENTADA y se abrirá el pedido del mozo con las mesas asignadas.`}
          textoSi="Sí, sentar y abrir pedido"
          textoNo="No, volver"
          cargando={sentando}
          alConfirmar={ejecutarSentar}
          alCancelar={() => setReservaParaSentar(null)}
        />
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { Boton } from '../../comun/Boton';
import { Campo } from '../../comun/Campo';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { LimiteError } from '../../comun/LimiteError';
import { comoLista } from '../../comun/comoLista';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { ZonasMapa, DiagnosticoZonas } from './ZonasMapa';

export type CoordenadaPunto = [number, number];

export interface ZonaRepartoItem {
  id: string;
  codigo: string;
  tarifa: number;
  /** Minutos típicos de entrega de la zona (null si aún no los tiene). */
  minutosMin?: number | null;
  minutosMax?: number | null;
  activa: boolean;
  puntos: number;
  poligono: CoordenadaPunto[];
}

export function ZonasRepartoView() {
  return (
    <LimiteError>
      <ZonasRepartoContenido />
    </LimiteError>
  );
}

function ZonasRepartoContenido() {
  const { tiene } = useSesion();
  const [zonas, setZonas] = useState<ZonaRepartoItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Estados de edición de tarifa
  const [zonaTarifaEditando, setZonaTarifaEditando] = useState<ZonaRepartoItem | null>(null);
  const [nuevaTarifaInput, setNuevaTarifaInput] = useState<string>('');
  const [errorTarifa, setErrorTarifa] = useState<string | null>(null);
  const [confirmarTarifaAbierto, setConfirmarTarifaAbierto] = useState(false);

  // Estados de edición de minutos de entrega
  const [zonaTiempoEditando, setZonaTiempoEditando] = useState<ZonaRepartoItem | null>(null);
  const [minInput, setMinInput] = useState<string>('');
  const [maxInput, setMaxInput] = useState<string>('');
  const [errorTiempo, setErrorTiempo] = useState<string | null>(null);
  const [confirmarTiempoAbierto, setConfirmarTiempoAbierto] = useState(false);

  // Estados de activación/desactivación
  const [zonaToggleActiva, setZonaToggleActiva] = useState<ZonaRepartoItem | null>(null);

  // Estados de edición de polígono
  const [zonaPoligonoEditando, setZonaPoligonoEditando] = useState<ZonaRepartoItem | null>(null);
  const [poligonoJsonTexto, setPoligonoJsonTexto] = useState<string>('');
  const [errorPoligono, setErrorPoligono] = useState<string | null>(null);
  const [confirmarPoligonoAbierto, setConfirmarPoligonoAbierto] = useState(false);
  const [puntosValidados, setPuntosValidados] = useState<CoordenadaPunto[] | null>(null);

  // Feedback general
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null);
  const [vista, setVista] = useState<'mapa' | 'lista'>('mapa');
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [diagnostico, setDiagnostico] = useState<DiagnosticoZonas | null>(null);
  const [versionHistorial, setVersionHistorial] = useState(0);

  const puedeVer = tiene('zonas/ver');
  const puedeEditar = tiene('zonas/editar');

  const cargarZonas = async () => {
    if (!puedeVer) {
      setCargando(false);
      return;
    }
    setCargando(true);
    setErrorCarga(null);
    try {
      const res = await api.get<ZonaRepartoItem[]>('/admin/zonas');
      setZonas(comoLista<ZonaRepartoItem>(res));
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'No se pudieron cargar las zonas de reparto';
      setErrorCarga(msg);
    } finally {
      setCargando(false);
    }
  };

  const cargarDiagnostico = async () => {
    if (!puedeVer) return;
    try {
      setDiagnostico(await api.get<DiagnosticoZonas>('/admin/zonas/diagnostico'));
    } catch {
      setDiagnostico(null);
    }
  };

  useEffect(() => {
    cargarZonas();
    void cargarDiagnostico();
  }, [puedeVer]);

  // Guardado del área desde el mapa: lanza el error del servidor para que el mapa lo muestre
  const guardarPoligonoMapa = async (codigo: string, puntos: CoordenadaPunto[]) => {
    const res = await api.put<ZonaRepartoItem>(`/admin/zonas/${codigo}/poligono`, { poligono: puntos });
    setZonas((prev) =>
      prev.map((z) => (z.codigo === res.codigo ? { ...z, poligono: res.poligono, puntos: res.puntos } : z)),
    );
    setMensajeGuardado(`Guardado a las ${new Date().toLocaleTimeString('es-PE', { hour12: false })}`);
    setVersionHistorial((v) => v + 1);
    void cargarDiagnostico();
  };

  if (!puedeVer) {
    return (
      <div
        role="status"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 16px',
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '16px',
          textAlign: 'center',
          gap: '12px',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--fuente-titulos)',
            fontWeight: 800,
            fontSize: '18px',
            color: 'var(--cp-rust)',
          }}
        >
          No tienes permiso
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--cp-soft)',
            maxWidth: '400px',
            lineHeight: '20px',
            margin: 0,
          }}
        >
          Tu rol actual no cuenta con el permiso <b>zonas/ver</b> necesario para visualizar las zonas de reparto.
        </p>
      </div>
    );
  }

  if (cargando) {
    return <Cargando mensaje="Cargando zonas de reparto..." />;
  }

  if (errorCarga) {
    return (
      <EstadoError
        titulo="Error al cargar zonas de reparto"
        mensaje={errorCarga}
        alReintentar={cargarZonas}
      />
    );
  }

  // --- Manejo de Tarifa ---
  const abrirEditarTarifa = (zona: ZonaRepartoItem) => {
    setZonaTarifaEditando(zona);
    setNuevaTarifaInput(String(zona.tarifa));
    setErrorTarifa(null);
    setErrorServidor(null);
  };

  const prepararGuardarTarifa = () => {
    const num = Number(nuevaTarifaInput.trim());
    if (isNaN(num) || num < 0) {
      setErrorTarifa('La tarifa debe ser un número mayor o igual a 0');
      return;
    }
    setErrorTarifa(null);
    setConfirmarTarifaAbierto(true);
  };

  const handleGuardarTarifa = async () => {
    if (!zonaTarifaEditando || !puedeEditar) return;
    const tarifaFinal = Number(nuevaTarifaInput.trim());
    setGuardando(true);
    setErrorServidor(null);
    try {
      const res = await api.put<ZonaRepartoItem>(
        `/admin/zonas/${zonaTarifaEditando.codigo}/tarifa`,
        { tarifa: tarifaFinal },
      );

      setZonas((prev) =>
        prev.map((z) => (z.codigo === res.codigo ? { ...z, tarifa: res.tarifa } : z)),
      );

      const ahora = new Date();
      const horaStr = ahora.toLocaleTimeString('es-PE', { hour12: false });
      setMensajeGuardado(`Guardado a las ${horaStr}`);
      setVersionHistorial((v) => v + 1);
      setConfirmarTarifaAbierto(false);
      setZonaTarifaEditando(null);
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'Error al actualizar la tarifa de la zona';
      setErrorServidor(msg);
      setConfirmarTarifaAbierto(false);
    } finally {
      setGuardando(false);
    }
  };

  // --- Manejo de minutos de entrega ---
  const abrirEditarTiempo = (zona: ZonaRepartoItem) => {
    setZonaTiempoEditando(zona);
    setMinInput(zona.minutosMin != null ? String(zona.minutosMin) : '');
    setMaxInput(zona.minutosMax != null ? String(zona.minutosMax) : '');
    setErrorTiempo(null);
  };

  const prepararGuardarTiempo = () => {
    const min = Number(minInput.trim());
    const max = Number(maxInput.trim());
    const enteros = Number.isInteger(min) && Number.isInteger(max);
    if (!enteros || min < 5 || max > 120) {
      setErrorTiempo('Los minutos deben ser enteros entre 5 y 120');
      return;
    }
    if (min > max) {
      setErrorTiempo('El mínimo no puede ser mayor que el máximo');
      return;
    }
    setErrorTiempo(null);
    setConfirmarTiempoAbierto(true);
  };

  const handleGuardarTiempo = async () => {
    if (!zonaTiempoEditando || !puedeEditar) return;
    const min = Number(minInput.trim());
    const max = Number(maxInput.trim());
    setGuardando(true);
    setErrorServidor(null);
    try {
      const res = await api.put<ZonaRepartoItem>(
        `/admin/zonas/${zonaTiempoEditando.codigo}/tiempo`,
        { minutosMin: min, minutosMax: max },
      );
      setZonas((prev) =>
        prev.map((z) =>
          z.codigo === res.codigo ? { ...z, minutosMin: res.minutosMin, minutosMax: res.minutosMax } : z,
        ),
      );
      const horaStr = new Date().toLocaleTimeString('es-PE', { hour12: false });
      setMensajeGuardado(`Guardado a las ${horaStr}`);
      setVersionHistorial((v) => v + 1);
      setConfirmarTiempoAbierto(false);
      setZonaTiempoEditando(null);
    } catch (err) {
      const msg = err instanceof ErrorApi ? err.message : 'Error al actualizar los minutos de la zona';
      setErrorServidor(msg);
      setConfirmarTiempoAbierto(false);
    } finally {
      setGuardando(false);
    }
  };

  // --- Manejo de Activar / Desactivar ---
  const handleToggleActiva = async () => {
    if (!zonaToggleActiva || !puedeEditar) return;
    const nuevoEstado = !zonaToggleActiva.activa;
    setGuardando(true);
    setErrorServidor(null);
    try {
      const res = await api.put<ZonaRepartoItem>(
        `/admin/zonas/${zonaToggleActiva.codigo}/activa`,
        { activa: nuevoEstado },
      );

      setZonas((prev) =>
        prev.map((z) => (z.codigo === res.codigo ? { ...z, activa: res.activa } : z)),
      );

      const ahora = new Date();
      const horaStr = ahora.toLocaleTimeString('es-PE', { hour12: false });
      setMensajeGuardado(`Guardado a las ${horaStr}`);
      setVersionHistorial((v) => v + 1);
      setZonaToggleActiva(null);
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'Error al cambiar el estado de la zona';
      setErrorServidor(msg);
      setZonaToggleActiva(null);
    } finally {
      setGuardando(false);
    }
  };

  // --- Manejo de Polígono ---
  const abrirEditarPoligono = (zona: ZonaRepartoItem) => {
    setZonaPoligonoEditando(zona);
    const texto = JSON.stringify(zona.poligono || [], null, 2);
    setPoligonoJsonTexto(texto);
    setErrorPoligono(null);
    setErrorServidor(null);
  };

  const prepararGuardarPoligono = () => {
    try {
      const parseado = JSON.parse(poligonoJsonTexto);
      if (!Array.isArray(parseado)) {
        setErrorPoligono('El polígono debe ser un arreglo de puntos [lat, lng]');
        return;
      }
      if (parseado.length < 3) {
        setErrorPoligono('El polígono debe tener al menos 3 puntos de coordenadas');
        return;
      }

      const puntosLimpios: CoordenadaPunto[] = [];
      for (let i = 0; i < parseado.length; i++) {
        const p = parseado[i];
        let lat: number | undefined;
        let lng: number | undefined;

        if (Array.isArray(p) && p.length >= 2) {
          lat = Number(p[0]);
          lng = Number(p[1]);
        } else if (typeof p === 'object' && p !== null) {
          lat = Number((p as any).lat ?? (p as any).latitud);
          lng = Number((p as any).lng ?? (p as any).longitud);
        }

        if (
          lat === undefined ||
          lng === undefined ||
          isNaN(lat) ||
          isNaN(lng) ||
          lat < -90 ||
          lat > 90 ||
          lng < -180 ||
          lng > 180
        ) {
          setErrorPoligono(
            `El punto en la posición ${i + 1} no es válido. Debe tener latitud entre -90 y 90, y longitud entre -180 y 180.`,
          );
          return;
        }
        puntosLimpios.push([lat, lng]);
      }

      setPuntosValidados(puntosLimpios);
      setErrorPoligono(null);
      setConfirmarPoligonoAbierto(true);
    } catch {
      setErrorPoligono('El texto ingresado no es un JSON válido. Revisa la sintaxis.');
    }
  };

  const handleGuardarPoligono = async () => {
    if (!zonaPoligonoEditando || !puntosValidados || !puedeEditar) return;
    setGuardando(true);
    setErrorServidor(null);
    try {
      const res = await api.put<ZonaRepartoItem>(
        `/admin/zonas/${zonaPoligonoEditando.codigo}/poligono`,
        { poligono: puntosValidados },
      );

      setZonas((prev) =>
        prev.map((z) =>
          z.codigo === res.codigo
            ? { ...z, poligono: res.poligono, puntos: res.puntos }
            : z,
        ),
      );

      const ahora = new Date();
      const horaStr = ahora.toLocaleTimeString('es-PE', { hour12: false });
      setMensajeGuardado(`Guardado a las ${horaStr}`);
      setVersionHistorial((v) => v + 1);
      setConfirmarPoligonoAbierto(false);
      setZonaPoligonoEditando(null);
      setPuntosValidados(null);
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'Error al actualizar el polígono de la zona';
      setErrorServidor(msg);
      setConfirmarPoligonoAbierto(false);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      {/* Cabecera */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '22px',
              color: 'var(--cp-navy)',
            }}
          >
            Zonas de reparto
          </h1>
          <p
            style={{
              fontSize: '13px',
              lineHeight: '19px',
              color: 'var(--cp-soft)',
              margin: '4px 0 0 0',
            }}
          >
            Zonas de cobertura de delivery, tarifas asociadas y polígonos de delimitación (Z2, Z3, Z4, Z5 y Z7).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div role="group" aria-label="Vista de zonas" style={{ display: 'inline-flex', border: '1px solid var(--cp-line)', borderRadius: '10px', overflow: 'hidden' }}>
            {(['mapa', 'lista'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={vista === v}
                onClick={() => setVista(v)}
                style={{ minHeight: '44px', padding: '0 14px', border: 0, background: vista === v ? 'var(--cp-navy)' : 'var(--cp-white)', color: vista === v ? 'var(--cp-white)' : 'var(--cp-navy)', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
              >
                {v === 'mapa' ? 'Mapa' : 'Lista'}
              </button>
            ))}
          </div>
        {mensajeGuardado && (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--cp-green)',
              background: 'var(--cp-greenbg)',
              padding: '6px 12px',
              borderRadius: '9999px',
            }}
          >
            {mensajeGuardado}
          </span>
        )}
        </div>
      </div>

      {/* Nota: rige para pedidos nuevos */}
      <div
        style={{
          background: 'var(--cp-sand)',
          border: '1.5px solid var(--cp-line)',
          borderRadius: '12px',
          padding: '12px 16px',
          fontSize: '13px',
          lineHeight: '18px',
          color: 'var(--cp-soft)',
        }}
      >
        <b>Nota de entrega:</b> Los cambios de tarifa, estado y área rigen solo para pedidos nuevos. Los pedidos ya creados conservan su envío y su zona. El mapa usa coordenadas <code>[latitud, longitud]</code>; el editor JSON queda como respaldo avanzado.
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
          Modo sólo lectura. No tienes el permiso <b>zonas/editar</b> para modificar tarifas, estados o polígonos.
        </div>
      )}

      {errorServidor && (
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
          {errorServidor}
        </div>
      )}

      {zonas.length === 0 ? (
        <EstadoVacio
          titulo="No hay zonas registradas"
          descripcion="No se encontraron zonas de reparto en la base de datos."
        />
      ) : vista === 'mapa' ? (
        <ZonasMapa
          zonas={zonas}
          seleccionado={seleccionado}
          onSeleccionar={setSeleccionado}
          puedeEditar={puedeEditar}
          diagnostico={diagnostico}
          versionHistorial={versionHistorial}
          onEditarTarifa={abrirEditarTarifa}
          onEditarTiempo={abrirEditarTiempo}
          onCambiarActiva={(z) => setZonaToggleActiva(z)}
          onEditarJson={abrirEditarPoligono}
          onGuardarPoligono={guardarPoligonoMapa}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {zonas.map((z) => (
            <div
              key={z.codigo}
              style={{
                background: 'var(--cp-white)',
                border: '1px solid var(--cp-line)',
                borderRadius: '16px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                boxShadow: '0 2px 8px rgba(11, 44, 62, 0.04)',
                opacity: z.activa ? 1 : 0.75,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--fuente-titulos)',
                      fontWeight: 800,
                      fontSize: '20px',
                      color: 'var(--cp-navy)',
                    }}
                  >
                    Zona {z.codigo}
                  </span>
                  {z.activa ? (
                    <Insignia variante="exito">Activa</Insignia>
                  ) : (
                    <Insignia variante="peligro">Inactiva</Insignia>
                  )}
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={z.activa}
                  aria-label={`${z.codigo}: ${z.activa ? 'Desactivar zona' : 'Activar zona'}`}
                  disabled={!puedeEditar || guardando}
                  onClick={() => setZonaToggleActiva(z)}
                  style={{
                    minHeight: '36px',
                    padding: '0 14px',
                    borderRadius: '9999px',
                    border: '1.5px solid var(--cp-navy)',
                    background: z.activa ? 'var(--cp-navy)' : 'transparent',
                    color: z.activa ? 'var(--cp-cream)' : 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: !puedeEditar ? 'not-allowed' : 'pointer',
                  }}
                >
                  {z.activa ? 'Apagar' : 'Encender'}
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--cp-sand)',
                  padding: '10px 14px',
                  borderRadius: '12px',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cp-soft)' }}>
                    TARIFA DE ENVÍO
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--fuente-titulos)',
                      fontWeight: 800,
                      fontSize: '18px',
                      color: 'var(--cp-navy)',
                    }}
                  >
                    S/ {Number(z.tarifa).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }} data-testid={`minutos-${z.codigo}`}>
                    {z.minutosMin != null && z.minutosMax != null
                      ? `${z.minutosMin}–${z.minutosMax} min`
                      : 'Sin minutos de entrega'}
                  </div>
                </div>

                {puedeEditar && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <Boton
                      type="button"
                      variante="secundario"
                      tamano="pequeno"
                      onClick={() => abrirEditarTarifa(z)}
                    >
                      Editar tarifa
                    </Boton>
                    <Boton
                      type="button"
                      variante="secundario"
                      tamano="pequeno"
                      onClick={() => abrirEditarTiempo(z)}
                    >
                      Editar minutos
                    </Boton>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>
                  {z.puntos} puntos en polígono
                </span>
                <Boton
                  type="button"
                  variante="secundario"
                  tamano="pequeno"
                  onClick={() => abrirEditarPoligono(z)}
                >
                  Ver / Editar polígono
                </Boton>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Editar Tarifa */}
      {zonaTarifaEditando && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: 'rgba(11, 44, 62, 0.65)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => !guardando && setZonaTarifaEditando(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="editar-tarifa-titulo"
            style={{
              width: '100%',
              maxWidth: '420px',
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 12px 36px rgba(11, 44, 62, 0.22)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3
                id="editar-tarifa-titulo"
                style={{
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: '17px',
                  color: 'var(--cp-navy)',
                }}
              >
                Editar tarifa · Zona {zonaTarifaEditando.codigo}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--cp-soft)', margin: '4px 0 0 0' }}>
                Tarifa en soles que se cobrará por pedidos con entrega en esta zona.
              </p>
            </div>

            {errorTarifa && (
              <div
                role="alert"
                style={{
                  background: '#FBEDE9',
                  border: '1px solid var(--cp-rust)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: 'var(--cp-rust)',
                  fontWeight: 600,
                }}
              >
                {errorTarifa}
              </div>
            )}

            <Campo
              etiqueta="Nueva tarifa (S/)"
              type="number"
              step="0.5"
              min="0"
              value={nuevaTarifaInput}
              onChange={(e) => {
                setNuevaTarifaInput(e.target.value);
                setErrorTarifa(null);
              }}
              autoFocus
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <Boton
                type="button"
                variante="secundario"
                disabled={guardando}
                onClick={() => setZonaTarifaEditando(null)}
              >
                Cancelar
              </Boton>
              <Boton
                type="button"
                variante="primario"
                disabled={guardando}
                onClick={prepararGuardarTarifa}
              >
                Continuar
              </Boton>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar minutos de entrega */}
      {zonaTiempoEditando && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: 'rgba(11, 44, 62, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => !guardando && setZonaTiempoEditando(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="editar-tiempo-titulo"
            style={{
              width: '100%',
              maxWidth: '420px',
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '20px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 id="editar-tiempo-titulo" style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: '17px', color: 'var(--cp-navy)' }}>
                Minutos de entrega · Zona {zonaTiempoEditando.codigo}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--cp-soft)', margin: '4px 0 0 0' }}>
                Rango típico de entrega en esta zona. El aviso de salida suma recorrido y empaque sobre este rango.
              </p>
            </div>

            {errorTiempo && (
              <div role="alert" style={{ background: '#FBEDE9', border: '1px solid var(--cp-rust)', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', color: 'var(--cp-rust)', fontWeight: 600 }}>
                {errorTiempo}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <Campo
                etiqueta="Mínimo (min)"
                type="number"
                step="1"
                min="5"
                max="120"
                value={minInput}
                onChange={(e) => {
                  setMinInput(e.target.value);
                  setErrorTiempo(null);
                }}
                autoFocus
              />
              <Campo
                etiqueta="Máximo (min)"
                type="number"
                step="1"
                min="5"
                max="120"
                value={maxInput}
                onChange={(e) => {
                  setMaxInput(e.target.value);
                  setErrorTiempo(null);
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <Boton type="button" variante="secundario" disabled={guardando} onClick={() => setZonaTiempoEditando(null)}>
                Cancelar
              </Boton>
              <Boton type="button" variante="primario" disabled={guardando} onClick={prepararGuardarTiempo}>
                Continuar
              </Boton>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar cambio de minutos */}
      <Confirmar
        abierto={confirmarTiempoAbierto}
        titulo="¿Actualizar minutos de entrega?"
        mensaje={`¿Confirmas cambiar la zona ${zonaTiempoEditando?.codigo} a ${minInput}–${maxInput} minutos? Rige para pedidos nuevos.`}
        textoSi="Sí, actualizar minutos"
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={handleGuardarTiempo}
        alCancelar={() => setConfirmarTiempoAbierto(false)}
      />

      {/* Confirmar Cambio de Tarifa */}
      <Confirmar
        abierto={confirmarTarifaAbierto}
        titulo="¿Actualizar tarifa de envío?"
        mensaje={`¿Confirmas cambiar la tarifa de la zona ${
          zonaTarifaEditando?.codigo
        } a S/ ${Number(nuevaTarifaInput).toFixed(2)}?`}
        textoSi="Sí, actualizar tarifa"
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={handleGuardarTarifa}
        alCancelar={() => setConfirmarTarifaAbierto(false)}
      />

      {/* Confirmar Alternar Estado Activa / Inactiva */}
      <Confirmar
        abierto={zonaToggleActiva !== null}
        titulo={zonaToggleActiva?.activa ? '¿Desactivar zona de reparto?' : '¿Activar zona de reparto?'}
        mensaje={
          zonaToggleActiva?.activa
            ? `Al desactivar la zona ${zonaToggleActiva?.codigo}, los pedidos con punto de entrega en esta zona se considerarán fuera de cobertura y no se permitirá delivery.`
            : `Al activar la zona ${zonaToggleActiva?.codigo}, los clientes dentro del polígono podrán solicitar pedidos con la tarifa asignada.`
        }
        textoSi={zonaToggleActiva?.activa ? 'Sí, desactivar zona' : 'Sí, activar zona'}
        textoNo="No, cancelar"
        peligro={zonaToggleActiva?.activa}
        cargando={guardando}
        alConfirmar={handleToggleActiva}
        alCancelar={() => setZonaToggleActiva(null)}
      />

      {/* Modal Ver / Editar Polígono */}
      {zonaPoligonoEditando && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: 'rgba(11, 44, 62, 0.65)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => !guardando && setZonaPoligonoEditando(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="editar-poligono-titulo"
            style={{
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 12px 36px rgba(11, 44, 62, 0.22)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3
                id="editar-poligono-titulo"
                style={{
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: '18px',
                  color: 'var(--cp-navy)',
                }}
              >
                Polígono · Zona {zonaPoligonoEditando.codigo}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--cp-soft)', margin: '4px 0 0 0' }}>
                Edita las coordenadas pegando un JSON validado con arreglo de puntos <code>[latitud, longitud]</code>.
              </p>
            </div>

            {errorPoligono && (
              <div
                role="alert"
                style={{
                  background: '#FBEDE9',
                  border: '1px solid var(--cp-rust)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  color: 'var(--cp-rust)',
                  fontWeight: 600,
                }}
              >
                {errorPoligono}
              </div>
            )}

            <div>
              <label
                htmlFor="textarea-poligono"
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                Coordenadas JSON (mínimo 3 puntos):
              </label>
              <textarea
                id="textarea-poligono"
                rows={10}
                value={poligonoJsonTexto}
                disabled={!puedeEditar || guardando}
                onChange={(e) => {
                  setPoligonoJsonTexto(e.target.value);
                  setErrorPoligono(null);
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: '12px',
                  border: '1.5px solid var(--cp-line)',
                  background: 'var(--cp-white)',
                  color: 'var(--cp-navy)',
                  padding: '10px 12px',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <Boton
                type="button"
                variante="secundario"
                disabled={guardando}
                onClick={() => setZonaPoligonoEditando(null)}
              >
                Cerrar
              </Boton>
              {puedeEditar && (
                <Boton
                  type="button"
                  variante="primario"
                  disabled={guardando}
                  onClick={prepararGuardarPoligono}
                >
                  Validar y guardar
                </Boton>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmar Guardar Polígono */}
      <Confirmar
        abierto={confirmarPoligonoAbierto}
        titulo="¿Guardar nuevo polígono?"
        mensaje={`Se actualizará el polígono de la zona ${zonaPoligonoEditando?.codigo} con ${puntosValidados?.length} puntos de coordenadas.`}
        textoSi="Sí, guardar polígono"
        textoNo="No, revisar"
        cargando={guardando}
        alConfirmar={handleGuardarPoligono}
        alCancelar={() => setConfirmarPoligonoAbierto(false)}
      />
    </div>
  );
}

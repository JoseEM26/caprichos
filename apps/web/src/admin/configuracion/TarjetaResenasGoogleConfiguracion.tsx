import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ErrorApi } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { Confirmar } from '../../comun/Confirmar';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { CampoConfig } from './CampoConfig';

function useSesionSegura() {
  try {
    return useSesion();
  } catch {
    return null;
  }
}

export interface CandidatoResena {
  businessId: string;
  nombre: string;
  direccion: string | null;
  rating: number | null;
  total: number | null;
  enlaceLocal: string | null;
}

export interface ResenaAdmin {
  id: string;
  autor: string;
  foto: string | null;
  estrellas: number;
  texto: string;
  fecha: string | null;
  enlace: string | null;
  visible: boolean;
}

export interface EstadoResenas {
  negocio: { businessId: string; nombre: string } | null;
  claveConfigurada: boolean;
  resumen: { rating: number; total: number } | null;
  ultimaActualizacion: string | null;
  cargaInicialHecha: boolean;
  consumo: number;
  tope: number;
  guardadas: number;
  visibles: number;
  ocultas: number;
  actualizarAhora: { disponible: boolean; motivo: string | null };
  autoActiva: boolean;
}

export interface RespuestaListar {
  estado: EstadoResenas;
  resenas: ResenaAdmin[];
}

type Accion =
  | { tipo: 'negocio'; candidato: CandidatoResena }
  | { tipo: 'actualizar' }
  | { tipo: 'carga' };

const MINIMO_CARGA = 20;

const MOTIVOS: Record<string, string> = {
  SIN_CLAVE: 'Falta la clave de la API de reseñas en el servidor. Lo configura el equipo técnico.',
  SIN_NEGOCIO: 'Primero elige tu local en Google.',
  LIMITE_DIARIO: 'La actualización a mano se usa una vez al día. Vuelve mañana.',
  TOPE_MENSUAL: 'Se llegó al tope mensual de consultas a la API. Se muestra lo guardado.',
};

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }) : 'Nunca');

/** Tarjeta «Reseñas de Google» en Operación: lo técnico (local, carga inicial, actualizar, consumo y totales). Elegir reseñas está en /admin/resenas. Solo ADMIN. */
export function TarjetaResenasGoogleConfiguracion({ esAdmin: esAdminProp }: { esAdmin?: boolean } = {}) {
  const sesion = useSesionSegura();
  const esAdmin = esAdminProp !== undefined ? esAdminProp : (sesion?.usuario?.rol || '').toUpperCase() === 'ADMIN';

  const [datos, setDatos] = useState<RespuestaListar | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [consulta, setConsulta] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [candidatos, setCandidatos] = useState<CandidatoResena[] | null>(null);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setDatos(await api.get<RespuestaListar>('/admin/resenas'));
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo leer las reseñas de Google');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (esAdmin) void cargar();
  }, [cargar, esAdmin]);

  const buscar = async () => {
    setError(null);
    setExito(null);
    setCandidatos(null);
    setBuscando(true);
    try {
      const r = await api.post<{ ok: boolean; candidatos?: CandidatoResena[]; mensaje?: string }>('/admin/resenas/buscar-negocio', { consulta });
      if (r.ok === false) setError(r.mensaje || 'No se pudo buscar el local');
      else setCandidatos((r.candidatos ?? []).slice(0, 3));
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo buscar el local');
    } finally {
      setBuscando(false);
    }
  };

  /** Ejecuta la acción confirmada. Cualquier resultado con ok:false se muestra; nada se borra en la app. */
  const ejecutar = async () => {
    if (!accion) return;
    setGuardando(true);
    setError(null);
    setExito(null);
    try {
      if (accion.tipo === 'negocio') {
        await api.put('/admin/resenas/negocio', {
          businessId: accion.candidato.businessId,
          nombre: accion.candidato.nombre,
          rating: accion.candidato.rating ?? undefined,
          total: accion.candidato.total ?? undefined,
          enlaceLocal: accion.candidato.enlaceLocal ?? undefined,
        });
        setCandidatos(null);
        setConsulta('');
        setExito('Local guardado. Ya puedes cargar las reseñas.');
      } else if (accion.tipo === 'actualizar') {
        const r = await api.post<any>('/admin/resenas/actualizar', {});
        if (r.ok === false) setError(r.mensaje);
        else setExito(`Reseñas actualizadas: ${r.nuevas ?? 0} nuevas, ${r.actualizadas ?? 0} ya estaban.`);
      } else if (accion.tipo === 'carga') {
        const repetir = datos?.estado.cargaInicialHecha === true;
        const r = await api.post<any>('/admin/resenas/carga-inicial', { repetir });
        setExito(
          r.ok === false
            ? `Carga detenida: se guardaron ${r.guardadas} reseñas en ${r.paginas} páginas. ${r.mensaje ?? ''}`.trim()
            : `Carga lista: ${r.guardadas} reseñas guardadas en ${r.paginas} páginas.`,
        );
        if (r.ok === false) setError(r.mensaje ?? 'La carga se detuvo');
      }
      setAccion(null);
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo completar la acción');
      setAccion(null);
    } finally {
      setGuardando(false);
    }
  };

  if (!esAdmin) {
    return (
      <div data-testid="tarjeta-resenas-no-admin" style={{ padding: 16, fontSize: 13, color: 'var(--cp-soft)' }}>
        Reseñas de Google: solo ADMIN.
      </div>
    );
  }
  if (cargando && !datos) {
    return (
      <div data-testid="tarjeta-resenas-cargando" style={{ padding: 20 }}>
        <Cargando mensaje="Cargando reseñas de Google..." />
      </div>
    );
  }

  const estado = datos?.estado;
  const pocas = (estado?.guardadas ?? 0) < MINIMO_CARGA;
  const motivoActualizar = estado?.actualizarAhora.motivo ? MOTIVOS[estado.actualizarAhora.motivo] ?? 'No disponible hoy.' : null;

  return (
    <div
      data-testid="tarjeta-resenas-google"
      style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 20px', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 16, marginBottom: 8 }}
    >
      <CampoConfig id="operacion-resenas-google" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--cp-navy)' }}>Reseñas de Google</div>
          <div style={{ fontSize: 12.5, color: 'var(--cp-soft)', marginTop: 2, maxWidth: 620 }}>
            Las reseñas buenas de tu local en Google aparecen en la carta, antes de «Deja tu opinión». La carta solo lee lo guardado: no consulta Google.
          </div>
        </div>

        {error && (
          <div role="alert" style={{ fontSize: 13, color: 'var(--cp-red, #b3261e)' }}>
            {error}
          </div>
        )}
        {exito && (
          <div role="status" style={{ fontSize: 13, color: 'var(--cp-navy)' }}>
            {exito}
          </div>
        )}

        {!estado?.negocio && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label htmlFor="resenas-buscar-local" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-navy)' }}>
              Nombre de tu local en Google
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                id="resenas-buscar-local"
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
                placeholder="Ej.: Caprichos Campoy"
                style={{ minHeight: 44, flex: '1 1 260px', padding: '0 12px', borderRadius: 10, border: '1px solid var(--cp-line)', fontSize: 14 }}
              />
              <Boton variante="primario" onClick={buscar} cargando={buscando} deshabilitado={consulta.trim().length < 3 || buscando} aria-label="Buscar mi local">
                Buscar mi local
              </Boton>
            </div>
            {candidatos && candidatos.length === 0 && <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>No encontramos locales con ese nombre.</div>}
            {candidatos &&
              candidatos.map((c) => (
                <div key={c.businessId} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', padding: 12, border: '1px solid var(--cp-line)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 700, color: 'var(--cp-navy)' }}>{c.nombre}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--cp-soft)' }}>{c.direccion ?? 'Sin dirección'}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--cp-soft)' }}>
                      {c.rating ?? '-'} de calificación · {c.total ?? 0} reseñas
                    </span>
                  </div>
                  <Boton variante="secundario" onClick={() => setAccion({ tipo: 'negocio', candidato: c })}>
                    Usar este local
                  </Boton>
                </div>
              ))}
          </div>
        )}

        {estado?.negocio && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13.5, color: 'var(--cp-navy)' }}>
              <span>
                <strong>Local:</strong> {estado.negocio.nombre}
              </span>
              <span>
                <strong>Consumo del mes:</strong> {estado.consumo} de {estado.tope}
              </span>
              <span>
                <strong>Última actualización:</strong> {fecha(estado.ultimaActualizacion)}
              </span>
              <span>
                <strong>Guardadas:</strong> {estado.guardadas} · <strong>Visibles:</strong> {estado.visibles} · <strong>Ocultas:</strong> {estado.ocultas}
              </span>
            </div>

            {!estado.claveConfigurada && <div style={{ fontSize: 13, color: 'var(--cp-red, #b3261e)' }}>{MOTIVOS.SIN_CLAVE}</div>}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <Boton variante="secundario" onClick={() => setAccion({ tipo: 'actualizar' })} deshabilitado={!estado.actualizarAhora.disponible} aria-label="Actualizar ahora">
                Actualizar ahora
              </Boton>
              <Boton variante="secundario" onClick={() => setAccion({ tipo: 'carga' })} deshabilitado={!estado.claveConfigurada} aria-label={pocas ? 'Carga inicial' : 'Repetir carga'}>
                {pocas ? 'Carga inicial' : 'Repetir carga'}
              </Boton>
              {motivoActualizar && <span style={{ fontSize: 12.5, color: 'var(--cp-soft)' }}>{motivoActualizar}</span>}
            </div>

            <Link
              to="/admin/resenas"
              style={{ alignSelf: 'flex-start', color: 'var(--cp-rust)', fontWeight: 700, fontSize: 13.5, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
            >
              Ver y elegir reseñas
            </Link>
          </>
        )}
      </CampoConfig>

      <Confirmar
        abierto={accion !== null}
        titulo={
          accion?.tipo === 'negocio'
            ? 'Usar este local'
            : accion?.tipo === 'actualizar'
              ? 'Actualizar reseñas ahora'
              : accion?.tipo === 'carga'
                ? pocas
                  ? 'Cargar reseñas'
                  : 'Repetir la carga de reseñas'
                : ''
        }
        mensaje={
          accion?.tipo === 'negocio'
            ? `Se guardará ${accion.candidato.nombre} como tu local. Esta elección se hace una sola vez.`
            : accion?.tipo === 'actualizar'
              ? 'Se consulta Google una vez (una unidad del consumo del mes). Trae las reseñas más nuevas.'
              : accion?.tipo === 'carga'
                ? `Se consultarán varias páginas de Google (una unidad cada una) hasta juntar el máximo de reseñas buenas configurado.${pocas ? '' : ' Esto puede sumar varias unidades del consumo del mes.'}`
                : ''
        }
        textoSi="Sí, confirmar"
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={ejecutar}
        alCancelar={() => setAccion(null)}
      />
    </div>
  );
}

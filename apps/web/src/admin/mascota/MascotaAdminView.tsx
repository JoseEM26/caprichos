import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { api } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { Confirmar } from '../../comun/Confirmar';
import { Boton } from '../../comun/Boton';
import {
  MascotaCapri,
  ESTADOS_CAPRI,
  type EstadoCapri,
  type AspectoCapri,
  type ConfiguracionMascota,
  type TemaMascota,
  type ModoMascota,
  type EstiloCabello,
  type TipoGorro,
  type TipoAccesorio,
  type TipoPrenda,
  type RespuestaAdminMascota,
  CONFIGURACION_DEFECTO,
  PALETA_PIEL_SUGERIDA,
  PALETA_OJOS_SUGERIDA,
  ESCALA_MINIMA,
  ESCALA_MAXIMA,
  ESTILOS_CABELLO,
  TIPOS_GORRO,
  TIPOS_PRENDA,
  TIPOS_ACCESORIOS,
  resolverAspecto,
  fusionarAspecto,
  limpiarCacheAspecto,
  preestablecerAspectoCache,
  extraerConfiguracion,
  sanitizarConfiguracion,
  sanitizarEscala,
} from '../../mascota';

/** Tamaños rápidos de Capri en la carta. */
const ESCALAS_RAPIDAS: [string, number][] = [
  ['Chico', 0.8],
  ['Mediano', 1],
  ['Grande', 1.2],
  ['Extra grande', 1.5],
];

const NOMBRES_PRENDAS: Record<TipoPrenda, string> = {
  chaqueta: 'Chaqueta de chef',
  polo: 'Polo',
  mandil: 'Mandil largo',
  pechera: 'Pechera corta',
};

/** Estilo de chip táctil (mínimo 44 px de alto) para las opciones de selección. */
function estiloChip(seleccionado: boolean, colorActivo: string): CSSProperties {
  return {
    minHeight: 44,
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: '0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
    border: '1px solid',
    borderColor: seleccionado ? colorActivo : '#D7DFE3',
    background: seleccionado ? colorActivo : '#FFFFFF',
    color: seleccionado ? '#FFFFFF' : 'var(--cp-navy, #0B2C3E)',
  };
}

const NOMBRES_ESTILOS_CABELLO: Record<EstiloCabello, string> = {
  colitas: 'Colitas',
  suelto: 'Suelto',
  trenza: 'Trenza',
  mono: 'Moño',
  corto: 'Corto',
  rizado: 'Rizado',
  melena: 'Melena',
  coleta: 'Coleta',
};

const NOMBRES_TIPOS_GORRO: Record<TipoGorro, string> = {
  chef: 'Gorro de Chef',
  bruja: 'Gorro de Bruja',
  navideno: 'Gorro Navideño',
  corona: 'Corona Real',
  sombrero: 'Sombrero Veraniego',
  ninguno: 'Sin Gorro',
  gorra: 'Gorra',
  boina: 'Boina',
  beanie: 'Gorro de lana',
  diadema: 'Diadema',
};

const NOMBRES_ACCESORIOS: Record<TipoAccesorio, string> = {
  calabaza: 'Calabaza',
  bufanda: 'Bufanda',
  corazon: 'Corazón',
  bandera: 'Bandera Perú',
  lazo: 'Lazo',
  estrellas: 'Estrellas',
  guirnalda: 'Guirnalda floral',
  antifaz: 'Antifaz',
  bigote: 'Bigote elegante',
  lentes: 'Lentes',
  confeti: 'Confeti',
  flor: 'Flor',
  banda: 'Banda de honor',
  aretes: 'Aretes',
  mochila: 'Mochila',
  medalla: 'Medalla',
};

export function MascotaAdminView() {
  const { tiene, usuario } = useSesion();
  const puedeEditar =
    usuario?.rol === 'ADMIN' || tiene('ADMIN') || tiene('mascota/editar');

  const [cargando, setCargando] = useState<boolean>(true);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  // Configuración completa y editable
  const [config, setConfig] = useState<ConfiguracionMascota>(CONFIGURACION_DEFECTO);

  // Estado de vista previa (izquierda)
  const [estadoMascota, setEstadoMascota] = useState<EstadoCapri>('reposo');
  const [forzar2D, setForzar2D] = useState<boolean>(false);
  const [temaPreviaSeleccionado, setTemaPreviaSeleccionado] = useState<string | null>(null);

  // Pestaña activa en el editor (derecha)
  const [pestana, setPestana] = useState<'base' | 'temporadas'>('base');

  // Modales de confirmación
  const [modalGuardarAbierto, setModalGuardarAbierto] = useState<boolean>(false);
  const [modalRestablecerAbierto, setModalRestablecerAbierto] = useState<boolean>(false);

  // Cargar configuración desde la API
  useEffect(() => {
    let cancelado = false;
    setCargando(true);

    api
      .get<RespuestaAdminMascota>('/admin/mascota')
      .then((data) => {
        if (!cancelado && data) {
          setConfig(extraerConfiguracion(data));
        }
      })
      .catch(() => {
        // En caso de que el backend esté en desarrollo paralelo, iniciamos con la configuración por defecto
        if (!cancelado) {
          setConfig(CONFIGURACION_DEFECTO);
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  // Aspecto resuelto de hoy en la carta
  const aspectoHoy = useMemo(() => {
    return resolverAspecto(config);
  }, [config]);

  const nombreTemaHoy =
    config.temas.find((t) => t.clave === aspectoHoy.tema)?.nombre ?? aspectoHoy.tema;

  // Aspecto actual en la vista previa. Sin tema elegido se ve la base (lo que se edita):
  // un tema de temporada activo pisa el gorro y haría parecer que el cambio no funciona.
  const aspectoPrevia = useMemo(() => {
    if (temaPreviaSeleccionado && temaPreviaSeleccionado !== 'normal') {
      const tema = config.temas.find((t) => t.clave === temaPreviaSeleccionado);
      if (tema) {
        return fusionarAspecto(config.base, tema.aspecto);
      }
    }
    return config.base;
  }, [config, temaPreviaSeleccionado]);

  const escalaActual = sanitizarEscala(config.escala);

  // Manejadores para editar el aspecto base
  const actualizarBase = (cambios: Partial<AspectoCapri>) => {
    setConfig((prev) => ({
      ...prev,
      base: {
        ...prev.base,
        ...cambios,
      },
    }));
  };

  const actualizarCabello = (color?: string, estilo?: EstiloCabello) => {
    setConfig((prev) => ({
      ...prev,
      base: {
        ...prev.base,
        cabello: {
          color: color ?? prev.base.cabello.color,
          estilo: estilo ?? prev.base.cabello.estilo,
        },
      },
    }));
  };

  const actualizarUniforme = (principal?: string, delantal?: string, ribete?: string) => {
    setConfig((prev) => ({
      ...prev,
      base: {
        ...prev.base,
        uniforme: {
          principal: principal ?? prev.base.uniforme.principal,
          delantal: delantal ?? prev.base.uniforme.delantal,
          ribete: ribete ?? prev.base.uniforme.ribete,
        },
      },
    }));
  };

  const actualizarGorro = (tipo?: TipoGorro, color?: string) => {
    setConfig((prev) => ({
      ...prev,
      base: {
        ...prev.base,
        gorro: {
          tipo: tipo ?? prev.base.gorro.tipo,
          color: color ?? prev.base.gorro.color,
        },
      },
    }));
  };

  const toggleAccesorio = (acc: TipoAccesorio) => {
    setConfig((prev) => {
      const actuales = prev.base.accesorios || [];
      const nuevos = actuales.includes(acc)
        ? actuales.filter((a) => a !== acc)
        : [...actuales, acc];
      return {
        ...prev,
        base: {
          ...prev.base,
          accesorios: nuevos,
        },
      };
    });
  };

  // Manejadores para temporadas y modo
  const cambiarModo = (nuevoModo: ModoMascota) => {
    setConfig((prev) => ({
      ...prev,
      modo: nuevoModo,
    }));
  };

  const cambiarTemaManual = (clave: string) => {
    setConfig((prev) => ({
      ...prev,
      temaManual: clave,
    }));
  };

  const actualizarEscala = (valor: number) => {
    setConfig((prev) => ({ ...prev, escala: sanitizarEscala(valor) }));
  };

  const actualizarPrenda = (prenda: TipoPrenda) => {
    setConfig((prev) => ({
      ...prev,
      base: { ...prev.base, uniforme: { ...prev.base.uniforme, prenda } },
    }));
  };

  const actualizarTema = (indice: number, cambios: Partial<TemaMascota>) => {
    setConfig((prev) => {
      const nuevaLista = [...prev.temas];
      nuevaLista[indice] = {
        ...nuevaLista[indice],
        ...cambios,
      };
      return {
        ...prev,
        temas: nuevaLista,
      };
    });
  };

  // Guardar en el servidor: se envía la configuración saneada y solo se confirma si el API responde.
  const ejecutarGuardado = async () => {
    setGuardando(true);
    setMensajeExito(null);
    setMensajeError(null);
    const limpia = sanitizarConfiguracion(config);
    try {
      await api.put('/admin/mascota', limpia);
      limpiarCacheAspecto();
      preestablecerAspectoCache({
        tema: aspectoHoy.tema,
        aspecto: aspectoHoy.aspecto,
        escala: limpia.escala,
      });
      setMensajeExito('Configuración de la mascota Capri guardada correctamente.');
    } catch {
      setMensajeError(
        'No se pudo guardar la configuración de Capri. Tus cambios siguen en pantalla; inténtalo de nuevo.'
      );
    } finally {
      setGuardando(false);
      setModalGuardarAbierto(false);
    }
  };

  // Restablecer de fábrica
  const ejecutarRestablecer = async () => {
    setGuardando(true);
    setMensajeExito(null);
    setMensajeError(null);
    try {
      await api.post('/admin/mascota/restablecer', {});
      setConfig(CONFIGURACION_DEFECTO);
      limpiarCacheAspecto();
      setTemaPreviaSeleccionado(null);
      setMensajeExito('Valores de fábrica restablecidos correctamente.');
    } catch {
      setMensajeError('No se pudo restablecer Capri. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
      setModalRestablecerAbierto(false);
    }
  };

  if (cargando) {
    return <Cargando mensaje="Cargando configuración de Capri..." />;
  }

  return (
    <div
      style={{
        maxWidth: 1300,
        margin: '0 auto',
        padding: '24px 20px',
        fontFamily: 'Montserrat, sans-serif',
        color: 'var(--cp-navy, #0B2C3E)',
      }}
    >
      {/* 1. Encabezado principal */}
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontSize: '1.65rem',
            fontWeight: 800,
            margin: '0 0 6px 0',
            color: 'var(--cp-navy, #0B2C3E)',
          }}
        >
          Mascota Capri
        </h1>
        <p style={{ margin: 0, fontSize: '0.92rem', color: '#556975' }}>
          Personaliza la apariencia, uniformes, accesorios y temas de temporada de Capri. Todos los cambios se reflejan automáticamente en la carta pública y en el asistente virtual.
        </p>
      </div>

      {/* 2. Banner de estado actual en la carta */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 18px',
          background: 'var(--cp-cream, #FBF4EC)',
          borderRadius: 12,
          border: '1px solid #E8DACB',
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>
            Así se ve hoy en la carta:
          </span>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 20,
              fontSize: '0.82rem',
              fontWeight: 700,
              background: aspectoHoy.tema === 'normal' ? '#E9ECEF' : 'var(--cp-orange, #E67929)',
              color: aspectoHoy.tema === 'normal' ? 'var(--cp-navy, #0B2C3E)' : '#FFFFFF',
            }}
          >
            Tema: {aspectoHoy.tema.toUpperCase()}
          </span>
          <span style={{ fontSize: '0.82rem', color: '#6A7B85' }}>
            Modo: {config.modo === 'AUTOMATICO' ? 'Automático por fecha' : 'Manual forzado'}
          </span>
        </div>

        {!puedeEditar && (
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'var(--cp-rust, #B2500F)',
              background: '#FDF1E8',
              padding: '4px 10px',
              borderRadius: 6,
            }}
          >
            Modo solo lectura (se requiere permiso mascota/editar)
          </span>
        )}
      </div>

      {/* 3. Mensaje de éxito si se guardó */}
      {mensajeExito && (
        <div
          role="status"
          style={{
            padding: '12px 16px',
            marginBottom: 20,
            background: '#EAF7EE',
            border: '1px solid #2F7A45',
            borderRadius: 8,
            color: '#1B5E20',
            fontWeight: 600,
            fontSize: '0.88rem',
          }}
        >
          {mensajeExito}
        </div>
      )}

      {mensajeError && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            marginBottom: 20,
            background: '#FDECEA',
            border: '1px solid #C5221F',
            borderRadius: 8,
            color: '#8E1B17',
            fontWeight: 600,
            fontSize: '0.88rem',
          }}
        >
          {mensajeError}
        </div>
      )}

      {/* 4. Contenedor de dos columnas: Vista previa (izq) y Editor (der) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 420px) 1fr',
          gap: 28,
          alignItems: 'start',
        }}
      >
        {/* COLUMNA IZQUIERDA: VISTA PREVIA */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 16,
            border: '1px solid #E4E8EB',
            padding: 20,
            boxShadow: '0 4px 16px rgba(11, 44, 62, 0.04)',
            position: 'sticky',
            top: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: '1.05rem',
                fontWeight: 700,
                color: 'var(--cp-navy, #0B2C3E)',
              }}
            >
              Vista Previa
            </h2>

            {/* Conmutador 3D / 2D */}
            <div
              style={{
                display: 'inline-flex',
                background: '#F1F4F6',
                borderRadius: 8,
                padding: 2,
              }}
            >
              <button
                type="button"
                onClick={() => setForzar2D(false)}
                style={{
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: !forzar2D ? '#FFFFFF' : 'transparent',
                  color: !forzar2D ? 'var(--cp-navy, #0B2C3E)' : '#76848D',
                  boxShadow: !forzar2D ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                3D Interactivo
              </button>
              <button
                type="button"
                onClick={() => setForzar2D(true)}
                style={{
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: forzar2D ? '#FFFFFF' : 'transparent',
                  color: forzar2D ? 'var(--cp-navy, #0B2C3E)' : '#76848D',
                  boxShadow: forzar2D ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                2D Accesible
              </button>
            </div>
          </div>

          {/* Lienzo de Capri */}
          <div
            style={{
              background: 'linear-gradient(180deg, #FDF9F5 0%, #F5EDE4 100%)',
              borderRadius: 14,
              border: '1px solid #EAE2D8',
              height: 280,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
              marginBottom: 14,
            }}
          >
            <MascotaCapri
              estado={estadoMascota}
              tamano={180}
              escala={escalaActual}
              forzarFallback2D={forzar2D}
              aspecto={aspectoPrevia}
            />

            {/* Insignia de tema visto */}
            {temaPreviaSeleccionado && (
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  background: 'rgba(11, 44, 62, 0.85)',
                  color: '#FFFFFF',
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                }}
              >
                Viendo: {temaPreviaSeleccionado}
              </div>
            )}

            {temaPreviaSeleccionado && (
              <button
                type="button"
                onClick={() => setTemaPreviaSeleccionado(null)}
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  background: '#FFFFFF',
                  border: '1px solid #D1D5DB',
                  color: 'var(--cp-navy, #0B2C3E)',
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Volver a la base
              </button>
            )}
          </div>

          {/* Tamaño de Capri en la carta (escala 70% - 150%) */}
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="admin-mascota-escala"
              style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 6 }}
            >
              Tamaño en la carta: {Math.round(escalaActual * 100)}%
            </label>
            <input
              id="admin-mascota-escala"
              type="range"
              aria-label="Tamaño de Capri"
              min={ESCALA_MINIMA}
              max={ESCALA_MAXIMA}
              step={0.05}
              value={escalaActual}
              disabled={!puedeEditar}
              onChange={(e) => actualizarEscala(Number(e.target.value))}
              style={{ width: '100%', minHeight: 44, cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {ESCALAS_RAPIDAS.map(([nombre, valor]) => {
                const seleccionado = Math.abs(escalaActual - valor) < 0.001;
                return (
                  <button
                    key={nombre}
                    type="button"
                    aria-pressed={seleccionado}
                    disabled={!puedeEditar}
                    onClick={() => actualizarEscala(valor)}
                    style={estiloChip(seleccionado, 'var(--cp-navy, #0B2C3E)')}
                  >
                    {nombre}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Botones de estados */}
          <div style={{ marginBottom: 16 }}>
            <span
              style={{
                display: 'block',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#657782',
                marginBottom: 8,
              }}
            >
              Probar animación / estado:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ESTADOS_CAPRI.map((est) => {
                const activo = estadoMascota === est;
                return (
                  <button
                    key={est}
                    type="button"
                    onClick={() => setEstadoMascota(est)}
                    style={{
                      border: '1px solid',
                      borderColor: activo ? 'var(--cp-navy, #0B2C3E)' : '#D7DFE3',
                      background: activo ? 'var(--cp-navy, #0B2C3E)' : '#FFFFFF',
                      color: activo ? '#FFFFFF' : 'var(--cp-navy, #0B2C3E)',
                      padding: '4px 10px',
                      borderRadius: 16,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {est}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: EDITOR */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 16,
            border: '1px solid #E4E8EB',
            padding: 24,
            boxShadow: '0 4px 16px rgba(11, 44, 62, 0.04)',
          }}
        >
          {/* Navegación por pestañas */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              borderBottom: '2px solid #EFF2F5',
              paddingBottom: 12,
              marginBottom: 20,
            }}
          >
            <button
              type="button"
              onClick={() => setPestana('base')}
              style={{
                border: 'none',
                background: 'transparent',
                padding: '8px 16px',
                fontSize: '0.92rem',
                fontWeight: 800,
                cursor: 'pointer',
                color: pestana === 'base' ? 'var(--cp-orange, #E67929)' : '#7C8C96',
                borderBottom: pestana === 'base' ? '3px solid var(--cp-orange, #E67929)' : '3px solid transparent',
                marginBottom: -14,
                transition: 'all 0.15s ease',
              }}
            >
              Aspecto Base
            </button>
            <button
              type="button"
              onClick={() => setPestana('temporadas')}
              style={{
                border: 'none',
                background: 'transparent',
                padding: '8px 16px',
                fontSize: '0.92rem',
                fontWeight: 800,
                cursor: 'pointer',
                color: pestana === 'temporadas' ? 'var(--cp-orange, #E67929)' : '#7C8C96',
                borderBottom: pestana === 'temporadas' ? '3px solid var(--cp-orange, #E67929)' : '3px solid transparent',
                marginBottom: -14,
                transition: 'all 0.15s ease',
              }}
            >
              Temporadas y Modo
            </button>
          </div>

          {/* CONTENIDO PESTAÑA 1: ASPECTO BASE */}
          {pestana === 'base' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* 1. PIEL */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                >
                  Tono de Piel
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {PALETA_PIEL_SUGERIDA.map((tono) => {
                    const esSeleccionado = config.base.piel.toUpperCase() === tono.toUpperCase();
                    return (
                      <button
                        key={tono}
                        type="button"
                        aria-label={`Tono de piel ${tono}`}
                        onClick={() => actualizarBase({ piel: tono })}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          background: tono,
                          border: esSeleccionado ? '3px solid var(--cp-navy, #0B2C3E)' : '1px solid #CFD8DC',
                          boxShadow: esSeleccionado ? '0 0 0 2px var(--cp-gold, #D99E39)' : 'none',
                          cursor: 'pointer',
                        }}
                      />
                    );
                  })}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                    <input
                      type="color"
                      aria-label="Selector libre de color de piel"
                      value={config.base.piel}
                      onChange={(e) => actualizarBase({ piel: e.target.value })}
                      style={{ width: 36, height: 36, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 6 }}
                    />
                    <input
                      type="text"
                      aria-label="Código hexadecimal de color de piel"
                      value={config.base.piel}
                      onChange={(e) => actualizarBase({ piel: e.target.value })}
                      style={{
                        width: 90,
                        padding: '6px 8px',
                        border: '1px solid #D5DDE2',
                        borderRadius: 6,
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 2. CABELLO */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                >
                  Cabello
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '0.82rem', color: '#6A7B85' }}>Color:</span>
                    <input
                      type="color"
                      aria-label="Selector de color de cabello"
                      value={config.base.cabello.color}
                      onChange={(e) => actualizarCabello(e.target.value, undefined)}
                      style={{ width: 34, height: 34, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 6 }}
                    />
                    <input
                      type="text"
                      aria-label="Código de color de cabello"
                      value={config.base.cabello.color}
                      onChange={(e) => actualizarCabello(e.target.value, undefined)}
                      style={{
                        width: 90,
                        padding: '6px 8px',
                        border: '1px solid #D5DDE2',
                        borderRadius: 6,
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>

                  <div>
                    <span style={{ display: 'block', fontSize: '0.82rem', color: '#6A7B85', marginBottom: 6 }}>
                      Estilo:
                    </span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {ESTILOS_CABELLO.map((est) => {
                        const seleccionado = config.base.cabello.estilo === est;
                        return (
                          <button
                            key={est}
                            type="button"
                            onClick={() => actualizarCabello(undefined, est)}
                            aria-pressed={seleccionado}
                            style={{
                              minHeight: 44,
                              padding: '10px 14px',
                              borderRadius: 8,
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              border: '1px solid',
                              borderColor: seleccionado ? 'var(--cp-navy, #0B2C3E)' : '#D7DFE3',
                              background: seleccionado ? 'var(--cp-navy, #0B2C3E)' : '#FFFFFF',
                              color: seleccionado ? '#FFFFFF' : 'var(--cp-navy, #0B2C3E)',
                            }}
                          >
                            {NOMBRES_ESTILOS_CABELLO[est]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. OJOS */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                >
                  Color de Ojos
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {PALETA_OJOS_SUGERIDA.map((tono) => {
                    const seleccionado = config.base.ojos.toUpperCase() === tono.toUpperCase();
                    return (
                      <button
                        key={tono}
                        type="button"
                        aria-label={`Color de ojos ${tono}`}
                        aria-pressed={seleccionado}
                        onClick={() => actualizarBase({ ojos: tono })}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          background: tono,
                          border: seleccionado ? '3px solid var(--cp-navy, #0B2C3E)' : '1px solid #CFD8DC',
                          boxShadow: seleccionado ? '0 0 0 2px var(--cp-gold, #D99E39)' : 'none',
                          cursor: 'pointer',
                        }}
                      />
                    );
                  })}
                  <input
                    type="color"
                    aria-label="Selector de color de ojos"
                    value={config.base.ojos}
                    onChange={(e) => actualizarBase({ ojos: e.target.value })}
                    style={{ width: 34, height: 34, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 6 }}
                  />
                  <input
                    type="text"
                    aria-label="Código de color de ojos"
                    value={config.base.ojos}
                    onChange={(e) => actualizarBase({ ojos: e.target.value })}
                    style={{
                      width: 90,
                      padding: '6px 8px',
                      border: '1px solid #D5DDE2',
                      borderRadius: 6,
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              </div>

              {/* 4. UNIFORME */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                >
                  Uniforme
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 14,
                    background: '#F9FBFC',
                    padding: 14,
                    borderRadius: 10,
                    border: '1px solid #E8ECEE',
                  }}
                >
                  <div>
                    <span style={{ display: 'block', fontSize: '0.78rem', color: '#6A7B85', marginBottom: 4 }}>
                      Color Principal:
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="color"
                        aria-label="Color principal del uniforme"
                        value={config.base.uniforme.principal}
                        onChange={(e) => actualizarUniforme(e.target.value, undefined, undefined)}
                        style={{ width: 32, height: 32, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 6 }}
                      />
                      <input
                        type="text"
                        value={config.base.uniforme.principal}
                        onChange={(e) => actualizarUniforme(e.target.value, undefined, undefined)}
                        style={{ width: 85, padding: '4px 6px', border: '1px solid #D0D8DC', borderRadius: 6, fontFamily: 'monospace', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>

                  <div>
                    <span style={{ display: 'block', fontSize: '0.78rem', color: '#6A7B85', marginBottom: 4 }}>
                      Delantal:
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="color"
                        aria-label="Color del delantal"
                        value={config.base.uniforme.delantal}
                        onChange={(e) => actualizarUniforme(undefined, e.target.value, undefined)}
                        style={{ width: 32, height: 32, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 6 }}
                      />
                      <input
                        type="text"
                        value={config.base.uniforme.delantal}
                        onChange={(e) => actualizarUniforme(undefined, e.target.value, undefined)}
                        style={{ width: 85, padding: '4px 6px', border: '1px solid #D0D8DC', borderRadius: 6, fontFamily: 'monospace', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>

                  <div>
                    <span style={{ display: 'block', fontSize: '0.78rem', color: '#6A7B85', marginBottom: 4 }}>
                      Ribete / Botones:
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="color"
                        aria-label="Color de ribete y botones"
                        value={config.base.uniforme.ribete}
                        onChange={(e) => actualizarUniforme(undefined, undefined, e.target.value)}
                        style={{ width: 32, height: 32, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 6 }}
                      />
                      <input
                        type="text"
                        value={config.base.uniforme.ribete}
                        onChange={(e) => actualizarUniforme(undefined, undefined, e.target.value)}
                        style={{ width: 85, padding: '4px 6px', border: '1px solid #D0D8DC', borderRadius: 6, fontFamily: 'monospace', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 4b. PRENDA */}
              <div>
                <span style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, marginBottom: 8 }}>
                  Prenda
                </span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TIPOS_PRENDA.map((pr) => {
                    const seleccionado = (config.base.uniforme.prenda ?? 'chaqueta') === pr;
                    return (
                      <button
                        key={pr}
                        type="button"
                        aria-pressed={seleccionado}
                        onClick={() => actualizarPrenda(pr)}
                        style={estiloChip(seleccionado, 'var(--cp-navy, #0B2C3E)')}
                      >
                        {NOMBRES_PRENDAS[pr]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. GORRO */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                >
                  Gorro
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {TIPOS_GORRO.map((tg) => {
                      const sel = config.base.gorro.tipo === tg;
                      return (
                        <button
                          key={tg}
                          type="button"
                          onClick={() => actualizarGorro(tg, undefined)}
                          aria-pressed={sel}
                          style={{
                            minHeight: 44,
                            padding: '10px 14px',
                            borderRadius: 8,
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: '1px solid',
                            borderColor: sel ? 'var(--cp-navy, #0B2C3E)' : '#D7DFE3',
                            background: sel ? 'var(--cp-navy, #0B2C3E)' : '#FFFFFF',
                            color: sel ? '#FFFFFF' : 'var(--cp-navy, #0B2C3E)',
                          }}
                        >
                          {NOMBRES_TIPOS_GORRO[tg]}
                        </button>
                      );
                    })}
                  </div>

                  {config.base.gorro.tipo !== 'ninguno' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.82rem', color: '#6A7B85' }}>Color del gorro:</span>
                      <input
                        type="color"
                        aria-label="Color del gorro"
                        value={config.base.gorro.color}
                        onChange={(e) => actualizarGorro(undefined, e.target.value)}
                        style={{ width: 32, height: 32, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 6 }}
                      />
                      <input
                        type="text"
                        aria-label="Código de color del gorro"
                        value={config.base.gorro.color}
                        onChange={(e) => actualizarGorro(undefined, e.target.value)}
                        style={{ width: 85, padding: '4px 6px', border: '1px solid #D0D8DC', borderRadius: 6, fontFamily: 'monospace', fontSize: '0.8rem' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {aspectoHoy.tema !== 'normal' &&
                aspectoHoy.aspecto.gorro.tipo !== config.base.gorro.tipo && (
                  <p
                    role="note"
                    style={{
                      margin: 0,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: '#FEF8F3',
                      border: '1px solid #E9C9A8',
                      fontSize: '0.82rem',
                      color: '#6A4A2A',
                    }}
                  >
                    Hoy aplica el tema {nombreTemaHoy}, que usa {NOMBRES_TIPOS_GORRO[aspectoHoy.aspecto.gorro.tipo]}.
                    En la carta de hoy se ve ese gorro; el que eliges aquí rige fuera de ese tema.
                  </p>
                )}

              {/* 6. ACCESORIOS */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                >
                  Accesorios
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TIPOS_ACCESORIOS.map((acc) => {
                    const activo = (config.base.accesorios || []).includes(acc);
                    return (
                      <button
                        key={acc}
                        type="button"
                        onClick={() => toggleAccesorio(acc)}
                        aria-pressed={activo}
                        style={{
                          minHeight: 44,
                          padding: '10px 14px',
                          borderRadius: 20,
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: '1px solid',
                          borderColor: activo ? 'var(--cp-orange, #E67929)' : '#D7DFE3',
                          background: activo ? 'var(--cp-orange, #E67929)' : '#FFFFFF',
                          color: activo ? '#FFFFFF' : 'var(--cp-navy, #0B2C3E)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {NOMBRES_ACCESORIOS[acc]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* CONTENIDO PESTAÑA 2: TEMPORADAS Y MODO */}
          {pestana === 'temporadas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Modo de selección */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                }}
              >
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    marginBottom: 10,
                  }}
                >
                  Modo de visualización
                </label>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="modo-mascota"
                      checked={config.modo === 'AUTOMATICO'}
                      onChange={() => cambiarModo('AUTOMATICO')}
                    />
                    Automático por fecha (aplica el tema según el calendario de Lima)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                    <input
                      type="radio"
                      name="modo-mascota"
                      checked={config.modo === 'MANUAL'}
                      onChange={() => cambiarModo('MANUAL')}
                    />
                    Manual forzado
                  </label>
                </div>

                {config.modo === 'MANUAL' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Tema manual a mostrar:</span>
                    <select
                      aria-label="Seleccionar tema manual"
                      value={config.temaManual || 'normal'}
                      onChange={(e) => cambiarTemaManual(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                      }}
                    >
                      <option value="normal">Normal (diseño base sin temporada)</option>
                      {config.temas.map((t) => (
                        <option key={t.clave} value={t.clave}>
                          {t.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Lista de temas de temporada */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    marginBottom: 10,
                  }}
                >
                  Temas de Temporada
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {config.temas.map((tema, idx) => {
                    const esTemaActivoHoy = aspectoHoy.tema === tema.clave;
                    const estaViendoEsteTema = temaPreviaSeleccionado === tema.clave;

                    return (
                      <div
                        key={tema.clave}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 12,
                          padding: '12px 16px',
                          borderRadius: 10,
                          border: esTemaActivoHoy ? '2px solid var(--cp-orange, #E67929)' : '1px solid #E2E8F0',
                          background: estaViendoEsteTema ? '#FEF8F3' : '#FFFFFF',
                        }}
                      >
                        <div style={{ minWidth: 160 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                              {tema.nombre}
                            </span>
                            {esTemaActivoHoy && (
                              <span
                                style={{
                                  background: 'var(--cp-orange, #E67929)',
                                  color: '#FFFFFF',
                                  fontSize: '0.7rem',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  fontWeight: 800,
                                }}
                              >
                                ACTIVO HOY
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                            Clave: {tema.clave}
                          </span>
                        </div>

                        {/* Rango de fechas editable */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
                          <span style={{ color: '#64748B' }}>Desde:</span>
                          <input
                            type="text"
                            aria-label={`Fecha desde para ${tema.nombre}`}
                            value={tema.desde}
                            placeholder="MM-DD"
                            maxLength={5}
                            onChange={(e) => actualizarTema(idx, { desde: e.target.value })}
                            style={{
                              width: 60,
                              padding: '4px 6px',
                              textAlign: 'center',
                              borderRadius: 4,
                              border: '1px solid #CBD5E1',
                              fontFamily: 'monospace',
                            }}
                          />
                          <span style={{ color: '#64748B' }}>Hasta:</span>
                          <input
                            type="text"
                            aria-label={`Fecha hasta para ${tema.nombre}`}
                            value={tema.hasta}
                            placeholder="MM-DD"
                            maxLength={5}
                            onChange={(e) => actualizarTema(idx, { hasta: e.target.value })}
                            style={{
                              width: 60,
                              padding: '4px 6px',
                              textAlign: 'center',
                              borderRadius: 4,
                              border: '1px solid #CBD5E1',
                              fontFamily: 'monospace',
                            }}
                          />
                        </div>

                        {/* Switch activo y botón para probar en vista previa */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={tema.activo}
                              onChange={(e) => actualizarTema(idx, { activo: e.target.checked })}
                            />
                            Activo
                          </label>

                          <button
                            type="button"
                            onClick={() => setTemaPreviaSeleccionado(tema.clave)}
                            style={{
                              border: '1px solid #D0D7DE',
                              background: estaViendoEsteTema ? 'var(--cp-navy, #0B2C3E)' : '#FFFFFF',
                              color: estaViendoEsteTema ? '#FFFFFF' : 'var(--cp-navy, #0B2C3E)',
                              padding: '5px 10px',
                              borderRadius: 6,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {estaViendoEsteTema ? 'Viendo' : 'Ver este tema'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 5. Barra inferior de acciones */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: 32,
              paddingTop: 18,
              borderTop: '1px solid #EFF2F5',
            }}
          >
            <Boton
              type="button"
              variante="secundario"
              disabled={!puedeEditar || guardando}
              onClick={() => setModalRestablecerAbierto(true)}
            >
              Restablecer de fábrica
            </Boton>

            <Boton
              type="button"
              variante="primario"
              cargando={guardando}
              disabled={!puedeEditar || guardando}
              onClick={() => setModalGuardarAbierto(true)}
            >
              Guardar cambios
            </Boton>
          </div>
        </div>
      </div>

      {/* Modal de confirmación: Guardar */}
      <Confirmar
        abierto={modalGuardarAbierto}
        titulo="¿Guardar cambios en la mascota Capri?"
        mensaje="La nueva configuración de vestimenta, colores y temporadas se aplicará inmediatamente a la carta pública y al asistente de ayuda."
        textoSi="Sí, guardar"
        textoNo="No, seguir editando"
        cargando={guardando}
        alConfirmar={ejecutarGuardado}
        alCancelar={() => setModalGuardarAbierto(false)}
      />

      {/* Modal de confirmación: Restablecer */}
      <Confirmar
        abierto={modalRestablecerAbierto}
        titulo="¿Restablecer Capri a los valores de fábrica?"
        mensaje="Se restaurará el uniforme original de Caprichos (naranja con delantal negro, gorro de chef crema y fechas de temporada predeterminadas)."
        textoSi="Sí, restablecer"
        textoNo="No, mantener cambios"
        peligro={true}
        cargando={guardando}
        alConfirmar={ejecutarRestablecer}
        alCancelar={() => setModalRestablecerAbierto(false)}
      />
    </div>
  );
}

export default MascotaAdminView;

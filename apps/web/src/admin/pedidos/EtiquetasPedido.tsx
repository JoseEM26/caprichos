import React, { useCallback, useEffect, useState } from 'react';
import { Pedido } from './pedidosApi';
import {
  armarEtiquetas,
  EtiquetaGeneralDatos,
  EtiquetaAreaDatos,
  EtiquetaBebidaDatos,
} from './etiquetasPedido';
import { Confirmar } from '../../comun/Confirmar';
import { impresionApi, EtiquetaEstado, EstadoEtiquetasPedido, EstadoEtiqueta } from '../impresion/impresionApi';

export interface EtiquetasPedidoProps {
  pedido: Pedido;
  onReimprimir?: (tipo: 'general' | 'area' | 'bebida') => void;
}

const AYUDA_REIMPRIMIR =
  'Envía una copia a la cola de impresión de la etiquetera de caja.';

/**
 * Separador elegante de línea continua con 3 rombos al centro
 */
function SeparadorRombos() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        margin: '2px 0',
        gap: 3,
        width: '100%',
      }}
    >
      <div style={{ flex: 1, height: 1.5, background: '#000000' }} />
      <span
        style={{
          fontSize: 7,
          letterSpacing: 2,
          lineHeight: 1,
          color: '#000000',
          userSelect: 'none',
        }}
      >
        ◆◆◆
      </span>
      <div style={{ flex: 1, height: 1.5, background: '#000000' }} />
    </div>
  );
}

/**
 * Contenedor del marco doble físico con esquinas redondeadas y proporción 63.5 : 101.6
 */
function MarcoEtiqueta({
  children,
  pieIzquierda,
  pieDerecha,
}: {
  children: React.ReactNode;
  pieIzquierda: string;
  pieDerecha: string;
}) {
  return (
    <div
      data-testid="etiqueta-marco"
      style={{
        width: 230,
        maxWidth: '100%',
        aspectRatio: '63.5 / 101.6',
        boxSizing: 'border-box',
        background: '#FFFFFF',
        color: '#000000',
        fontFamily: '"Liberation Sans", Arial, Helvetica, sans-serif',
        border: '2.5px solid #000000',
        borderRadius: 14,
        padding: 3,
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          border: '1.5px solid #000000',
          borderRadius: 10,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
          boxSizing: 'border-box',
          background: '#FFFFFF',
        }}
      >
        {/* Cuerpo y cabecera */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {children}
        </div>

        {/* Pie de etiqueta */}
        <div
          style={{
            borderTop: '1.5px solid #000000',
            padding: '3px 8px 4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 9.5,
            fontWeight: 700,
            color: '#000000',
            background: '#FFFFFF',
            lineHeight: '12px',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pieIzquierda}
          </span>
          <span style={{ flexShrink: 0, paddingLeft: 4 }}>{pieDerecha}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Cabecera negra con el logo en círculo blanco y títulos
 */
function CabeceraEtiqueta({
  titulo,
  subtitulo,
}: {
  titulo: string;
  subtitulo: string;
}) {
  return (
    <div
      style={{
        background: '#000000',
        color: '#FFFFFF',
        padding: '5px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          minWidth: 32,
          borderRadius: '50%',
          background: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <img
          src="/logo.webp"
          alt="Caprichos"
          style={{
            width: 28,
            height: 28,
            objectFit: 'cover',
            filter: 'grayscale(100%) contrast(150%)',
          }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.15 }}>
        <span
          style={{
            fontFamily: 'Montserrat, "Liberation Sans", Arial, sans-serif',
            fontSize: 16,
            fontWeight: 900,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#FFFFFF',
          }}
        >
          {titulo}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#E0E0E0',
          }}
        >
          {subtitulo}
        </span>
      </div>
    </div>
  );
}

/**
 * Nombre para la etiqueta general y de área (se ajusta según longitud)
 */
function NombreCliente({ nombre }: { nombre: string }) {
  const n = (nombre || 'Cliente').trim().toUpperCase();
  let fontSize = 18;
  if (n.length > 22) fontSize = 13;
  else if (n.length > 14) fontSize = 15;

  return (
    <div
      style={{
        fontWeight: 900,
        fontSize,
        lineHeight: 1.1,
        textAlign: 'center',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        margin: '2px 0',
      }}
    >
      {n}
    </div>
  );
}

/**
 * Nombre gigante protagonista para la etiqueta por bebida
 */
function NombreProtagonista({ nombre }: { nombre: string }) {
  const n = (nombre || 'Cliente').trim().toUpperCase();
  let fontSize = 34;
  if (n.length > 18) fontSize = 16;
  else if (n.length > 12) fontSize = 21;
  else if (n.length > 7) fontSize = 26;

  return (
    <div
      data-testid="nombre-protagonista"
      style={{
        fontWeight: 900,
        fontSize,
        lineHeight: 1.05,
        textAlign: 'center',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        letterSpacing: '-0.02em',
        margin: '2px 0',
      }}
    >
      {n}
    </div>
  );
}

/**
 * 1. Etiqueta General del Pedido (Sale en la etiquetera de Caja)
 */
export function EtiquetaGeneral({ datos }: { datos: EtiquetaGeneralDatos }) {
  return (
    <MarcoEtiqueta pieIzquierda={`Sale en: ${datos.printer}`} pieDerecha={datos.fecha}>
      <CabeceraEtiqueta titulo="CAPRICHOS" subtitulo="Pedido completo" />
      <div
        style={{
          padding: '6px 8px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 0,
          gap: 2,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: '0.08em',
              textAlign: 'center',
              textTransform: 'uppercase',
            }}
          >
            PEDIDO
          </div>
          <div
            style={{
              fontFamily: 'Montserrat, "Liberation Sans", Arial, sans-serif',
              fontSize: 27,
              fontWeight: 900,
              lineHeight: 1,
              textAlign: 'center',
            }}
          >
            {datos.codigo}
          </div>
        </div>

        <SeparadorRombos />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10.5, fontWeight: 700 }}>
            {datos.canal} - {datos.hora}
          </span>
          <span
            style={{
              background: '#000000',
              color: '#FFFFFF',
              borderRadius: 9999,
              padding: '2px 8px',
              fontSize: 10.5,
              fontWeight: 800,
            }}
          >
            {datos.modalidadPill}
          </span>
        </div>

        <NombreCliente nombre={datos.who} />

        <SeparadorRombos />

        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              textAlign: 'center',
              textTransform: 'uppercase',
              marginBottom: 3,
            }}
          >
            {datos.cantidadProductos} PRODUCTO{datos.cantidadProductos === 1 ? '' : 'S'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {datos.productos.slice(0, 5).map((p, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: 1.2,
                }}
              >
                <span style={{ fontSize: 7 }}>●</span>
                <span>
                  {p.cantidad} x {p.nombre}
                  {p.tamano ? ` ${p.tamano}` : ''}
                </span>
              </div>
            ))}
            {datos.productos.length > 5 && (
              <div style={{ fontSize: 9.5, color: '#333', fontStyle: 'italic', paddingLeft: 8 }}>
                + {datos.productos.length - 5} producto(s) más
              </div>
            )}
          </div>
        </div>

        {datos.nota && (
          <div
            style={{
              border: '1.5px solid #000000',
              borderRadius: 6,
              padding: '3px 6px',
              fontSize: 10,
              fontWeight: 700,
              lineHeight: 1.2,
              marginTop: 2,
            }}
          >
            <b>NOTA:</b> {datos.nota}
          </div>
        )}
      </div>
    </MarcoEtiqueta>
  );
}

/**
 * 2. Etiqueta por Área (Sale en la etiquetera de cada área: Barra, Cocina, etc.)
 */
export function EtiquetaArea({ datos }: { datos: EtiquetaAreaDatos }) {
  return (
    <MarcoEtiqueta pieIzquierda={`Sale en: ${datos.printer}`} pieDerecha={datos.fecha}>
      <CabeceraEtiqueta
        titulo={datos.areaNombre}
        subtitulo={`Area ${datos.areaIndex} de ${datos.totalAreas}`}
      />
      <div
        style={{
          padding: '6px 8px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 0,
          gap: 2,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              fontFamily: 'Montserrat, "Liberation Sans", Arial, sans-serif',
              fontSize: 16,
              fontWeight: 900,
            }}
          >
            {datos.codigo}
          </span>
          <span
            style={{
              background: '#000000',
              color: '#FFFFFF',
              borderRadius: 9999,
              padding: '2px 8px',
              fontSize: 10.5,
              fontWeight: 800,
            }}
          >
            {datos.modalidadPill}
          </span>
        </div>

        <SeparadorRombos />

        <NombreCliente nombre={datos.who} />

        <div style={{ fontSize: 10.5, fontWeight: 700 }}>
          {datos.canal} - {datos.hora}
        </div>

        <SeparadorRombos />

        {/* Productos del área: se compactan si hay varios productos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: datos.esCompacta ? 4 : 2 }}>
          {datos.lineas.map((linea, idx) => (
            <div key={idx} style={{ lineHeight: 1.2 }}>
              <div style={{ fontWeight: 900, fontSize: 11.5, textTransform: 'uppercase' }}>
                {linea.cantidad} x {linea.nombre}
              </div>
              {datos.esCompacta ? (
                <div style={{ fontSize: 9.5, fontWeight: 600, color: '#222', marginTop: 1 }}>
                  {[linea.tamano, ...linea.opciones].filter(Boolean).join(', ')}
                </div>
              ) : (
                <div style={{ marginTop: 1 }}>
                  {linea.tamano && (
                    <div style={{ fontSize: 10, fontWeight: 700 }}>{linea.tamano}</div>
                  )}
                  {linea.opciones.map((opt, oi) => (
                    <div
                      key={oi}
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 4,
                        fontSize: 9.5,
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ fontSize: 7 }}>●</span>
                      <span>{opt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {datos.nota && (
          <div
            style={{
              border: '1.5px solid #000000',
              borderRadius: 6,
              padding: '3px 6px',
              fontSize: 10,
              fontWeight: 700,
              lineHeight: 1.2,
              marginTop: 2,
            }}
          >
            <b>NOTA:</b> {datos.nota}
          </div>
        )}
      </div>
    </MarcoEtiqueta>
  );
}

/**
 * 3. Etiqueta por Bebida (Una por vaso con el nombre de la persona gigante)
 */
export function EtiquetaBebida({ datos }: { datos: EtiquetaBebidaDatos }) {
  return (
    <MarcoEtiqueta pieIzquierda={datos.who} pieDerecha={datos.hora}>
      <CabeceraEtiqueta titulo="CAPRICHOS" subtitulo="Cafeteria artesanal" />
      <div
        style={{
          padding: '6px 8px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 0,
          gap: 2,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 900 }}>
            BEBIDA {datos.bebidaIndex} de {datos.totalBebidas}
          </span>
          <span
            style={{
              background: '#000000',
              color: '#FFFFFF',
              borderRadius: 9999,
              padding: '2px 8px',
              fontSize: 10.5,
              fontWeight: 800,
            }}
          >
            {datos.codigo}
          </span>
        </div>

        <SeparadorRombos />

        {/* Nombre gigante de la persona (protagonista absoluto) */}
        <NombreProtagonista nombre={datos.persona} />

        <SeparadorRombos />

        {/* Bebida y tamaño */}
        <div>
          <div
            style={{
              fontFamily: 'Montserrat, "Liberation Sans", Arial, sans-serif',
              fontSize: 15,
              fontWeight: 900,
              textTransform: 'uppercase',
              textAlign: 'center',
              lineHeight: 1.15,
            }}
          >
            {datos.bebidaNombre}
          </div>

          {datos.tamano && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 3 }}>
              <span
                style={{
                  background: '#000000',
                  color: '#FFFFFF',
                  borderRadius: 9999,
                  padding: '2px 10px',
                  fontSize: 10.5,
                  fontWeight: 800,
                }}
              >
                {datos.tamano}
              </span>
            </div>
          )}
        </div>

        {/* Opciones con viñetas */}
        {datos.opciones.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '2px 0' }}>
            {datos.opciones.map((opt, oi) => (
              <div
                key={oi}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: 1.2,
                }}
              >
                <span style={{ fontSize: 7 }}>●</span>
                <span>{opt}</span>
              </div>
            ))}
          </div>
        )}

        {/* Recuadro CONTIENE con las opciones elegidas */}
        {datos.contiene && (
          <div
            style={{
              border: '1.5px solid #000000',
              borderRadius: 6,
              padding: '3px 6px',
              fontSize: 9.5,
              lineHeight: '12px',
              marginTop: 2,
            }}
          >
            <div style={{ fontWeight: 900 }}>CONTIENE:</div>
            <div style={{ marginTop: 1, fontWeight: 600 }}>{datos.contiene}</div>
          </div>
        )}
      </div>
    </MarcoEtiqueta>
  );
}

const ESTADO_ETIQUETA_VISUAL: Record<string, { texto: string; color: string; fondo: string }> = {
  EN_COLA: { texto: 'En cola', color: '#8A5A00', fondo: '#FFF1CC' },
  IMPRIMIENDO: { texto: 'Imprimiendo', color: '#0B2C3E', fondo: '#DDEBF3' },
  IMPRESA: { texto: 'Impresa', color: '#2F7A45', fondo: '#E3F2E7' },
  FALLIDA: { texto: 'Fallida', color: '#B2500F', fondo: '#FBE9DF' },
  VENCIDA: { texto: 'Vencida', color: '#4A4A4A', fondo: '#ECECEC' },
  DESCARTADA: { texto: 'Descartada', color: '#4A4A4A', fondo: '#ECECEC' },
  SIN_TRABAJO: { texto: 'Sin trabajo', color: '#4A4A4A', fondo: '#ECECEC' },
  DESCONOCIDO: { texto: 'Estado no disponible', color: '#4A4A4A', fondo: '#ECECEC' },
};

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });

const BOTON_SECUNDARIO: React.CSSProperties = {
  minHeight: 44,
  padding: '0 14px',
  border: '1.5px solid var(--cp-navy, #0B2C3E)',
  borderRadius: 10,
  background: 'transparent',
  color: 'var(--cp-navy, #0B2C3E)',
  fontWeight: 800,
  fontSize: 12,
  cursor: 'pointer',
  opacity: 1,
};

type Accion =
  | { tipo: 'uno'; etiqueta: EtiquetaEstado }
  | { tipo: 'todas' }
  | { tipo: 'grupo'; grupo: 'general' | 'area' | 'bebida' };

const TITULO_GRUPO: Record<'general' | 'area' | 'bebida', string> = {
  general: '¿Reimprimir etiqueta general?',
  area: '¿Reimprimir etiquetas por área?',
  bebida: '¿Reimprimir etiquetas de bebida?',
};

/**
 * Pestaña 'Etiquetas' de PedidoDetalle: una tarjeta por cada sticker del pedido
 * (general, una por área y una por vaso) con su vista previa y su estado real de impresión.
 */
export function EtiquetasPedido({ pedido, onReimprimir }: EtiquetasPedidoProps) {
  const resumen = armarEtiquetas(pedido);
  const pedidoId = String(pedido.id);
  const [estado, setEstado] = useState<EstadoEtiquetasPedido | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setEstado(await impresionApi.obtenerEtiquetasPedido(pedidoId));
      setErrorCarga(null);
    } catch (err: any) {
      setErrorCarga(err?.message || 'No se pudo cargar el estado de impresión');
    }
  }, [pedidoId]);

  useEffect(() => {
    void cargar();
    const cada = setInterval(() => void cargar(), 10000);
    return () => clearInterval(cada);
  }, [cargar]);

  const ejecutarAccion = async () => {
    if (!accion) return;
    setProcesando(true);
    setMensajeExito(null);
    setMensajeError(null);
    try {
      let res: { mensaje?: string } | undefined;
      if (accion.tipo === 'uno') {
        res = await impresionApi.reimprimirEtiqueta(pedidoId, accion.etiqueta.clave);
      } else if (accion.tipo === 'todas') {
        res = await impresionApi.reimprimirTodas(pedidoId);
      } else {
        onReimprimir?.(accion.grupo);
        res = await impresionApi.reimprimirEtiquetas(pedidoId, accion.grupo);
      }
      setMensajeExito(res?.mensaje || 'Etiqueta encolada para reimpresión correctamente');
      setAccion(null);
      await cargar();
    } catch (err: any) {
      setMensajeError(err?.message || 'Error al encolar la reimpresión');
      setAccion(null);
    } finally {
      setProcesando(false);
    }
  };

  const textoAccion = (a: Accion): { titulo: string; mensaje: string } => {
    if (a.tipo === 'uno') {
      return {
        titulo: `¿Reimprimir ${a.etiqueta.titulo.toLowerCase()}?`,
        mensaje: 'Solo esta etiqueta se envía de nuevo a la etiquetera de caja.',
      };
    }
    if (a.tipo === 'todas') {
      return {
        titulo: '¿Reimprimir todas las etiquetas?',
        mensaje: 'Se encolan de nuevo las etiquetas que no estén ya en cola. Las que están en cola no se duplican.',
      };
    }
    return {
      titulo: TITULO_GRUPO[a.grupo],
      mensaje: 'Se encolará una copia de la etiqueta para que el agente local de caja la imprima.',
    };
  };

  const previaDe = (e: EtiquetaEstado) => {
    if (e.tipo === 'ETIQUETA_GENERAL') return <EtiquetaGeneral datos={resumen.general} />;
    if (e.tipo === 'ETIQUETA_AREA') {
      const area = resumen.areas.find((a) => `AREA:${a.areaNombre}` === e.clave);
      return area ? <EtiquetaArea datos={area} /> : null;
    }
    const bebida = resumen.bebidas.find((b) => `BEBIDA:${b.bebidaIndex}` === e.clave);
    return bebida ? <EtiquetaBebida datos={bebida} /> : null;
  };

  const tarjeta = (e: EtiquetaEstado) => {
    const visual = ESTADO_ETIQUETA_VISUAL[e.estado] || ESTADO_ETIQUETA_VISUAL.SIN_TRABAJO;
    const enCola = e.estado === 'EN_COLA' || e.estado === 'IMPRIMIENDO';
    const cuando =
      e.estado === 'IMPRESA' && e.impresoEn
        ? `Impresa a las ${hora(e.impresoEn)}`
        : enCola && e.en
          ? `En cola desde las ${hora(e.en)}`
          : null;
    return (
      <article
        key={e.clave}
        aria-label={`Etiqueta ${e.titulo}`}
        data-clave={e.clave}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 12,
          border: '1px solid var(--cp-sand, #EDE1D1)',
          borderRadius: 12,
          background: '#fff',
          minWidth: 0,
          maxWidth: '100%',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13 }}>{e.titulo}</div>
            {e.detalle && (
              <div style={{ fontSize: 11, color: 'var(--cp-soft, #2C4C5D)' }}>{e.detalle}</div>
            )}
          </div>
          <span
            data-estado={e.estado}
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: visual.color,
              background: visual.fondo,
              padding: '3px 10px',
              borderRadius: 9999,
              whiteSpace: 'nowrap',
            }}
          >
            {visual.texto}
          </span>
        </div>
        {cuando && <div style={{ fontSize: 11, color: 'var(--cp-soft, #2C4C5D)' }}>{cuando}</div>}
        {(e.estado === 'FALLIDA' || e.estado === 'VENCIDA' || e.estado === 'DESCARTADA') && e.error && (
          <div role="note" style={{ fontSize: 12, color: 'var(--cp-rust, #B2500F)', fontWeight: 700 }}>
            {e.error}
          </div>
        )}
        <div style={{ overflowX: 'auto', maxWidth: '100%' }}>{previaDe(e)}</div>
        <div>
          <button
            type="button"
            disabled={enCola}
            title={enCola ? 'Ya está en cola de impresión' : undefined}
            onClick={() => setAccion({ tipo: 'uno', etiqueta: e })}
            style={{ ...BOTON_SECUNDARIO, opacity: enCola ? 0.5 : 1, cursor: enCola ? 'not-allowed' : 'pointer' }}
          >
            Reimprimir
          </button>
        </div>
      </article>
    );
  };

  const seccion = (titulo: string, ayuda: string, items: EtiquetaEstado[], vacio?: string) => (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 14 }}>{titulo}</div>
      <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>{ayuda}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>{vacio}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {items.map(tarjeta)}
        </div>
      )}
    </section>
  );

  // Todas las etiquetas salen de la vista previa (aunque falle la consulta de estado);
  // el estado real de cada una se toma de print_job cuando llega.
  const base: EtiquetaEstado[] = [
    {
      clave: 'GENERAL', tipo: 'ETIQUETA_GENERAL' as const, titulo: 'General del pedido',
      detalle: 'Bolsa o bandeja, etiquetera de caja',
    },
    ...resumen.areas.map((a) => ({
      clave: `AREA:${a.areaNombre}`, tipo: 'ETIQUETA_AREA' as const, titulo: `Área ${a.areaNombre}`,
      detalle: 'Etiqueta de la cocina de esta área',
    })),
    ...resumen.bebidas.map((b) => ({
      clave: `BEBIDA:${b.bebidaIndex}`, tipo: 'ETIQUETA_BEBIDA' as const,
      titulo: `Bebida ${b.bebidaIndex} de ${b.totalBebidas}`,
      detalle: [b.bebidaNombre, b.tamano, b.persona ? `para ${b.persona}` : null].filter(Boolean).join(' · '),
    })),
  ].map((b) => ({
    ...b,
    estado: 'DESCONOCIDO' as EstadoEtiqueta,
    trabajoId: null, intentos: 0, error: null, copia: false, en: null, impresoEn: null,
  }));
  const porClave = new Map((estado?.etiquetas ?? []).map((e) => [e.clave, e]));
  const etiquetas: EtiquetaEstado[] = base.map((b) => porClave.get(b.clave) ?? b);
  const grupo = (prefijo: string) => etiquetas.filter((e) => e.clave.startsWith(prefijo));
  const r = estado?.resumen;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: '100%', minWidth: 0 }}>
      {mensajeExito && (
        <div
          role="status"
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--cp-green, #2F7A45)',
            background: 'var(--cp-sand, #EDE1D1)',
            padding: '10px 14px',
            borderRadius: 8,
            borderLeft: '4px solid var(--cp-green, #2F7A45)',
          }}
        >
          {mensajeExito}
        </div>
      )}
      {mensajeError && (
        <div
          role="alert"
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--cp-rust, #B2500F)',
            background: '#FBE9DF',
            padding: '10px 14px',
            borderRadius: 8,
            borderLeft: '4px solid var(--cp-rust, #B2500F)',
          }}
        >
          {mensajeError}
        </div>
      )}

      {/* Resumen y acción sobre todas */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          background: 'var(--cp-sand, #EDE1D1)',
          padding: '10px 14px',
          borderRadius: 10,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div data-testid="resumen-etiquetas" style={{ fontWeight: 800, fontSize: 13 }}>
            {r
              ? `${r.total} etiquetas: ${r.impresas} impresas, ${r.enCola} en cola, ${r.fallidas} fallidas${r.vencidas > 0 ? `, ${r.vencidas} vencidas` : ''}`
              : errorCarga
                ? 'No se pudo cargar el estado de impresión'
                : 'Cargando el estado de impresión...'}
          </div>
          <div role="note" style={{ fontSize: 12, lineHeight: '17px', color: 'var(--cp-soft, #2C4C5D)' }}>
            {resumen.notaEstado}
          </div>
          <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
            {resumen.totalProductos} producto(s) en este pedido
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAccion({ tipo: 'todas' })}
          disabled={!r || r.total === 0}
          style={{
            ...BOTON_SECUNDARIO,
            background: 'var(--cp-navy, #0B2C3E)',
            color: 'var(--cp-cream, #FBF4EC)',
          }}
        >
          Reimprimir todas
        </button>
      </div>

      {errorCarga && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--cp-rust, #B2500F)', fontWeight: 700 }}>{errorCarga}</span>
          <button type="button" onClick={() => void cargar()} style={BOTON_SECUNDARIO}>
            Reintentar
          </button>
        </div>
      )}

      {seccion(
        '1. Etiqueta general del pedido',
        'Una por pedido, para la bolsa o la bandeja. Sale en la etiquetera de caja.',
        grupo('GENERAL'),
      )}
      {seccion(
        '2. Etiquetas por área',
        'Una por cada área que tiene productos en el pedido. Cada área la imprime en su propia etiquetera.',
        grupo('AREA:'),
        'Este pedido no tiene etiquetas por área.',
      )}
      {seccion(
        '3. Etiqueta por bebida',
        'Una por cada vaso. Primero el nombre de quien la toma, luego la bebida y qué contiene.',
        grupo('BEBIDA:'),
        'Este pedido no tiene bebidas.',
      )}

      {/* Reimpresión por grupo (se conserva): envía todas las de un tipo */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {(
          [
            ['general', 'Reimprimir la general'],
            ['area', 'Reimprimir las de área'],
            ['bebida', 'Reimprimir las de bebida'],
          ] as const
        ).map(([grupo, texto]) => (
          <div key={grupo} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
            <button type="button" onClick={() => setAccion({ tipo: 'grupo', grupo })} style={BOTON_SECUNDARIO}>
              {texto}
            </button>
            <span style={{ fontSize: 11, color: 'var(--cp-soft, #2C4C5D)', lineHeight: '15px' }}>{AYUDA_REIMPRIMIR}</span>
          </div>
        ))}
      </div>

      {/* Modal de confirmación Sí/No */}
      {accion !== null && (
        <Confirmar
          abierto
          titulo={textoAccion(accion).titulo}
          mensaje={textoAccion(accion).mensaje}
          textoSi="Sí, reimprimir"
          textoNo="No, cancelar"
          cargando={procesando}
          alConfirmar={ejecutarAccion}
          alCancelar={() => setAccion(null)}
        />
      )}
    </div>
  );
}

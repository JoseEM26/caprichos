import React from 'react';
import { Pedido } from './pedidosApi';
import {
  armarEtiquetas,
  EtiquetaGeneralDatos,
  EtiquetaAreaDatos,
  EtiquetaBebidaDatos,
} from './etiquetasPedido';

export interface EtiquetasPedidoProps {
  pedido: Pedido;
  onReimprimir?: (tipo: 'general' | 'area' | 'bebida') => void;
}

const AYUDA_HONESTA_REIMPRIMIR =
  'La impresión automática llega en la próxima etapa. Esta es la vista previa de lo que saldrá';

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

/**
 * Componente principal de la pestaña 'Etiquetas' en PedidoDetalle
 */
export function EtiquetasPedido({ pedido, onReimprimir }: EtiquetasPedidoProps) {
  const resumen = armarEtiquetas(pedido);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: '100%' }}>
      {/* Estado y nota explicativa */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          role="note"
          style={{
            fontSize: 12,
            lineHeight: '17px',
            color: 'var(--cp-soft, #2C4C5D)',
            background: 'var(--cp-sand, #EDE1D1)',
            padding: '8px 12px',
            borderRadius: 8,
          }}
        >
          {resumen.notaEstado}
        </div>
        <div style={{ fontWeight: 800, fontSize: 13, marginTop: 4 }}>
          {resumen.totalProductos} producto(s) en este pedido
        </div>
      </div>

      {/* 1. Etiqueta General */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 14 }}>
          1. Etiqueta general del pedido
        </div>
        <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
          Una por pedido, para la bolsa o la bandeja. Sale en la etiquetera de caja.
        </div>

        <div>
          <EtiquetaGeneral datos={resumen.general} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          <button
            type="button"
            disabled={!onReimprimir}
            onClick={() => onReimprimir?.('general')}
            style={{
              minHeight: 44,
              padding: '0 14px',
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              borderRadius: 10,
              background: 'transparent',
              color: 'var(--cp-navy, #0B2C3E)',
              fontWeight: 800,
              fontSize: 12,
              cursor: onReimprimir ? 'pointer' : 'not-allowed',
              opacity: onReimprimir ? 1 : 0.6,
            }}
          >
            Reimprimir la general
          </button>
          <span style={{ fontSize: 11, color: 'var(--cp-soft, #2C4C5D)', lineHeight: '15px' }}>
            {AYUDA_HONESTA_REIMPRIMIR}
          </span>
        </div>
      </section>

      {/* 2. Etiquetas por Área */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 14 }}>
          2. Etiquetas por área
        </div>
        <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
          Una por cada área que tiene productos en el pedido. Cada área la imprime en su propia etiquetera.
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {resumen.areas.map((a, idx) => (
            <EtiquetaArea key={idx} datos={a} />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          <button
            type="button"
            disabled={!onReimprimir}
            onClick={() => onReimprimir?.('area')}
            style={{
              minHeight: 44,
              padding: '0 14px',
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              borderRadius: 10,
              background: 'transparent',
              color: 'var(--cp-navy, #0B2C3E)',
              fontWeight: 800,
              fontSize: 12,
              cursor: onReimprimir ? 'pointer' : 'not-allowed',
              opacity: onReimprimir ? 1 : 0.6,
            }}
          >
            Reimprimir las de área
          </button>
          <span style={{ fontSize: 11, color: 'var(--cp-soft, #2C4C5D)', lineHeight: '15px' }}>
            {AYUDA_HONESTA_REIMPRIMIR}
          </span>
        </div>
      </section>

      {/* 3. Etiqueta por Bebida */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 14 }}>
          3. Etiqueta por bebida
        </div>
        <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
          Una por cada vaso. Primero el nombre de quien la toma (acta 03), luego la bebida y qué contiene.
        </div>

        {resumen.bebidas.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
            Este pedido no tiene bebidas.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {resumen.bebidasVisibles.map((b, idx) => (
                <EtiquetaBebida key={idx} datos={b} />
              ))}
            </div>
            {resumen.bebidasRestantes > 0 && (
              <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)', marginTop: 2 }}>
                y {resumen.bebidasRestantes} más del mismo estilo
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          <button
            type="button"
            disabled={!onReimprimir}
            onClick={() => onReimprimir?.('bebida')}
            style={{
              minHeight: 44,
              padding: '0 14px',
              border: '1.5px solid var(--cp-navy, #0B2C3E)',
              borderRadius: 10,
              background: 'transparent',
              color: 'var(--cp-navy, #0B2C3E)',
              fontWeight: 800,
              fontSize: 12,
              cursor: onReimprimir ? 'pointer' : 'not-allowed',
              opacity: onReimprimir ? 1 : 0.6,
            }}
          >
            Reimprimir las de bebida
          </button>
          <span style={{ fontSize: 11, color: 'var(--cp-soft, #2C4C5D)', lineHeight: '15px' }}>
            {AYUDA_HONESTA_REIMPRIMIR}
          </span>
        </div>
      </section>
    </div>
  );
}

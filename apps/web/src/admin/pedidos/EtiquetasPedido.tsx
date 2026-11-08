import React, { useCallback, useEffect, useState } from 'react';
import { Pedido } from './pedidosApi';
import {
  armarEtiquetas,
  armarTicketPago,
} from './etiquetasPedido';
import { Confirmar } from '../../comun/Confirmar';
import { EtiquetaGeneral, EtiquetaArea, EtiquetaBebida, TicketPagoPrevia } from './EtiquetaPrevia';
import { impresionApi, EtiquetaEstado, EstadoEtiquetasPedido, EstadoEtiqueta } from '../impresion/impresionApi';

export interface EtiquetasPedidoProps {
  pedido: Pedido;
  onReimprimir?: (tipo: 'general' | 'area' | 'bebida') => void;
}

const AYUDA_REIMPRIMIR =
  'Envía una copia a la cola de impresión de la etiquetera de caja.';


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
    if (e.tipo === 'ETIQUETA_GENERAL') return <EtiquetaGeneral datos={resumen.general} tamano={estado?.tamanos?.general} />;
    if (e.tipo === 'ETIQUETA_AREA') {
      const area = resumen.areas.find((a) => `AREA:${a.areaNombre}` === e.clave);
      return area ? <EtiquetaArea datos={area} /> : null;
    }
    const bebida = resumen.bebidas.find((b) => `BEBIDA:${b.bebidaIndex}` === e.clave);
    return bebida ? <EtiquetaBebida datos={bebida} tamano={estado?.tamanos?.bebida} /> : null;
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
  // El sticker general solo existe para llevar, recoger y delivery: en mesa no se ofrece ni se puede reimprimir.
  // La API dice cuáles aplican; mientras carga, se decide por la modalidad del pedido.
  const esLlevar = ['DELIVERY', 'RECOGER', 'LLEVAR', 'COMER_LOCAL'].includes(String(pedido.modalidad || '').toUpperCase());
  const llevaGeneral = estado ? estado.etiquetas.some((e) => e.clave === 'GENERAL') : esLlevar;
  const base: EtiquetaEstado[] = [
    ...(llevaGeneral
      ? [{
          clave: 'GENERAL', tipo: 'ETIQUETA_GENERAL' as const, titulo: 'General del pedido',
          detalle: 'Bolsa o bandeja, etiquetera de caja',
        }]
      : []),
    ...(esLlevar ? resumen.areas : []).map((a) => ({
      clave: `AREA:${a.areaNombre}`, tipo: 'ETIQUETA_AREA' as const, titulo: `Área ${a.areaNombre}`,
      detalle: 'Etiqueta de la cocina de esta área',
    })),
    ...(esLlevar ? resumen.bebidas : []).map((b) => ({
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

      {llevaGeneral ? (
        seccion(
          '1. Etiqueta general del pedido',
          'Una por pedido, para la bolsa o la bandeja. Sale en la etiquetera de caja.',
          grupo('GENERAL'),
        )
      ) : (
        <div role="note" data-testid="sin-general" style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
          Este pedido es en el local: no lleva ninguna etiqueta (los stickers solo salen para llevar, recoger y delivery). El voucher sale por la ticketera.
        </div>
      )}
      {seccion(
        '2. Etiquetas por área',
        'Una por cada área con productos en el pedido, salvo Bebidas (sus vasos ya tienen su etiqueta en la sección 3). Cada área la imprime en su propia etiquetera.',
        grupo('AREA:'),
        'Este pedido no tiene etiquetas por área.',
      )}
      {seccion(
        '3. Etiqueta por bebida',
        'Una por cada vaso. Primero el nombre de quien la toma, luego la bebida y qué contiene.',
        grupo('BEBIDA:'),
        'Este pedido no tiene bebidas.',
      )}

      <TicketPagoPrevia datos={armarTicketPago(pedido)} />

      {/* Reimpresión por grupo (se conserva): envía todas las de un tipo */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {(
          [
            ['general', 'Reimprimir la general'],
            ['area', 'Reimprimir las de área'],
            ['bebida', 'Reimprimir las de bebida'],
          ] as const
        ).filter(([grupo]) => grupo !== 'general' || llevaGeneral).map(([grupo, texto]) => (
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

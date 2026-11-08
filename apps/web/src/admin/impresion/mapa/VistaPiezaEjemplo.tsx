import { useMemo } from 'react';
import {
  lineasTicketComandaSalon,
  type EtiquetaAreaDatos,
  type EtiquetaBebidaDatos,
  type EtiquetaGeneralDatos,
  type TicketComandaSalonDatos,
  type TicketPagoDatos,
} from '@caprichos/compartido';
import { EtiquetaArea, EtiquetaBebida, EtiquetaGeneral, TicketPagoPrevia } from '../../pedidos/EtiquetaPrevia';
import type { ClavePieza } from './flujo';

/**
 * Datos de ejemplo para dibujar cada pieza con el MISMO renderizador que usa Pedidos (EtiquetaPrevia)
 * y la misma maqueta de @caprichos/compartido. No son pedidos reales: por eso la vista se marca EJEMPLO.
 */
const FECHA = '05/11/2026';
const GENERAL: EtiquetaGeneralDatos = {
  codigo: 'A-1024',
  modalidad: 'LLEVAR',
  modalidadPill: 'PARA LLEVAR',
  who: 'CLIENTE EJEMPLO',
  canal: 'WEB',
  hora: '12:40',
  fecha: FECHA,
  cantidadProductos: 3,
  productos: [
    { cantidad: 1, nombre: 'Sándwich de pollo' },
    { cantidad: 2, nombre: 'Limonada', tamano: 'Grande' },
  ],
  nota: null,
  total: 38.5,
  printer: 'PC Caja',
};
const AREA: EtiquetaAreaDatos = {
  areaNombre: 'SALADOS',
  areaIndex: 1,
  totalAreas: 2,
  codigo: 'A-1024',
  modalidadPill: 'PARA LLEVAR',
  who: 'CLIENTE EJEMPLO',
  canal: 'WEB',
  hora: '12:40',
  fecha: FECHA,
  lineas: [{ cantidad: 1, nombre: 'Sándwich de pollo', tamano: null, opciones: ['Sin cebolla'], nota: null }],
  esCompacta: false,
  nota: null,
  printer: 'Etiquetera cocina',
};
const BEBIDA: EtiquetaBebidaDatos = {
  bebidaIndex: 1,
  totalBebidas: 2,
  codigo: 'A-1024',
  persona: 'CLIENTE EJEMPLO',
  bebidaNombre: 'Limonada',
  tamano: 'Grande',
  opciones: ['Sin azúcar'],
  contiene: null,
  who: 'CLIENTE EJEMPLO',
  hora: '12:40',
};
const COMANDA_AREA: TicketComandaSalonDatos = {
  tipo: 'TICKET_COMANDA_AREA',
  codigo: 'A-1024',
  mesa: 'Mesa 4',
  area: 'SALADOS',
  cliente: 'CLIENTE EJEMPLO',
  canal: 'MESA',
  hora: '12:40',
  fecha: FECHA,
  lineas: [{ cantidad: 1, nombre: 'Sándwich de pollo', tamano: null, opciones: ['Sin cebolla'], nota: null }],
  nota: null,
};
const COMANDA: TicketComandaSalonDatos = {
  codigo: 'A-1024',
  mesa: 'Mesa 4',
  cliente: 'CLIENTE EJEMPLO',
  canal: 'MESA',
  hora: '12:40',
  fecha: FECHA,
  lineas: [{ cantidad: 2, nombre: 'Café latte', tamano: 'Grande', opciones: ['Sin azúcar'], nota: null }],
  nota: null,
};
const PAGO: TicketPagoDatos = {
  local: { nombre: 'CAPRICHOS' },
  codigo: 'A-1024',
  fecha: FECHA,
  hora: '12:40',
  who: 'CLIENTE EJEMPLO',
  modalidad: 'LLEVAR',
  lineas: [
    { cantidad: 1, nombre: 'Sándwich de pollo', subtotal: 18.5 },
    { cantidad: 2, nombre: 'Limonada', tamano: 'Grande', subtotal: 20 },
  ],
  total: 38.5,
  pagos: [{ medio: 'EFECTIVO', monto: 38.5 }],
};

/** Comanda de salón en texto monoespaciado (58 mm = 32 columnas), como la imprime la ticketera. */
function ComandaEjemplo({ datos }: { datos: TicketComandaSalonDatos }) {
  const lineas = useMemo(() => lineasTicketComandaSalon(datos, 32), [datos]);
  return (
    <pre
      data-testid="comanda-ejemplo"
      style={{
        margin: 0,
        display: 'inline-block',
        padding: '12px 10px',
        background: '#fff',
        color: '#000',
        border: '1px solid #d8d8d8',
        fontFamily: "'DejaVu Sans Mono','Liberation Mono',Menlo,Consolas,monospace",
        fontSize: 12,
        lineHeight: '16px',
        width: '32ch',
        boxSizing: 'content-box',
        maxWidth: '100%',
        overflowX: 'auto',
      }}
    >
      {lineas.map((l, i) => {
        const pad = l.centrado ? ' '.repeat(Math.max(0, Math.floor((32 - l.texto.length) / 2))) : '';
        return (
          <div key={i} style={{ fontWeight: l.negrita ? 800 : 400, whiteSpace: 'pre' }}>
            {pad + l.texto || ' '}
          </div>
        );
      })}
    </pre>
  );
}

/** Vista previa grande de la pieza, marcada EJEMPLO. */
export function VistaPieza({ clave }: { clave: ClavePieza }) {
  return (
    <figure className="mapa-vista" data-clave={clave}>
      <figcaption className="mapa-vista-etiqueta">EJEMPLO</figcaption>
      {clave === 'BEBIDA' && <EtiquetaBebida datos={BEBIDA} />}
      {clave === 'RESUMEN' && <EtiquetaGeneral datos={GENERAL} />}
      {clave === 'AREA' && <EtiquetaArea datos={AREA} />}
      {clave === 'COMANDA' && <ComandaEjemplo datos={COMANDA} />}
      {clave === 'COMANDA_AREA' && <ComandaEjemplo datos={COMANDA_AREA} />}
      {clave === 'PAGO' && <TicketPagoPrevia datos={PAGO} sinCabecera />}
    </figure>
  );
}

/** Datos de ejemplo para la vista previa por PC (mismos del Mapa). */
export { GENERAL as MUESTRA_GENERAL, BEBIDA as MUESTRA_BEBIDA };

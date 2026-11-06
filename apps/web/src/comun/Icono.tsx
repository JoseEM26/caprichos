import type { SVGProps } from 'react';

export const TRAZOS_ICONOS: Record<string, string> = {
  // Módulos del mockup
  disenador: 'M3 3h18v18H3z M3 9h18 M9 21V9',
  destacadas:
    'M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z',
  novedades:
    'M4 11v3a1 1 0 0 0 1 1h2l5 4V6L7 10H5a1 1 0 0 0-1 1z M16 9a4 4 0 0 1 0 6 M19 6a8 8 0 0 1 0 12',
  mascota:
    'M12 2a5 5 0 0 0-4.9 4A4 4 0 0 0 4 10a4 4 0 0 0 3 3.9V16h10v-2.1A4 4 0 0 0 20 10a4 4 0 0 0-3.1-4A5 5 0 0 0 12 2z M7 18h10v2H7z',
  paleta:
    'M12 22a10 10 0 1 1 10-10c0 3-2 4-4 4h-2a2 2 0 0 0-1 3.7c.7.7.3 2.3-3 2.3z M7.5 10.5h.01 M12 7.5h.01 M16.5 10.5h.01',
  mapa: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.800-7 11-7 11z M12 12a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5z',
  listas:
    'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  mensajes:
    'M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.2A8.4 8.4 0 1 1 21 11.5z M9 9.5c0 3 2.5 5.5 5.5 5.5l1.3-1.6-2-1-.8.8c-1-.4-1.9-1.300-2.300-2.300l.8-.8-1-2z',
  escritorio:
    'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
  caja: 'M2 5h20v14H2z M2 10h20',
  cocina:
    'M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
  repartos:
    'M1 3h15v13H1z M16 8h4l3 3v5h-7z M5.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M18.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  reservas: 'M3 4h18v18H3z M16 2v4 M8 2v4 M3 10h18',
  clientes:
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  creditos:
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8',
  productos:
    'M18 8h1a4 4 0 0 1 0 8h-1 M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z M6 1v3 M10 1v3 M14 1v3',
  ofertas:
    'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01',
  compras:
    'M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6',
  almacen:
    'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12',
  stock:
    'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
  recetas:
    'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z M8 6h8 M8 10h6',
  informes: 'M18 20V10 M12 20V4 M6 20v-6',
  indicadores: 'M22 12h-4l-3 9L9 3l-3 9H2',
  mirest:
    'M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16',
  pantallas: 'M2 4h20v13H2z M8 21h8 M12 17v4',
  asistencia: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2',
  plano: 'M3 3h18v18H3z M3 9h18 M9 21V9',
  cierre:
    'M2 7h20v14H2z M16 14a2 2 0 1 1-4 0 2 2 0 0 1 4 0z M6 3h12v4H6z',
  propinas: 'M12 2v20 M17 6H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6',
  usuarios:
    'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  historial: 'M3 12a9 9 0 1 0 3-6.7 M3 4v5h5 M12 7v5l3 3',
  iniciativas:
    'M9 18h6 M10 22h4 M12 2a7 7 0 0 0-4 11.7V17h8v-3.3A7 7 0 0 0 12 2z',
  notificaciones:
    'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  salir:
    'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',

  // Símbolos y acciones comunes
  menu: 'M3 12h18 M3 6h18 M3 18h18',
  cerrar: 'M18 6L6 18 M6 6l12 12',
  check: 'M20 6L9 17l-5-5',
  punto: 'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  estrella: 'M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z',
  alerta: 'M12 9v4 M12 17h.01 M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
  reloj: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  flechaDerecha: 'M5 12h14 M12 5l7 7-7 7',
  flechaAbajo: 'M6 9l6 6 6-6',
  chevronDerecha: 'M9 18l6-6-6-6',
  chevronAbajo: 'M6 9l6 6 6-6',
  buscar: 'M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',
  filtro: 'M3 5h18l-7 8v6l-4 2v-8z',
  sonido: 'M11 5L6 9H2v6h4l5 4V5z M19.07 4.93a10 10 0 0 1 0 14.14 M15.54 8.46a5 5 0 0 1 0 7.07',
  silencio: 'M11 5L6 9H2v6h4l5 4V5z M23 9l-6 6 M17 9l6 6',
  imprimir: 'M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z',
  billete: 'M2 6h20v12H2z M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0 M6 9h.01 M18 15h.01',
  seguridad: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  copiar: 'M8 4v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.5L16.5 4H10a2 2 0 0 0-2 2z M4 8v12a2 2 0 0 0 2 2h8',
};

export interface IconoProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  nombre: string;
  tamano?: number;
  strokeWidth?: number;
}

export function Icono({
  nombre,
  tamano = 20,
  strokeWidth = 2,
  style,
  ...resto
}: IconoProps) {
  const trazo = TRAZOS_ICONOS[nombre] || TRAZOS_ICONOS['punto'];

  return (
    <svg
      viewBox="0 0 24 24"
      width={tamano}
      height={tamano}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      }}
      {...resto}
    >
      <path d={trazo} />
    </svg>
  );
}

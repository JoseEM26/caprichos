import { ElegirEnTarjetas, iconos } from './ElegirEnTarjetas';

export type FormaUbicacion = 'gps' | 'mapa' | 'escribir';

const FORMAS = [
  { id: 'gps', nombre: 'Mi ubicación actual', linea: 'Un toque, con el GPS', icono: iconos.gps, etiqueta: 'Usar mi ubicación actual' },
  { id: 'mapa', nombre: 'Marcar en el mapa', linea: 'Pon el pin en tu puerta', icono: iconos.mapa, etiqueta: 'Marcar en el mapa' },
  { id: 'escribir', nombre: 'Escribir la dirección', linea: 'Calle, número y referencia', icono: iconos.escribir, etiqueta: 'Escribir la dirección' },
];

export const tituloForma: Record<FormaUbicacion, string> = {
  gps: 'Tu ubicación actual',
  mapa: 'Marcar en el mapa',
  escribir: 'Escribir la dirección',
};

/** Las tres formas de dar la ubicación, como tarjetas grandes. */
export function TarjetasFormaUbicacion({ alElegir, deshabilitado }: { alElegir: (f: FormaUbicacion) => void; deshabilitado?: boolean }) {
  return <ElegirEnTarjetas titulo="Forma de indicar la ubicación" opciones={FORMAS} deshabilitado={deshabilitado} alElegir={(id) => alElegir(id as FormaUbicacion)} />;
}

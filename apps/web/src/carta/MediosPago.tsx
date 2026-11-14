import { ElegirEnTarjetas, iconos, type OpcionTarjeta } from './ElegirEnTarjetas';
import type { MetodoPago } from './tipos';

/** Lista de medios como datos: otras ramas (medios activables, Culqi) añaden aquí sin tocar la grilla. */
export const MEDIOS_PAGO: (OpcionTarjeta & { id: MetodoPago })[] = [
  { id: 'YAPE', nombre: 'Yape', linea: 'Al toque', icono: iconos.yape },
  { id: 'PLIN', nombre: 'Plin', linea: 'Al toque', icono: iconos.plin },
  { id: 'EFECTIVO', nombre: 'Efectivo', linea: 'Contra entrega', icono: iconos.efectivo },
  { id: 'TARJETA', nombre: 'Tarjeta', linea: 'Débito o crédito al recibir', icono: iconos.tarjeta },
  { id: 'TRANSFERENCIA', nombre: 'Transferencia', linea: 'Desde tu banco', icono: iconos.transferencia },
];

export const nombreMedio = (m: string) => MEDIOS_PAGO.find((x) => x.id === m)?.nombre ?? m;

/** «¿Cómo pagas?»: una tarjeta grande por medio disponible. */
export function TarjetasMedioPago({ medios, seleccionado, alElegir }: { medios: MetodoPago[]; seleccionado: MetodoPago | null; alElegir: (m: MetodoPago) => void }) {
  return (
    <ElegirEnTarjetas
      titulo="¿Cómo pagas?"
      testId="tarjetas-medio-pago"
      opciones={MEDIOS_PAGO.filter((m) => medios.includes(m.id)).map((m) => ({ ...m, etiqueta: m.nombre }))}
      seleccionado={seleccionado}
      alElegir={(id) => alElegir(id as MetodoPago)}
    />
  );
}

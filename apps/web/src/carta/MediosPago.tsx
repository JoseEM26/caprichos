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

/** Tarjeta que abre el pago con 2 o 3 medios. */
const OPCION_DIVIDIDO: OpcionTarjeta = {
  id: 'DIVIDIDO',
  nombre: 'Pagar con 2 o 3 medios',
  linea: 'Divide el pago',
  icono: iconos.dividido,
  etiqueta: 'Pagar con 2 o 3 medios',
};

/** «¿Cómo pagas?»: una tarjeta grande por medio disponible y, con 2 o más medios, la de pago dividido. */
export function TarjetasMedioPago({
  medios,
  seleccionado,
  alElegir,
  alDividir,
}: {
  medios: MetodoPago[];
  seleccionado: MetodoPago | null;
  alElegir: (m: MetodoPago) => void;
  alDividir?: () => void;
}) {
  const opciones: OpcionTarjeta[] = MEDIOS_PAGO.filter((m) => medios.includes(m.id)).map((m) => ({ ...m, etiqueta: m.nombre }));
  if (alDividir && medios.length >= 2) opciones.push(OPCION_DIVIDIDO);
  return (
    <ElegirEnTarjetas
      titulo="¿Cómo pagas?"
      testId="tarjetas-medio-pago"
      opciones={opciones}
      seleccionado={seleccionado}
      alElegir={(id) => (id === 'DIVIDIDO' ? alDividir?.() : alElegir(id as MetodoPago))}
    />
  );
}

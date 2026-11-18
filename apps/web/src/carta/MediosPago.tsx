import { ordenarMediosPresentacion, presentacionDeMedio } from '@caprichos/compartido';
import { ElegirEnTarjetas, iconos, type OpcionTarjeta } from './ElegirEnTarjetas';
import type { MetodoPago } from './tipos';

/** Lista de medios como datos: otras ramas (medios activables, Culqi) añaden aquí sin tocar la grilla. */
export const MEDIOS_PAGO: (OpcionTarjeta & { id: MetodoPago })[] = [
  { id: 'YAPE', nombre: 'Yape', linea: 'Al toque', icono: iconos.yape },
  { id: 'PLIN', nombre: 'Plin', linea: 'Al toque', icono: iconos.plin },
  { id: 'EFECTIVO', nombre: 'Efectivo', linea: 'Contra entrega', icono: iconos.efectivo },
  { id: 'TARJETA', nombre: 'Tarjeta', linea: 'Débito o crédito al recibir', icono: iconos.tarjeta },
  { id: 'TRANSFERENCIA', nombre: 'Transferencia', linea: 'Desde tu banco', icono: iconos.transferencia },
  // Solo la carta la ofrece, y solo si Configuración enciende el pago en línea (Culqi). Orden, tamaño e insignia: Configuración › Pagos
  { id: 'CULQI', nombre: 'Tarjeta / Yape en línea', linea: 'Tu pedido es más rápido: se confirma al instante, sin enviar captura', icono: iconos.tarjeta },
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

/**
 * Opciones de la grilla en el orden, tamaño e insignia configurados (`medios_pago_presentacion`).
 * «Grande» ocupa todo el ancho de la fila; «normal» es tarjeta cuadrada. Una sola función para la carta y la vista previa.
 */
export function opcionesMedioPago(medios: MetodoPago[], presentacion?: unknown): OpcionTarjeta[] {
  return ordenarMediosPresentacion(
    MEDIOS_PAGO.filter((m) => medios.includes(m.id)).map((m) => m.id),
    presentacion,
  ).map((id) => {
    const m = MEDIOS_PAGO.find((x) => x.id === id)!;
    const { tamano, insignia } = presentacionDeMedio(presentacion, id);
    return { ...m, destacada: tamano === 'grande', insignia: insignia ?? undefined, etiqueta: insignia ? `${m.nombre}. ${insignia}` : m.nombre };
  });
}

/** «¿Cómo pagas?»: una tarjeta por medio disponible y, con 2 o más medios, la de pago dividido. */
export function TarjetasMedioPago({
  medios,
  seleccionado,
  alElegir,
  alDividir,
  presentacion,
}: {
  medios: MetodoPago[];
  seleccionado: MetodoPago | null;
  alElegir: (m: MetodoPago) => void;
  alDividir?: () => void;
  /** `medios_pago_presentacion` de la configuración pública; sin ella, valores de fábrica (Culqi al final) */
  presentacion?: unknown;
}) {
  const opciones = opcionesMedioPago(medios, presentacion);
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

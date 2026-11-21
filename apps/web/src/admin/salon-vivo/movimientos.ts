import type { EstadoMesaVivo, PedidoVivo, SalonVivo } from './salonVivoApi';

/** «Últimos movimientos»: frases que salen de comparar dos fotos del salón. No inventa nada, solo cuenta lo que cambió. */
const todos = (d: SalonVivo): PedidoVivo[] => [...d.caja, ...d.cocina, ...d.despacho, ...d.enReparto];
const destino = (p: PedidoVivo) => (p.modalidad === 'MESA' ? p.mesas[0] || 'Mesa' : p.modalidad === 'DELIVERY' ? 'Delivery' : 'Para llevar');
const ocupada = (e?: EstadoMesaVivo) => e === 'ESPERANDO' || e === 'COMIENDO' || e === 'POR_COBRAR';

export function movimientos(antes: SalonVivo | null, ahora: SalonVivo): string[] {
  if (!antes) return [];
  const out: string[] = [];
  const prev = new Map(todos(antes).map((p) => [p.codigo, p]));
  const enCocinaAntes = new Set(antes.cocina.map((p) => p.codigo));
  const despachoAntes = new Set(antes.despacho.map((p) => p.codigo));
  const repartoAntes = new Set(antes.enReparto.map((p) => p.codigo));
  const actuales = new Set(todos(ahora).map((p) => p.codigo));

  for (const p of ahora.cocina) if (!prev.has(p.codigo)) out.push(`${p.codigo} entró a cocina · ${destino(p)}`);
  for (const p of ahora.despacho) if (!despachoAntes.has(p.codigo)) out.push(`${p.codigo} completo en despacho 🔔 · ${destino(p)}`);
  for (const p of ahora.enReparto) if (!repartoAntes.has(p.codigo)) out.push(`Salió el delivery: ${p.codigo} 🛵`);
  for (const p of antes.cocina) if (!actuales.has(p.codigo) && enCocinaAntes.has(p.codigo)) out.push(`${p.codigo} salió de cocina`);
  for (const p of antes.despacho.concat(antes.enReparto)) if (!actuales.has(p.codigo)) out.push(`${p.codigo} entregado · ${destino(p)}`);

  const mesasAntes = new Map(antes.mesas.map((m) => [m.id, m]));
  for (const m of ahora.mesas) {
    const a = mesasAntes.get(m.id);
    if (!a || a.estado === m.estado) continue;
    if (!ocupada(a.estado) && ocupada(m.estado)) out.push(`Llegan clientes a ${m.nombre}`);
    else if (m.estado === 'POR_COBRAR') out.push(`${m.nombre} pide la cuenta 🙋`);
    else if (m.estado === 'COMIENDO') out.push(`${m.nombre} ya tiene su pedido`);
    else if (ocupada(a.estado) && !ocupada(m.estado)) out.push(`${m.nombre} se liberó`);
  }
  return out;
}

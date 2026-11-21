/**
 * Salón en vivo: arma, con función pura, lo que dibuja la vista 3D del panel (plano + estado real).
 * Nunca lleva teléfonos, documentos ni montos: solo nombres de pila, códigos, áreas y minutos.
 */

export type EstadoMesaVivo = 'LIBRE' | 'ESPERANDO' | 'COMIENDO' | 'POR_COBRAR' | 'RESERVADA';

export interface ElementoVivo {
  id: string;
  tipo: string;
  nombre: string | null;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  numero: number | null;
  asientos: number | null;
  activo: boolean;
}

export interface PisoVivo {
  id: string;
  nombre: string;
  cuadriculaAncho: number;
  cuadriculaAlto: number;
  elementos: ElementoVivo[];
}

export interface AreaVivo {
  nombre: string;
  estado: 'PENDIENTE' | 'LISTA';
}

/** Avatar del cliente del pedido: solo retrato y configuración 3D (nunca teléfono ni documento). */
export interface AvatarVivo {
  url: string | null;
  config: object | null;
}

export interface PedidoVivo {
  id: string;
  codigo: string;
  modalidad: string;
  estado: string;
  cliente: string | null;
  mesas: string[];
  /** Ids de las mesas del plano donde está el pedido (para llevárselo) */
  mesaIds: string[];
  minutos: number;
  productos: number;
  items: string[];
  areas: AreaVivo[];
  avatar: AvatarVivo | null;
}

export interface MesaVivo {
  id: string;
  pisoId: string;
  numero: number | null;
  nombre: string;
  asientos: number;
  estado: EstadoMesaVivo;
  pedido: { codigo: string; personas: number | null; minutos: number; areasPendientes: string[]; avatar: AvatarVivo | null } | null;
  reserva: { hora: string; nombre: string; personas: number } | null;
}

export interface ReservaVivo {
  hora: string;
  nombre: string;
  personas: number;
  mesas: string[];
}

export interface SalonVivo {
  generadoEn: string;
  cajaAbierta: boolean;
  pisos: PisoVivo[];
  mesas: MesaVivo[];
  caja: PedidoVivo[];
  cocina: PedidoVivo[];
  despacho: PedidoVivo[];
  enReparto: PedidoVivo[];
  reservas: ReservaVivo[];
  cargaCocina: Array<{ area: string; pendientes: number }>;
  conteos: {
    pedidosHoy: number;
    entregadosHoy: number;
    deliveryEntregadosHoy: number;
    mesasOcupadas: number;
    mesasTotal: number;
    personas: number;
    minutosCocinaPromedio: number | null;
  };
}

/** Pedido del día tal como sale de Prisma (solo lo necesario). */
export interface PedidoDia {
  id: bigint;
  party_id?: bigint | null;
  codigo: string;
  modalidad: string;
  estado: string;
  cliente_nombre: string | null;
  pago_estado: string | null;
  creado_en: Date;
  pasa_cocina_en: Date | null;
  listo_en: Date | null;
  entregado_mesa_en: Date | null;
  entregado_en: Date | null;
  cobro_mozo_en: Date | null;
  despachado_en: Date | null;
  espera_personas: number | null;
  mesas: Array<{ mesaId: bigint | null; nombre: string | null; abierta: boolean }>;
  comandas: Array<{ estado: string; area: { nombre: string } }>;
  lineas: Array<{ nombre: string; cantidad: number }>;
}

export interface ReservaDia {
  id: bigint;
  nombre: string;
  personas: number;
  hora: Date;
  pedido_id: bigint | null;
  mesas: Array<{ mesaId: bigint | null; nombre: string | null }>;
}

export interface EntradaSalonVivo {
  ahora: Date;
  pisos: PisoVivo[];
  pedidos: PedidoDia[];
  reservas: ReservaDia[];
  cajaAbierta: boolean;
  /** Avatares por party_id (clave en texto), cargados con una sola consulta */
  avatares?: Map<string, AvatarVivo>;
}

const nombreDePila = (n: string | null | undefined): string | null => {
  const p = (n ?? '').trim().split(/\s+/)[0];
  return p ? p : null;
};

const minutosDesde = (d: Date | null | undefined, ahora: Date): number =>
  d ? Math.max(0, Math.floor((ahora.getTime() - d.getTime()) / 60000)) : 0;

const horaLima = (d: Date): string =>
  new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' }).format(d);

const avatarDe = (p: PedidoDia, avatares?: Map<string, AvatarVivo>): AvatarVivo | null =>
  (p.party_id != null ? avatares?.get(String(p.party_id)) : undefined) ?? null;

function aPedidoVivo(p: PedidoDia, ahora: Date, avatares?: Map<string, AvatarVivo>): PedidoVivo {
  return {
    id: String(p.id),
    codigo: p.codigo,
    modalidad: p.modalidad,
    estado: p.estado,
    cliente: nombreDePila(p.cliente_nombre),
    mesas: p.mesas.filter((m) => m.abierta).map((m) => m.nombre ?? '').filter(Boolean),
    mesaIds: p.mesas.filter((m) => m.abierta && m.mesaId != null).map((m) => String(m.mesaId)),
    minutos: minutosDesde(p.pasa_cocina_en ?? p.creado_en, ahora),
    productos: p.lineas.reduce((s, l) => s + (l.cantidad || 0), 0),
    items: p.lineas.slice(0, 3).map((l) => l.nombre),
    areas: p.comandas.map((c) => ({ nombre: c.area.nombre, estado: c.estado === 'DESPEJADA' ? 'LISTA' : 'PENDIENTE' })),
    avatar: avatarDe(p, avatares),
  };
}

const esMesa = (p: PedidoDia) => p.modalidad === 'MESA';

/** Mesa servida (el cliente ya come): entregada en mesa o el pedido ya figura entregado. */
const servida = (p: PedidoDia) => !!p.entregado_mesa_en || p.estado === 'ENTREGADO';

export function armarSalonVivo(e: EntradaSalonVivo): SalonVivo {
  const { ahora } = e;
  // Pedidos vivos del día: sin anulados, sin los que aún esperan pago en línea o su día
  const vivos = e.pedidos.filter((p) => !['ANULADO', 'POR_PAGAR', 'PROGRAMADO'].includes(p.estado));

  // Por cobrar: para llevar sin pagar, o mesa ya servida / con cuenta enviada y sin pagar
  const caja = vivos.filter(
    (p) =>
      p.pago_estado === 'PENDIENTE' &&
      (p.modalidad === 'LLEVAR' || (esMesa(p) && (servida(p) || !!p.cobro_mozo_en))),
  );
  const cocina = vivos.filter((p) => ['COLA', 'PREPARANDO'].includes(p.estado));
  const despacho = vivos.filter((p) => p.estado === 'LISTO' && (esMesa(p) ? !p.entregado_mesa_en : true));
  const enReparto = vivos.filter((p) => p.modalidad === 'DELIVERY' && p.estado === 'EN_CAMINO');

  // Mesas
  const pedidoPorMesa = new Map<string, PedidoDia>();
  for (const p of vivos) {
    if (!esMesa(p) || p.estado === 'ENTREGADO' && !p.mesas.some((m) => m.abierta)) continue;
    for (const m of p.mesas) if (m.abierta && m.mesaId != null) pedidoPorMesa.set(String(m.mesaId), p);
  }
  const reservaPorMesa = new Map<string, ReservaDia>();
  const proximas = e.reservas
    .filter((r) => r.hora.getTime() >= ahora.getTime() - 30 * 60000)
    .sort((a, b) => a.hora.getTime() - b.hora.getTime());
  for (const r of proximas) for (const m of r.mesas) if (m.mesaId != null && !reservaPorMesa.has(String(m.mesaId))) reservaPorMesa.set(String(m.mesaId), r);

  const mesas: MesaVivo[] = [];
  for (const piso of e.pisos) {
    for (const el of piso.elementos.filter((x) => x.tipo === 'MESA' && x.activo)) {
      const ped = pedidoPorMesa.get(el.id);
      const res = reservaPorMesa.get(el.id);
      const asientos = el.asientos ?? 4;
      let estado: EstadoMesaVivo = 'LIBRE';
      let pedido: MesaVivo['pedido'] = null;
      if (ped) {
        estado = ped.cobro_mozo_en ? 'POR_COBRAR' : ped.entregado_mesa_en ? 'COMIENDO' : 'ESPERANDO';
        const delaReserva = e.reservas.find((r) => r.pedido_id === ped.id);
        const personas = delaReserva?.personas ?? ped.espera_personas ?? null;
        pedido = {
          codigo: ped.codigo,
          personas: personas && personas > 0 ? Math.min(personas, asientos) : null,
          minutos: minutosDesde(ped.pasa_cocina_en ?? ped.creado_en, ahora),
          areasPendientes: ped.comandas.filter((c) => c.estado !== 'DESPEJADA').map((c) => c.area.nombre),
          avatar: avatarDe(ped, e.avatares),
        };
      } else if (res) {
        estado = 'RESERVADA';
      }
      mesas.push({
        id: el.id,
        pisoId: piso.id,
        numero: el.numero,
        nombre: el.nombre || (el.numero ? `Mesa ${el.numero}` : 'Mesa'),
        asientos,
        estado,
        pedido,
        reserva: res ? { hora: horaLima(res.hora), nombre: nombreDePila(res.nombre) ?? '', personas: res.personas } : null,
      });
    }
  }

  // Carga de cocina por área: comandas aún sin despejar de los pedidos en cocina
  const porArea = new Map<string, number>();
  for (const p of cocina) for (const c of p.comandas) if (c.estado !== 'DESPEJADA') porArea.set(c.area.nombre, (porArea.get(c.area.nombre) ?? 0) + 1);

  const entregados = vivos.filter((p) => p.estado === 'ENTREGADO');
  const tiempos = vivos.filter((p) => p.pasa_cocina_en && p.listo_en).map((p) => Math.max(1, Math.round((p.listo_en!.getTime() - p.pasa_cocina_en!.getTime()) / 60000)));
  const ocupadas = mesas.filter((m) => m.pedido);

  return {
    generadoEn: ahora.toISOString(),
    cajaAbierta: e.cajaAbierta,
    pisos: e.pisos,
    mesas,
    caja: caja.map((p) => aPedidoVivo(p, ahora, e.avatares)),
    cocina: cocina.map((p) => aPedidoVivo(p, ahora, e.avatares)),
    despacho: despacho.map((p) => aPedidoVivo(p, ahora, e.avatares)),
    enReparto: enReparto.map((p) => aPedidoVivo(p, ahora, e.avatares)),
    reservas: proximas.slice(0, 12).map((r) => ({ hora: horaLima(r.hora), nombre: nombreDePila(r.nombre) ?? '', personas: r.personas, mesas: r.mesas.map((m) => m.nombre ?? '').filter(Boolean) })),
    cargaCocina: [...porArea.entries()].map(([area, pendientes]) => ({ area, pendientes })),
    conteos: {
      pedidosHoy: vivos.length,
      entregadosHoy: entregados.length,
      deliveryEntregadosHoy: entregados.filter((p) => p.modalidad === 'DELIVERY').length,
      mesasOcupadas: ocupadas.length,
      mesasTotal: mesas.length,
      personas: ocupadas.reduce((s, m) => s + (m.pedido!.personas ?? Math.min(2, m.asientos)), 0),
      minutosCocinaPromedio: tiempos.length ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : null,
    },
  };
}

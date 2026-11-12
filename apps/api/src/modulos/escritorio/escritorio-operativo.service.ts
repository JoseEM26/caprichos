import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { horaLimaEntera } from '../../comun/fechas-lima';
import { ROLES } from '../acceso/permisos';
import { permisosDeCuenta } from '../acceso/roles-usuario';
import type { UsuarioAutenticado } from '../acceso/acceso.tipos';

/** Estados de pedido que todavía no llegaron al cliente (NUEVO = por confirmar). */
const NO_ENTREGADOS = ['NUEVO', 'COLA', 'PREPARANDO', 'LISTO', 'EN_CAMINO'];
const PROXIMAS_MAX = 5;
/** Meta de cocina: un pedido que lleva más de 13 min en cola o preparación está atrasado (misma meta del escritorio del admin). */
const META_COCINA_MIN = 13;
const STOCK_BAJO_MENOR_QUE = 10;
const ROLES_SOLO_REPARTO = ['REPARTIDOR', 'APOYO_DELIVERY'];

/** Día calendario de Lima (YYYY-MM-DD) de un instante. */
const diaLima = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(d);

/** Hora HH:mm en Lima de un instante. */
const horaLima = (d: Date): string =>
  new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);

const DIAS_SEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const TOPE_CUMPLES = 6;
const TOPE_LISTA_CUMPLES = 100;
const VENTANA_POR_DEFECTO = 60;

const esBisiesto = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export interface Cumple {
  nombre: string;
  rol: string;
  fecha: string;
  enDias: number;
  etiqueta: string;
}

/**
 * Próximos cumpleaños por día y mes (sin año: no se guarda). El 29/02 se celebra el 28/02 en años no bisiestos.
 * `hoy` es el día de Lima (AAAA-MM-DD). Ordena por cercanía y corta por ventana y tope.
 */
export function proximosCumpleanos(
  personas: { nombre: string; rol: string; dia: number; mes: number }[],
  hoy: string,
  dias: number = VENTANA_POR_DEFECTO,
  tope: number = TOPE_CUMPLES,
): Cumple[] {
  const [y, m, d] = hoy.split('-').map(Number);
  const base = Date.UTC(y, m - 1, d);
  const lista: Cumple[] = [];
  for (const p of personas) {
    const ocurre = (anio: number) => Date.UTC(anio, p.mes - 1, p.mes === 2 && p.dia === 29 && !esBisiesto(anio) ? 28 : p.dia);
    let f = ocurre(y);
    if (f < base) f = ocurre(y + 1);
    const enDias = Math.round((f - base) / 86400000);
    if (enDias > dias) continue;
    const fd = new Date(f);
    lista.push({
      nombre: p.nombre,
      rol: p.rol,
      fecha: `${DIAS_SEM[fd.getUTCDay()]} ${fd.getUTCDate()} ${MESES[fd.getUTCMonth()]}`,
      enDias,
      etiqueta: enDias === 0 ? 'Hoy' : enDias === 1 ? 'Mañana' : `en ${enDias} días`,
    });
  }
  return lista.sort((a, b) => a.enDias - b.enDias || a.nombre.localeCompare(b.nombre, 'es')).slice(0, tope);
}

/**
 * Escritorio de TODO el personal que no es ADMIN: solo conteos, horarios y estados, nunca dinero (ventas, cobros, propinas,
 * ticket) ni datos de clientes. Cada bloque se arma SOLO si la persona tiene el permiso del módulo al que pertenece
 * (la unión de sus roles y permisos extra); el servidor no manda lo que el rol no ve.
 */
@Injectable()
export class EscritorioOperativoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Permisos efectivos de la cuenta (unión de roles y extras) y respuesta del escritorio. */
  async mio(usuario: UsuarioAutenticado, ahora: Date = new Date()) {
    const cuenta = await this.prisma.userAccount.findUnique({ where: { party_id: usuario.partyId }, select: { id: true } });
    const roles = usuario.roles ?? [usuario.rol];
    const permisos = cuenta ? await permisosDeCuenta(this.prisma, cuenta.id, roles) : [];
    return this.miEscritorio(new Set(permisos), roles, usuario.partyId, ahora);
  }

  async miEscritorio(permisos: ReadonlySet<string>, roles: string[], partyId: bigint, ahora: Date = new Date()) {
    const puede = (...claves: string[]) => claves.some((c) => permisos.has(c));
    const hoy = diaLima(ahora);
    // Lima no tiene horario de verano: el día empieza a las 05:00 UTC
    const inicioDia = new Date(`${hoy}T00:00:00-05:00`);
    const finDia = new Date(inicioDia.getTime() + 24 * 3600000);
    const soloReparto = roles.every((r) => ROLES_SOLO_REPARTO.includes(r));

    const [pedidos, reparto, stockBajo, operativo] = await Promise.all([
      puede('pedidos/ver', 'cocina/ver') ? this.bloquePedidos(ahora, inicioDia, finDia) : undefined,
      puede('repartos/ver') ? this.bloqueReparto(partyId, soloReparto, inicioDia, finDia) : undefined,
      puede('stock/ver') ? this.bloqueStockBajo() : undefined,
      puede('escritorio/operativo') ? this.bloqueSalon(hoy, ahora, inicioDia, finDia) : undefined,
    ]);

    return { generadoEn: ahora.toISOString(), pedidos, reparto, stockBajo, ...operativo };
  }

  /** Cola por estado, pedidos por hora de hoy y tiempos de cocina. */
  private async bloquePedidos(ahora: Date, inicioDia: Date, finDia: Date) {
    const limite = new Date(ahora.getTime() - META_COCINA_MIN * 60000);
    const [porEstado, deHoy, atrasados] = await Promise.all([
      this.prisma.pedido.groupBy({
        by: ['estado'],
        where: { estado: { in: NO_ENTREGADOS }, es_personal: false },
        _count: { _all: true },
      }),
      this.prisma.pedido.findMany({
        where: { creado_en: { gte: inicioDia, lt: finDia }, es_personal: false, estado: { notIn: ['RECHAZADO', 'ANULADO'] } },
        select: { creado_en: true, pasa_cocina_en: true, listo_en: true },
      }),
      this.prisma.pedido.count({
        where: {
          estado: { in: ['COLA', 'PREPARANDO'] },
          es_personal: false,
          OR: [{ pasa_cocina_en: { lt: limite } }, { pasa_cocina_en: null, creado_en: { lt: limite } }],
        },
      }),
    ]);
    const contar = (estado: string) => porEstado.find((g) => g.estado === estado)?._count._all ?? 0;

    const conteoHora: Record<number, number> = {};
    const minutosCocina: number[] = [];
    for (const p of deHoy) {
      const h = horaLimaEntera(p.creado_en);
      conteoHora[h] = (conteoHora[h] ?? 0) + 1;
      if (p.pasa_cocina_en && p.listo_en) minutosCocina.push(Math.max(1, Math.round((p.listo_en.getTime() - p.pasa_cocina_en.getTime()) / 60000)));
    }
    const horas = Object.keys(conteoHora).map(Number);
    const porHora = horas.length
      ? Array.from({ length: Math.max(...horas) - Math.min(...horas) + 1 }, (_, i) => Math.min(...horas) + i).map((h) => ({ hora: h, pedidos: conteoHora[h] ?? 0 }))
      : [];

    return {
      porConfirmar: contar('NUEVO'),
      enPreparacion: contar('PREPARANDO'),
      enCola: contar('COLA'),
      listos: contar('LISTO'),
      enReparto: contar('EN_CAMINO'),
      noEntregados: NO_ENTREGADOS.reduce((n, e) => n + contar(e), 0),
      atrasados,
      tiempoCocinaMin: minutosCocina.length ? Math.round(minutosCocina.reduce((a, b) => a + b, 0) / minutosCocina.length) : null,
      metaCocinaMin: META_COCINA_MIN,
      porHora,
    };
  }

  /** Reparto: el repartidor que solo es repartidor ve únicamente lo suyo; el resto ve el conjunto. */
  private async bloqueReparto(partyId: bigint, soloMio: boolean, inicioDia: Date, finDia: Date) {
    const mio = soloMio ? { repartidor_party_id: partyId } : {};
    const [disponibles, enCamino, entregadosHoy] = await Promise.all([
      this.prisma.pedido.count({ where: { modalidad: 'DELIVERY', estado: 'LISTO', repartidor_party_id: null, es_personal: false } }),
      this.prisma.pedido.count({ where: { estado: 'EN_CAMINO', es_personal: false, ...mio } }),
      this.prisma.pedido.count({ where: { modalidad: 'DELIVERY', estado: 'ENTREGADO', entregado_en: { gte: inicioDia, lt: finDia }, es_personal: false, ...mio } }),
    ]);
    return { propio: soloMio, disponibles, enCamino, entregadosHoy };
  }

  /** Insumos con poca existencia (mismo criterio del escritorio del admin); apagado con el «Control de almacén». */
  private async bloqueStockBajo() {
    // Interruptor «Control de almacén» (parámetro stock_control_activo = «si»); sin parámetro, apagado
    const control = await this.prisma.parametro.findUnique({ where: { clave: 'stock_control_activo' } });
    const v = control?.valor;
    if (!(v === true || String(v ?? '').toLowerCase().trim() === 'si')) return undefined;
    const donde = { insumo: { activo: true }, cantidad: { lt: STOCK_BAJO_MENOR_QUE } };
    const [cantidad, filas] = await Promise.all([
      this.prisma.stock.count({ where: donde }),
      this.prisma.stock.findMany({ where: donde, select: { insumo: { select: { nombre: true } } }, orderBy: { cantidad: 'asc' }, take: PROXIMAS_MAX }),
    ]);
    return { cantidad, insumos: filas.map((f) => f.insumo?.nombre ?? 'Insumo') };
  }

  /** Reservas, mesas y estado de la caja (supervisor): sin montos. */
  private async bloqueSalon(hoy: string, ahora: Date, inicioDia: Date, finDia: Date) {
    const [reservasHoy, proximas, mesas, mesasOcupadas, caja] = await Promise.all([
      this.prisma.reserva.count({ where: { estado: 'ACTIVA', hora: { gte: inicioDia, lt: finDia } } }),
      this.prisma.reserva.findMany({
        where: { estado: 'ACTIVA', hora: { gte: ahora, lt: finDia } },
        select: { nombre: true, personas: true, hora: true },
        orderBy: { hora: 'asc' },
        take: PROXIMAS_MAX,
      }),
      this.prisma.elementoPlano.count({ where: { tipo: 'MESA', activo: true } }),
      this.prisma.pedidoMesa.findMany({
        where: { abierta: true, mesa_id: { not: null }, mesa: { tipo: 'MESA', activo: true } },
        select: { mesa_id: true },
        distinct: ['mesa_id'],
      }),
      this.prisma.caja.findUnique({ where: { fecha: new Date(`${hoy}T00:00:00Z`) }, select: { estado: true } }),
    ]);
    const ocupadas = mesasOcupadas.length;
    return {
      reservas: { cantidadHoy: reservasHoy, proximas: proximas.map((r) => ({ nombre: r.nombre, personas: r.personas, hora: horaLima(r.hora) })) },
      mesas: { cantidad: mesas, ocupadas, libres: Math.max(0, mesas - ocupadas) },
      caja: { estado: caja ? (caja.estado === 'ABIERTA' ? 'ABIERTA' : 'CERRADA') : 'SIN_ABRIR' },
    };
  }

  /** Cumpleaños del personal activo (solo ADMIN y SUPERVISOR; lo exige el permiso del controlador). Nunca devuelve la fecha completa. */
  async cumpleanos(dias?: number, ahora: Date = new Date()) {
    const ventana = Number.isFinite(dias) && (dias as number) >= 1 ? Math.min(Math.floor(dias as number), 366) : VENTANA_POR_DEFECTO;
    const cuentas = await this.prisma.userAccount.findMany({
      where: { activo: true },
      select: { rol: true, party: { select: { persona: { select: { nombres: true, apellidos: true, cumple_dia: true, cumple_mes: true } } } } },
    });
    const conFecha: { nombre: string; rol: string; dia: number; mes: number }[] = [];
    let sinFecha = 0;
    for (const c of cuentas) {
      const p = c.party?.persona;
      if (!p) continue;
      if (!p.cumple_dia || !p.cumple_mes) {
        sinFecha++;
        continue;
      }
      const nombre = [p.nombres.trim().split(/\s+/)[0], (p.apellidos ?? '').trim().split(/\s+/)[0]].filter(Boolean).join(' ');
      conFecha.push({ nombre, rol: ROLES.find((r) => r.codigo === c.rol)?.nombre ?? c.rol, dia: p.cumple_dia, mes: p.cumple_mes });
    }
    return { ventanaDias: ventana, sinFecha, proximos: proximosCumpleanos(conFecha, diaLima(ahora), ventana, TOPE_LISTA_CUMPLES) };
  }

  /**
   * Cumpleaños de CLIENTES (solo con permiso clientes/ver). Sin edad ni fecha completa; celular enmascarado.
   * «Felicitar» solo se ofrece si ya hay un chat con ventana de 24 h abierta (así no se paga una plantilla de Meta);
   * el celular completo sale únicamente en ese caso y a quien tiene mensajes/ver, para abrir el chat.
   */
  async cumpleanosClientes(usuario: UsuarioAutenticado, dias?: number, ahora: Date = new Date()) {
    const ventana = Number.isFinite(dias) && (dias as number) >= 1 ? Math.min(Math.floor(dias as number), 60) : 31;
    const cuenta = await this.prisma.userAccount.findUnique({ where: { party_id: usuario.partyId }, select: { id: true } });
    const permisos = new Set(cuenta ? await permisosDeCuenta(this.prisma, cuenta.id, usuario.roles ?? [usuario.rol]) : []);
    const puedeChat = permisos.has('mensajes/ver') || (usuario.roles ?? [usuario.rol]).includes('ADMIN');
    const roles = await this.prisma.partyRole.findMany({
      where: { rol: 'CLIENTE', hasta: null, party: { persona: { cumple_dia: { not: null }, cumple_mes: { not: null } } } },
      select: { party: { select: { persona: { select: { nombres: true, apellidos: true, cumple_dia: true, cumple_mes: true } }, cuentaCliente: { select: { telefono: true } } } } },
    });
    const base: { nombre: string; rol: string; dia: number; mes: number }[] = [];
    const celulares: (string | null)[] = [];
    for (const r of roles) {
      const p = r.party.persona;
      if (!p?.cumple_dia || !p.cumple_mes) continue;
      const nombre = [p.nombres.trim().split(/\s+/)[0], (p.apellidos ?? '').trim().split(/\s+/)[0]].filter(Boolean).join(' ');
      base.push({ nombre, rol: String(celulares.length), dia: p.cumple_dia, mes: p.cumple_mes });
      celulares.push(r.party.cuentaCliente?.telefono ?? null);
    }
    const proximos = proximosCumpleanos(base, diaLima(ahora), ventana, TOPE_LISTA_CUMPLES);
    const tels = proximos.map((c) => celulares[Number(c.rol)]).filter((t): t is string => !!t);
    const convs = tels.length
      ? await this.prisma.conversacion.findMany({ where: { telefono: { in: tels.map((t) => `51${t}`) } }, select: { id: true, telefono: true } })
      : [];
    const abiertas = convs.length
      ? await this.prisma.whatsappMensaje.findMany({
          where: { conversacion_id: { in: convs.map((c) => c.id) }, direccion: 'ENTRANTE', creado_en: { gte: new Date(ahora.getTime() - 24 * 3600000) } },
          select: { conversacion_id: true },
          distinct: ['conversacion_id'],
        })
      : [];
    const conVentana = new Set(abiertas.map((m) => m.conversacion_id?.toString()));
    return {
      ventanaDias: ventana,
      proximos: proximos.map((c) => {
        const tel = celulares[Number(c.rol)];
        const conv = tel ? convs.find((v) => v.telefono === `51${tel}`) : undefined;
        const abierta = !!conv && conVentana.has(conv.id.toString());
        return {
          nombre: c.nombre,
          fecha: c.fecha,
          enDias: c.enDias,
          etiqueta: c.etiqueta,
          celular: tel ? `${tel[0]}•• ••• ${tel.slice(-3)}` : null,
          ventanaAbierta: abierta,
          chatCelular: abierta && puedeChat ? tel : null,
        };
      }),
    };
  }
}

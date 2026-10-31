import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Datos de prueba para la pantalla del repartidor (todo mapa): pedidos delivery alrededor de la sede
 * en varios sectores, con estados LISTO (disponibles), COLA/PREPARANDO (en cocina) y COLA con pago
 * digital pendiente (por validar). Además fija rep_max_pedidos = 4 y reparto_rutas_sugeridas_max = 4.
 *
 * SOLO base local de desarrollo: exige DATABASE_URL apuntando a localhost:5442/caprichos.
 * Idempotente: borra los pedidos propios (codigo RP-PRUEBA-* o nota «[prueba-repartos]») y los
 * vuelve a crear. Los clientes se reusan por teléfono ficticio (no se borran).
 *
 * Uso: con DATABASE_URL apuntando a la base local (localhost:5442/caprichos, credenciales del contenedor caprichos-pg-dev), npx tsx prisma/seed-repartos-prueba.ts
 *
 * Coordenadas: aproximadas, calculadas por rumbo y distancia desde la sede (no geocodificadas).
 */

const MARCA = '[prueba-repartos]';
const PREFIJO_CODIGO = 'RP-PRUEBA-';
// Mismo local que usa la carta (CONFIG_ETA_DEFECTO.local); se usa si no hay local_datos ni local_lat/lng.
const SEDE_DEFECTO = { lat: -12.0196436, lng: -76.963255 };
const TIEMPO_PROMETIDO = { eta_min: 20, eta_max: 30 };

type Estado = 'LISTO' | 'PREPARANDO' | 'COLA';

interface CasoPrueba {
  codigo: string;
  nombres: string;
  apellidos: string;
  telefono: string;
  km: number;
  rumbo: number; // grados desde la sede: 0 = norte, 90 = este
  direccion: string;
  referencia: string;
  estado: Estado;
  esperaMin: number;
  pagoMetodo: 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TRANSFERENCIA';
  pagoEstado: 'PENDIENTE' | 'PAGADO';
  pagaCon?: number;
  productos: Array<[nombre: string, cantidad: number]>;
}

const CASOS: CasoPrueba[] = [
  // LISTO: disponibles para reparto (cuatro al norte, dos al este, dos al sur, uno al oeste)
  { codigo: 'RP-PRUEBA-01', nombres: 'María', apellidos: 'Quispe', telefono: '910000001', km: 1.4, rumbo: 8,
    direccion: 'Av. Canto Grande 1520, cuadra 15, San Juan de Lurigancho', referencia: 'Portón celeste, frente al mercado',
    estado: 'LISTO', esperaMin: 5, pagoMetodo: 'EFECTIVO', pagoEstado: 'PENDIENTE', pagaCon: 100,
    productos: [['FRAPPE CAFÉ', 2], ['WAFFLE MANJAR', 1]] },
  { codigo: 'RP-PRUEBA-02', nombres: 'Jorge', apellidos: 'Huamán', telefono: '910000002', km: 2.2, rumbo: 355,
    direccion: 'Jr. Los Cedros 245, Campoy, San Juan de Lurigancho',
    referencia: 'Casa de rejas verdes, al costado de la bodega',
    estado: 'LISTO', esperaMin: 12, pagoMetodo: 'YAPE', pagoEstado: 'PAGADO',
    productos: [['DÚO IRRESISTIBLE', 1], ['ICED COFFE', 2]] },
  { codigo: 'RP-PRUEBA-03', nombres: 'Lucía', apellidos: 'Paredes', telefono: '910000003', km: 3.1, rumbo: 15,
    direccion: 'Av. Las Torres 780, Campoy, San Juan de Lurigancho',
    referencia: 'Edificio beige, 3.er piso, timbre 3B',
    estado: 'LISTO', esperaMin: 20, pagoMetodo: 'PLIN', pagoEstado: 'PAGADO',
    productos: [['CAPUCCINO', 2], ['WAFFLE TROPICAL', 1]] },
  { codigo: 'RP-PRUEBA-04', nombres: 'Carlos', apellidos: 'Mendoza', telefono: '910000004', km: 0.8, rumbo: 12,
    direccion: 'Calle Las Begonias 302, San Juan de Lurigancho',
    referencia: 'Esquina con la bodega Mi Bodega',
    estado: 'LISTO', esperaMin: 30, pagoMetodo: 'EFECTIVO', pagoEstado: 'PENDIENTE', pagaCon: 50,
    productos: [['MOCACCINO', 1], ['WAFFLE BANANA SPLIT', 1]] },
  { codigo: 'RP-PRUEBA-05', nombres: 'Rosa', apellidos: 'Flores', telefono: '910000005', km: 1.6, rumbo: 85,
    direccion: 'Av. Nicolás Ayllón 2140, El Agustino',
    referencia: 'Al frente del colegio, reja negra',
    estado: 'LISTO', esperaMin: 45, pagoMetodo: 'EFECTIVO', pagoEstado: 'PENDIENTE',
    productos: [['LATTE VAINILLA', 2]] },
  { codigo: 'RP-PRUEBA-06', nombres: 'Andrea', apellidos: 'Vásquez', telefono: '910000006', km: 2.4, rumbo: 95,
    direccion: 'Jr. Ayacucho 415, Ate',
    referencia: 'Puerta metálica gris, costado de la farmacia',
    estado: 'LISTO', esperaMin: 8, pagoMetodo: 'YAPE', pagoEstado: 'PAGADO',
    productos: [['FROZEN MARACUYÁ', 1], ['CAFÉ AMERICANO', 1]] },
  { codigo: 'RP-PRUEBA-07', nombres: 'Ricardo', apellidos: 'Tello', telefono: '910000007', km: 1.8, rumbo: 180,
    direccion: 'Av. Próceres de la Independencia 1875, San Juan de Lurigancho',
    referencia: 'Frente al paradero, local con toldo naranja',
    estado: 'LISTO', esperaMin: 52, pagoMetodo: 'YAPE', pagoEstado: 'PAGADO',
    productos: [['DÚO PARA COMPARTIR', 1]] },
  { codigo: 'RP-PRUEBA-08', nombres: 'Silvia', apellidos: 'Ramos', telefono: '910000008', km: 2.6, rumbo: 195,
    direccion: 'Calle Los Geranios 133, Urb. Campoy, San Juan de Lurigancho',
    referencia: 'Casa de dos pisos, portón marrón',
    estado: 'LISTO', esperaMin: 27, pagoMetodo: 'PLIN', pagoEstado: 'PAGADO',
    productos: [['CAPRIBERRY VAINILLA', 2], ['LATTE COFFE', 1]] },
  { codigo: 'RP-PRUEBA-09', nombres: 'Pedro', apellidos: 'Chávez', telefono: '910000009', km: 1.3, rumbo: 265,
    direccion: 'Av. Confraternidad Oeste 980, San Juan de Lurigancho',
    referencia: 'Cerca al colegio, puerta azul, llamar al celular',
    estado: 'LISTO', esperaMin: 38, pagoMetodo: 'EFECTIVO', pagoEstado: 'PENDIENTE', pagaCon: 50,
    productos: [['FRAPPE STRAWBERRY', 1], ['WAFFLE KIWIBERRY', 1]] },
  // PREPARANDO / COLA sin pago digital pendiente: en cocina (salen en gris)
  { codigo: 'RP-PRUEBA-10', nombres: 'Mariela', apellidos: 'Torres', telefono: '910000010', km: 2.8, rumbo: 352,
    direccion: 'Av. Canto Grande 2310, San Juan de Lurigancho',
    referencia: 'Frente al paradero de la 2.da',
    estado: 'PREPARANDO', esperaMin: 15, pagoMetodo: 'EFECTIVO', pagoEstado: 'PENDIENTE', pagaCon: 50,
    productos: [['FRAPPE OREO', 2]] },
  { codigo: 'RP-PRUEBA-11', nombres: 'Julio', apellidos: 'Cárdenas', telefono: '910000011', km: 1.1, rumbo: 170,
    direccion: 'Jr. Los Girasoles 312, Campoy, San Juan de Lurigancho',
    referencia: 'Dos pisos, reja con macetas',
    estado: 'COLA', esperaMin: 10, pagoMetodo: 'EFECTIVO', pagoEstado: 'PENDIENTE',
    productos: [['WAFFLE MANJAR', 2]] },
  { codigo: 'RP-PRUEBA-12', nombres: 'Yesenia', apellidos: 'Ccama', telefono: '910000012', km: 1.9, rumbo: 75,
    direccion: 'Av. Ayacucho 1160, Ate',
    referencia: 'Bodega esquina, letrero amarillo',
    estado: 'PREPARANDO', esperaMin: 22, pagoMetodo: 'YAPE', pagoEstado: 'PAGADO',
    productos: [['FROZEN STRAWBERRY', 1], ['WAFFLE TROPICAL', 1]] },
  { codigo: 'RP-PRUEBA-13', nombres: 'Héctor', apellidos: 'Gamarra', telefono: '910000013', km: 2.0, rumbo: 250,
    direccion: 'Calle Las Dalias 205, San Juan de Lurigancho',
    referencia: 'Segundo portón, pintado de verde',
    estado: 'COLA', esperaMin: 6, pagoMetodo: 'EFECTIVO', pagoEstado: 'PENDIENTE', pagaCon: 50,
    productos: [['CHOCOLATE CALIENTE', 1], ['CAFÉ AMERICANO', 2]] },
  { codigo: 'RP-PRUEBA-14', nombres: 'Fiorella', apellidos: 'Ticona', telefono: '910000014', km: 1.5, rumbo: 315,
    direccion: 'Av. Las Flores 640, Campoy, San Juan de Lurigancho',
    referencia: 'Departamento 302, sin timbre, llamar al celular',
    estado: 'PREPARANDO', esperaMin: 18, pagoMetodo: 'YAPE', pagoEstado: 'PAGADO',
    productos: [['ICED CHOCOLATE', 1], ['FRAPPE FIT', 1]] },
  // COLA con pago digital pendiente: por validar (gris «Por validar pago»)
  { codigo: 'RP-PRUEBA-15', nombres: 'Gabriela', apellidos: 'Solís', telefono: '910000015', km: 1.0, rumbo: 5,
    direccion: 'Calle Los Naranjos 118, Campoy, San Juan de Lurigancho',
    referencia: 'Casa esquina con bodega',
    estado: 'COLA', esperaMin: 9, pagoMetodo: 'YAPE', pagoEstado: 'PENDIENTE',
    productos: [['CAPUCCINO', 1], ['WAFFLE BANANA SPLIT', 1]] },
  { codigo: 'RP-PRUEBA-16', nombres: 'Franco', apellidos: 'Ramírez', telefono: '910000016', km: 2.2, rumbo: 70,
    direccion: 'Av. Nicolás Ayllón 3050, El Agustino',
    referencia: 'Local de llantas, pasar el portón',
    estado: 'COLA', esperaMin: 16, pagoMetodo: 'PLIN', pagoEstado: 'PENDIENTE',
    productos: [['DÚO IRRESISTIBLE', 1]] },
  { codigo: 'RP-PRUEBA-17', nombres: 'Miguel Ángel', apellidos: 'Ortiz', telefono: '910000017', km: 2.9, rumbo: 185,
    direccion: 'Av. Confraternidad Internacional Este 1520, San Juan de Lurigancho',
    referencia: 'Frente al grifo, edificio de 4 pisos',
    estado: 'COLA', esperaMin: 25, pagoMetodo: 'TRANSFERENCIA', pagoEstado: 'PENDIENTE',
    productos: [['LATTE VAINILLA', 1], ['CAFÉ AMERICANO', 1]] },
];

/** Verifica que la base sea la local de desarrollo (nunca demo, e2e ni producción). */
function asegurarBaseLocal() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL (la base local caprichos, localhost:5442)');
  const u = new URL(url);
  const esLocal =
    ['localhost', '127.0.0.1'].includes(u.hostname) && u.port === '5442' && u.pathname.replace(/^\//, '') === 'caprichos';
  if (!esLocal) {
    throw new Error(`Este seed solo corre contra localhost:5442/caprichos (recibido ${u.hostname}:${u.port}${u.pathname})`);
  }
}

/** Sede: local_datos (Configuración > Ubicación) manda; luego local_lat/local_lng; si no, el defecto. */
async function leerSede(prisma: PrismaClient) {
  const filas = await prisma.parametro.findMany({ where: { clave: { in: ['local_datos', 'local_lat', 'local_lng'] } } });
  const mapa = Object.fromEntries(filas.map((f) => [f.clave, f.valor])) as Record<string, any>;
  const lat = Number(mapa.local_datos?.lat ?? mapa.local_lat ?? SEDE_DEFECTO.lat);
  const lng = Number(mapa.local_datos?.lng ?? mapa.local_lng ?? SEDE_DEFECTO.lng);
  const origen = mapa.local_datos?.lat != null ? 'local_datos' : mapa.local_lat != null ? 'local_lat/lng' : 'defecto';
  return { lat, lng, origen };
}

/** Punto a `km` de la sede en `rumbo` grados (0 = norte). Aproximación plana, de sobra para 3 km. */
function puntoDesde(sede: { lat: number; lng: number }, km: number, rumbo: number) {
  const r = (rumbo * Math.PI) / 180;
  const lat = sede.lat + (km * Math.cos(r)) / 110.574;
  const lng = sede.lng + (km * Math.sin(r)) / (111.32 * Math.cos((sede.lat * Math.PI) / 180));
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

const SECTORES = ['Norte', 'Noreste', 'Este', 'Sureste', 'Sur', 'Suroeste', 'Oeste', 'Noroeste'];
function sectorDe(rumbo: number) {
  return SECTORES[Math.round((((rumbo % 360) + 360) % 360) / 45) % 8];
}

/** Ray casting: poligono en pares [lat, lng] (mismo formato que ZonaReparto.poligono). */
function dentroDePoligono(p: { lat: number; lng: number }, poligono: Array<[number, number]>) {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [yi, xi] = poligono[i];
    const [yj, xj] = poligono[j];
    if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

async function clienteParty(prisma: PrismaClient, c: CasoPrueba): Promise<bigint> {
  const existente = await prisma.contactMechanism.findFirst({
    where: { tipo: 'TELEFONO', valor: c.telefono },
    select: { party_id: true },
  });
  if (existente) return existente.party_id;
  const party = await prisma.party.create({
    data: {
      tipo: 'PERSONA',
      persona: { create: { nombres: c.nombres, apellidos: c.apellidos } },
      contactos: { create: { tipo: 'TELEFONO', valor: c.telefono, principal: true } },
    },
  });
  return party.id;
}

export async function main() {
  asegurarBaseLocal();
  const prisma = new PrismaClient();
  try {
    // 1. Límite de pedidos por repartidor
    await prisma.parametro.upsert({
      where: { clave: 'rep_max_pedidos' },
      update: { valor: 4 },
      create: { clave: 'rep_max_pedidos', valor: 4 },
    });

    // Cuatro rutas visibles (norte, este, sur y oeste); con el valor por defecto (3) el sur se oculta.
    await prisma.parametro.upsert({
      where: { clave: 'reparto_rutas_sugeridas_max' },
      update: { valor: 4 },
      create: { clave: 'reparto_rutas_sugeridas_max', valor: 4 },
    });

    // 2. Sede y zonas
    const sede = await leerSede(prisma);
    const zonas = await prisma.zonaReparto.findMany({ where: { activa: true } });
    console.log(`Sede (${sede.origen}): ${sede.lat}, ${sede.lng}`);

    // 3. Repartidor de prueba: el primero activo (no se cambia su contraseña)
    const repartidor = await prisma.userAccount.findFirst({
      where: { rol: 'REPARTIDOR', activo: true },
      orderBy: { party_id: 'asc' },
      include: { party: { include: { persona: true, documentos: true } } },
    });
    if (!repartidor) {
      throw new Error('No hay repartidor activo. Crea uno con seed-usuarios-demo.ts antes de correr este seed.');
    }
    const dni = repartidor.party.documentos.find((d) => d.tipo === 'DNI')?.numero ?? '(sin DNI)';
    console.log(`Repartidor para probar: ${repartidor.party.persona?.nombres ?? ''} ${repartidor.party.persona?.apellidos ?? ''} (DNI ${dni})`);

    // 4. Limpieza de lo que este seed creó antes (idempotencia)
    const previos = await prisma.pedido.findMany({
      where: { OR: [{ codigo: { startsWith: PREFIJO_CODIGO } }, { nota: { startsWith: MARCA } }] },
      select: { id: true },
    });
    const idsPrevios = previos.map((p) => p.id);
    if (idsPrevios.length > 0) {
      const lineas = await prisma.pedidoLinea.findMany({ where: { pedido_id: { in: idsPrevios } }, select: { id: true } });
      // El API local (nest --watch) genera mensajes de reparto y salientes de WhatsApp para estos
      // pedidos; se borran con ellos para que la limpieza sea completa.
      const enPedidos = { pedido_id: { in: idsPrevios } };
      await prisma.$transaction([
        prisma.pedidoLineaOpcion.deleteMany({ where: { pedido_linea_id: { in: lineas.map((l) => l.id) } } }),
        prisma.pedidoLinea.deleteMany({ where: { pedido_id: { in: idsPrevios } } }),
        prisma.pedidoEstadoHistorial.deleteMany({ where: enPedidos }),
        prisma.pedidoPagoPlan.deleteMany({ where: enPedidos }),
        prisma.mensajeReparto.deleteMany({ where: enPedidos }),
        prisma.incidenteEntrega.deleteMany({ where: enPedidos }),
        prisma.whatsappMensaje.deleteMany({ where: enPedidos }),
        prisma.salienteWhatsapp.deleteMany({ where: enPedidos }),
        prisma.pedido.deleteMany({ where: { id: { in: idsPrevios } } }),
      ]);
    }
    console.log(`Pedidos de prueba anteriores borrados: ${idsPrevios.length}`);

    // 5. Pedidos
    const ahora = Date.now();
    const productosCache = new Map<string, { id: bigint; precio: number; areaId: bigint }>();
    const resumen: Array<Record<string, string | number>> = [];

    for (const c of CASOS) {
      const creado = new Date(ahora - c.esperaMin * 60_000);
      const punto = puntoDesde(sede, c.km, c.rumbo);
      const zona = zonas.find((z) => dentroDePoligono(punto, z.poligono as Array<[number, number]>)) ?? null;
      const envio = zona ? Number(zona.tarifa) : 5;

      const lineas = [];
      for (const [nombre, cantidad] of c.productos) {
        let prod = productosCache.get(nombre);
        if (!prod) {
          const p = await prisma.producto.findUnique({ where: { nombre }, include: { categoria: true } });
          if (!p) throw new Error(`Producto «${nombre}» no existe en el catálogo`);
          prod = { id: p.id, precio: Number(p.precio), areaId: p.categoria.area_id };
          productosCache.set(nombre, prod);
        }
        lineas.push({
          producto_id: prod.id,
          nombre,
          cantidad,
          precio_unit: new Prisma.Decimal(prod.precio.toFixed(2)),
          subtotal: new Prisma.Decimal((prod.precio * cantidad).toFixed(2)),
          area_id: prod.areaId,
        });
      }
      const subtotal = lineas.reduce((a, l) => a + Number(l.subtotal), 0);
      const total = subtotal + envio;
      if (c.pagaCon != null && c.pagaCon < total) {
        throw new Error(`${c.codigo}: paga_con ${c.pagaCon} es menor que el total ${total.toFixed(2)}`);
      }

      const clienteId = await clienteParty(prisma, c);
      const historial: Prisma.PedidoEstadoHistorialCreateWithoutPedidoInput[] = [
        { estado_anterior: null, estado_nuevo: 'COLA', en: creado },
      ];
      const pasaCocina = c.estado === 'COLA' ? null : new Date(creado.getTime() + 2 * 60_000);
      if (pasaCocina) historial.push({ estado_anterior: 'COLA', estado_nuevo: 'PREPARANDO', en: pasaCocina });
      const listoEn = c.estado === 'LISTO' ? new Date(creado.getTime() + 4 * 60_000) : null;
      if (listoEn) historial.push({ estado_anterior: 'PREPARANDO', estado_nuevo: 'LISTO', en: listoEn });

      await prisma.pedido.create({
        data: {
          codigo: c.codigo,
          canal: 'CARTA',
          modalidad: 'DELIVERY',
          estado: c.estado,
          cliente_party_id: clienteId,
          cliente_nombre: `${c.nombres} ${c.apellidos}`,
          cliente_telefono: c.telefono,
          entrega_direccion: c.direccion,
          entrega_referencia: c.referencia,
          entrega_lat: new Prisma.Decimal(punto.lat.toFixed(6)),
          entrega_lng: new Prisma.Decimal(punto.lng.toFixed(6)),
          entrega_origen: 'ESCRITA',
          zona_id: zona?.id ?? null,
          pago_metodo: c.pagoMetodo,
          pago_estado: c.pagoEstado,
          pago_preferido: c.pagoMetodo,
          paga_con: c.pagaCon != null ? new Prisma.Decimal(c.pagaCon.toFixed(2)) : null,
          subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
          descuento: new Prisma.Decimal(0),
          envio: new Prisma.Decimal(envio.toFixed(2)),
          total: new Prisma.Decimal(total.toFixed(2)),
          nota: MARCA,
          eta_min: TIEMPO_PROMETIDO.eta_min,
          eta_max: TIEMPO_PROMETIDO.eta_max,
          creado_en: creado,
          pasa_cocina_en: pasaCocina,
          listo_en: listoEn,
          lineas: { create: lineas },
          historial: { create: historial },
        },
      });

      resumen.push({
        codigo: c.codigo,
        cliente: `${c.nombres} ${c.apellidos}`,
        estado: c.estado,
        pago: `${c.pagoMetodo} ${c.pagoEstado}`,
        espera_min: c.esperaMin,
        sector: sectorDe(c.rumbo),
        zona: zona?.codigo ?? '-',
        total: total.toFixed(2),
      });
    }

    // 6. Resumen
    const porEstado = await prisma.pedido.groupBy({
      by: ['estado'],
      where: { codigo: { startsWith: PREFIJO_CODIGO } },
      _count: { _all: true },
    });
    console.log('--- Pedidos de prueba creados ---');
    console.table(resumen);
    console.log('--- Conteo por estado (RP-PRUEBA-*) ---');
    console.log(porEstado.map((g) => `${g.estado}: ${g._count._all}`).join(' | '));
    console.log(`Repartidor a usar: ${repartidor.party.persona?.nombres ?? ''} ${repartidor.party.persona?.apellidos ?? ''} (DNI ${dni})`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

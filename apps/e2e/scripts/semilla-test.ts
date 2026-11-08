import { execSync } from 'child_process';
import * as path from 'path';
import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  RolPrueba,
  DNIS_POR_ROL,
  generarClaveSegura,
  obtenerDbUrl,
  NOMBRE_DB,
} from '../src/credenciales';

// Importar roles y permisos oficiales del backend compilado
// eslint-disable-next-line @typescript-eslint/no-require-imports -- ruta dinamica al dist compilado del backend
const { ROLES, PERMISOS, MATRIZ } = require(
  path.resolve(__dirname, '../../api/dist/modulos/acceso/permisos.js'),
);

export interface ResultadoSemilla {
  dbUrl: string;
  credenciales: Record<RolPrueba, { dni: string; clave: string }>;
}

export async function recrearBaseDatosTest(): Promise<string> {
  const dbUrlTest = obtenerDbUrl(NOMBRE_DB);

  // Ejecutar DROP y CREATE de forma limpia en el contenedor postgres caprichos-pg-dev
  // usando psql dentro del contenedor con las variables ya existentes
  const sqlLimpieza = `
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${NOMBRE_DB}' AND pid <> pg_backend_pid();
    DROP DATABASE IF EXISTS ${NOMBRE_DB};
    CREATE DATABASE ${NOMBRE_DB};
  `;

  execSync('docker exec -i caprichos-pg-dev sh -c \'psql -U "$POSTGRES_USER" -d postgres\'', {
    input: sqlLimpieza,
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  // Ejecutar migraciones oficiales de Prisma sobre caprichos_test
  const monorepoRoot = path.resolve(__dirname, '../../..');
  execSync('pnpm --filter @caprichos/api exec prisma migrate deploy', {
    cwd: monorepoRoot,
    env: {
      ...process.env,
      DATABASE_URL: dbUrlTest,
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  return dbUrlTest;
}

export async function sembrarDatosPrueba(dbUrlTest?: string): Promise<ResultadoSemilla> {
  const dbUrl = dbUrlTest || obtenerDbUrl(NOMBRE_DB);
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
    log: ['error'],
  });

  try {
    // 1. Roles y permisos oficiales
    for (const rol of ROLES) {
      await prisma.rol.upsert({
        where: { codigo: rol.codigo },
        update: { nombre: rol.nombre },
        create: { codigo: rol.codigo, nombre: rol.nombre },
      });
    }

    const mapaPermisos = new Map<string, bigint>();
    for (const perm of PERMISOS) {
      const p = await prisma.permiso.upsert({
        where: {
          modulo_accion: {
            modulo: perm.modulo,
            accion: perm.accion,
          },
        },
        update: {},
        create: {
          modulo: perm.modulo,
          accion: perm.accion,
        },
      });
      mapaPermisos.set(`${perm.modulo}/${perm.accion}`, p.id);
    }

    for (const [rolCodigo, listaPermisos] of Object.entries(MATRIZ)) {
      for (const permClave of listaPermisos as string[]) {
        const permisoId = mapaPermisos.get(permClave);
        if (!permisoId) continue;
        await prisma.rolPermiso.upsert({
          where: {
            rol_permiso_id: {
              rol: rolCodigo,
              permiso_id: permisoId,
            },
          },
          update: {},
          create: {
            rol: rolCodigo,
            permiso_id: permisoId,
          },
        });
      }
    }

    // 2. Áreas de cocina y Lugares de stock
    const barraArea = await prisma.areaCocina.upsert({
      where: { nombre: 'Bebidas' },
      update: { propia: true, activo: true },
      create: { nombre: 'Bebidas', propia: true, activo: true },
    });

    const cocinaArea = await prisma.areaCocina.upsert({
      where: { nombre: 'Salados' },
      update: { propia: true, activo: true },
      create: { nombre: 'Salados', propia: true, activo: true },
    });

    const almacenCentral = await prisma.lugarStock.upsert({
      where: { nombre: 'Almacén central' },
      update: { tipo: 'ALMACEN', area_id: null },
      create: { nombre: 'Almacén central', tipo: 'ALMACEN', area_id: null },
    });

    const barraStock = await prisma.lugarStock.upsert({
      where: { nombre: 'Bebidas' },
      update: { tipo: 'AREA', area_id: barraArea.id },
      create: { nombre: 'Bebidas', tipo: 'AREA', area_id: barraArea.id },
    });

    const cocinaStock = await prisma.lugarStock.upsert({
      where: { nombre: 'Salados' },
      update: { tipo: 'AREA', area_id: cocinaArea.id },
      create: { nombre: 'Salados', tipo: 'AREA', area_id: cocinaArea.id },
    });

    // 2.5 Lista de Tamaños
    const listaTamanos = await prisma.lista.upsert({
      where: { codigo: 'TAMANOS' },
      update: { nombre: 'Tamaños' },
      create: { codigo: 'TAMANOS', nombre: 'Tamaños' },
    });

    await prisma.listaValor.upsert({
      where: { id: 1 },
      update: { nombre: 'Regular', lista_id: listaTamanos.id, orden: 1, activo: true },
      create: { id: 1, nombre: 'Regular', lista_id: listaTamanos.id, orden: 1, activo: true },
    });

    await prisma.listaValor.upsert({
      where: { id: 2 },
      update: { nombre: 'Único', lista_id: listaTamanos.id, orden: 2, activo: true },
      create: { id: 2, nombre: 'Único', lista_id: listaTamanos.id, orden: 2, activo: true },
    });

    // 3. Categorías
    const catCafeteria = await prisma.categoria.upsert({
      where: { nombre: 'Cafetería' },
      update: { area_id: barraArea.id, orden: 1, lleva_opciones: false, oculta: false },
      create: { nombre: 'Cafetería', area_id: barraArea.id, orden: 1, lleva_opciones: false, oculta: false },
    });

    const catWaffles = await prisma.categoria.upsert({
      where: { nombre: 'Waffles y Postres' },
      update: { area_id: cocinaArea.id, orden: 2, lleva_opciones: false, oculta: false },
      create: { nombre: 'Waffles y Postres', area_id: cocinaArea.id, orden: 2, lleva_opciones: false, oculta: false },
    });

    const catSalados = await prisma.categoria.upsert({
      where: { nombre: 'Salados' },
      update: { area_id: cocinaArea.id, orden: 3, lleva_opciones: false, oculta: false },
      create: { nombre: 'Salados', area_id: cocinaArea.id, orden: 3, lleva_opciones: false, oculta: false },
    });

    // 4. 8 Productos con precio
    const defsProductos = [
      { nombre: 'Café Americano', precio: 10.0, categoria_id: catCafeteria.id, orden: 1 },
      { nombre: 'Capuccino', precio: 12.0, categoria_id: catCafeteria.id, orden: 2 },
      { nombre: 'Latte Vainilla', precio: 14.0, categoria_id: catCafeteria.id, orden: 3 },
      { nombre: 'Waffle Brownie', precio: 18.0, categoria_id: catWaffles.id, orden: 4 },
      { nombre: 'Torta de Chocolate', precio: 15.0, categoria_id: catWaffles.id, orden: 5 },
      { nombre: 'Pie de Limón', precio: 13.0, categoria_id: catWaffles.id, orden: 6 },
      { nombre: 'Club Sandwich', precio: 22.0, categoria_id: catSalados.id, orden: 7 },
      { nombre: 'Croissant Mixto', precio: 12.0, categoria_id: catSalados.id, orden: 8 },
    ];

    const mapaProductos = new Map<string, any>();
    for (const p of defsProductos) {
      const prod = await prisma.producto.upsert({
        where: { nombre: p.nombre },
        update: {
          precio: new Prisma.Decimal(p.precio),
          categoria_id: p.categoria_id,
          orden: p.orden,
          oculto: false,
        },
        create: {
          nombre: p.nombre,
          precio: new Prisma.Decimal(p.precio),
          categoria_id: p.categoria_id,
          orden: p.orden,
          oculto: false,
        },
      });
      mapaProductos.set(p.nombre, prod);
    }

    // 5. 1 Insumo con receta y stock
    const insumoCafe = await prisma.insumo.upsert({
      where: { nombre: 'Café en grano' },
      update: {
        unidad_compra: 'BOLSA',
        unidad_almacen: 'KG',
        unidad_receta: 'G',
        factor_compra: new Prisma.Decimal(1),
        factor_receta: new Prisma.Decimal(1000),
        costo_unit: new Prisma.Decimal(45.0),
        minimo: new Prisma.Decimal(5),
        intermedio: new Prisma.Decimal(15),
        maximo: new Prisma.Decimal(40),
        lugar_consumo_id: barraStock.id,
        activo: true,
      },
      create: {
        nombre: 'Café en grano',
        unidad_compra: 'BOLSA',
        unidad_almacen: 'KG',
        unidad_receta: 'G',
        factor_compra: new Prisma.Decimal(1),
        factor_receta: new Prisma.Decimal(1000),
        costo_unit: new Prisma.Decimal(45.0),
        minimo: new Prisma.Decimal(5),
        intermedio: new Prisma.Decimal(15),
        maximo: new Prisma.Decimal(40),
        lugar_consumo_id: barraStock.id,
        activo: true,
      },
    });

    // Stock inicial del insumo
    await prisma.stock.upsert({
      where: { id: 1 },
      update: {
        insumo_id: insumoCafe.id,
        lugar_id: almacenCentral.id,
        cantidad: new Prisma.Decimal(20),
      },
      create: {
        insumo_id: insumoCafe.id,
        lugar_id: almacenCentral.id,
        cantidad: new Prisma.Decimal(20),
      },
    });

    await prisma.stock.upsert({
      where: { id: 2 },
      update: {
        insumo_id: insumoCafe.id,
        lugar_id: barraStock.id,
        cantidad: new Prisma.Decimal(5),
      },
      create: {
        insumo_id: insumoCafe.id,
        lugar_id: barraStock.id,
        cantidad: new Prisma.Decimal(5),
      },
    });

    // Receta de Café Americano: 18g de café en grano
    const prodCafeAmericano = mapaProductos.get('Café Americano');
    let recetaAmericano = await prisma.receta.findFirst({
      where: {
        producto_id: prodCafeAmericano.id,
        es_produccion: false,
      },
    });

    if (!recetaAmericano) {
      recetaAmericano = await prisma.receta.create({
        data: {
          producto_id: prodCafeAmericano.id,
          es_produccion: false,
          rinde: new Prisma.Decimal(1),
        },
      });
    }

    await prisma.recetaLinea.upsert({
      where: {
        receta_id_insumo_id: {
          receta_id: recetaAmericano.id,
          insumo_id: insumoCafe.id,
        },
      },
      update: { cantidad: new Prisma.Decimal(18) },
      create: {
        receta_id: recetaAmericano.id,
        insumo_id: insumoCafe.id,
        cantidad: new Prisma.Decimal(18),
      },
    });

    // 5.1 Insumo adicional para producción por tanda: Harina de trigo
    const insumoHarina = await prisma.insumo.upsert({
      where: { nombre: 'Harina de trigo' },
      update: {
        unidad_compra: 'BOLSA',
        unidad_almacen: 'KG',
        unidad_receta: 'G',
        factor_compra: new Prisma.Decimal(1),
        factor_receta: new Prisma.Decimal(1000),
        costo_unit: new Prisma.Decimal(5.0),
        minimo: new Prisma.Decimal(5),
        intermedio: new Prisma.Decimal(15),
        maximo: new Prisma.Decimal(50),
        lugar_consumo_id: cocinaStock.id,
        activo: true,
      },
      create: {
        nombre: 'Harina de trigo',
        unidad_compra: 'BOLSA',
        unidad_almacen: 'KG',
        unidad_receta: 'G',
        factor_compra: new Prisma.Decimal(1),
        factor_receta: new Prisma.Decimal(1000),
        costo_unit: new Prisma.Decimal(5.0),
        minimo: new Prisma.Decimal(5),
        intermedio: new Prisma.Decimal(15),
        maximo: new Prisma.Decimal(50),
        lugar_consumo_id: cocinaStock.id,
        activo: true,
      },
    });

    await prisma.stock.upsert({
      where: { id: 3 },
      update: {
        insumo_id: insumoHarina.id,
        lugar_id: almacenCentral.id,
        cantidad: new Prisma.Decimal(30),
      },
      create: {
        insumo_id: insumoHarina.id,
        lugar_id: almacenCentral.id,
        cantidad: new Prisma.Decimal(30),
      },
    });

    await prisma.stock.upsert({
      where: { id: 4 },
      update: {
        insumo_id: insumoHarina.id,
        lugar_id: cocinaStock.id,
        cantidad: new Prisma.Decimal(10),
      },
      create: {
        insumo_id: insumoHarina.id,
        lugar_id: cocinaStock.id,
        cantidad: new Prisma.Decimal(10),
      },
    });

    // Receta por tanda (es_produccion: true) para Torta de Chocolate
    const prodTorta = mapaProductos.get('Torta de Chocolate');
    let recetaTorta = await prisma.receta.findFirst({
      where: {
        producto_id: prodTorta.id,
        es_produccion: true,
      },
    });

    if (!recetaTorta) {
      recetaTorta = await prisma.receta.create({
        data: {
          producto_id: prodTorta.id,
          es_produccion: true,
          rinde: new Prisma.Decimal(10), // 10 porciones por tanda
        },
      });
    }

    await prisma.recetaLinea.upsert({
      where: {
        receta_id_insumo_id: {
          receta_id: recetaTorta.id,
          insumo_id: insumoHarina.id,
        },
      },
      update: { cantidad: new Prisma.Decimal(1) }, // 1 KG de harina por tanda
      create: {
        receta_id: recetaTorta.id,
        insumo_id: insumoHarina.id,
        cantidad: new Prisma.Decimal(1),
      },
    });

    // Stock inicial de producto elaborado en Cocina para Torta de Chocolate
    await prisma.stock.upsert({
      where: { id: 5 },
      update: {
        producto_id: prodTorta.id,
        lugar_id: cocinaStock.id,
        cantidad: new Prisma.Decimal(8), // 8 porciones ya elaboradas
      },
      create: {
        producto_id: prodTorta.id,
        lugar_id: cocinaStock.id,
        cantidad: new Prisma.Decimal(8),
      },
    });

    // 6. Oferta 2x1 en Café Americano
    await prisma.oferta.upsert({
      where: { nombre: '2x1 Café Americano' },
      update: {
        tipo: 'LLEVA_PAGA',
        descripcion: 'Lleva 2 y paga 1 en Café Americano',
        lleva: 2,
        paga: 1,
        alcance_producto_id: prodCafeAmericano.id,
        canales: ['CARTA', 'ADMIN', 'BOT'],
        activo: true,
        orden: 1,
      },
      create: {
        tipo: 'LLEVA_PAGA',
        nombre: '2x1 Café Americano',
        descripcion: 'Lleva 2 y paga 1 en Café Americano',
        lleva: 2,
        paga: 1,
        alcance_producto_id: prodCafeAmericano.id,
        canales: ['CARTA', 'ADMIN', 'BOT'],
        activo: true,
        orden: 1,
      },
    });

    // 7. Local abierto todo el día (7 días de 00:00 a 23:59) y Parámetros
    const fechaAbre = new Date('1970-01-01T00:00:00.000Z');
    const fechaCierra = new Date('1970-01-01T23:59:00.000Z');

    for (let dia = 1; dia <= 7; dia++) {
      await prisma.horarioDia.upsert({
        where: { dia_semana: dia },
        update: {
          abre: fechaAbre,
          cierra: fechaCierra,
          cerrado: false,
        },
        create: {
          dia_semana: dia,
          abre: fechaAbre,
          cierra: fechaCierra,
          cerrado: false,
        },
      });
    }

    const parametros = [
      {
        clave: 'local_datos',
        valor: {
          nombre: 'Caprichos Test',
          direccion: 'Av. Test 123, Lima',
          ruc: '20611290064',
          razon_social: 'CAPRICHOS TEST SAC',
          direccion_fiscal: 'Av. Test 123, Lima',
          ubigeo: '150132',
          telefono: '999999999',
          whatsapp: '999999999',
          redes: { instagram: '', facebook: '', tiktok: '' },
        },
      },
      {
        clave: 'local_pagos',
        valor: {
          efectivo: { activo: true },
          yape: { activo: true, numero: '999999999' },
          plin: { activo: true, numero: '999999999' },
          transferencia: { activo: true, cuenta: '123456789', banco: 'BCP' },
          tarjeta: { activo: true },
        },
      },
      { clave: 'alta_demanda_min_base', valor: 0 },
      { clave: 'puntos_porcentaje', valor: 5 },
      { clave: 'rep_max_pedidos', valor: 3 },
      { clave: 'terminos_texto', valor: 'Términos de prueba' },
      { clave: 'privacidad_texto', valor: 'Privacidad de prueba' },
      { clave: 'reclamo_plazo_dias_habiles', valor: 15 },
      { clave: 'envio_gratis_monto', valor: 70 },
      { clave: 'envio_gratis_modo', valor: 'mas_de' },
      { clave: 'carta_aviso_entrada', valor: 'no' },
    ];

    for (const p of parametros) {
      await prisma.parametro.upsert({
        where: { clave: p.clave },
        update: { valor: p.valor },
        create: { clave: p.clave, valor: p.valor },
      });
    }

    await prisma.secuenciaComprobante.upsert({
      where: { serie: 'NV01' },
      update: {},
      create: { serie: 'NV01', ultimo_numero: 0 },
    });

    // 8. Usuarios de prueba por rol con contraseñas generadas al vuelo en memoria
    const rolesList: RolPrueba[] = [
      'ADMIN',
      'CAJERO',
      'MOZO',
      'COCINA',
      'ALMACEN',
      'REPARTIDOR',
      'REPARTIDOR_2',
    ];

    const credencialesGeneradas: Record<RolPrueba, { dni: string; clave: string }> = {} as any;
    const mapaEnvClaves: Record<string, string> = {};

    for (const rol of rolesList) {
      const dni = DNIS_POR_ROL[rol];
      const clave = generarClaveSegura();
      const hash = await argon2.hash(clave, { type: argon2.argon2id });

      credencialesGeneradas[rol] = { dni, clave };
      mapaEnvClaves[rol] = clave;
      process.env[`E2E_PASSWORD_${rol}`] = clave;

      const nombrePersona =
        rol === 'REPARTIDOR'
          ? 'Juan'
          : rol === 'REPARTIDOR_2'
          ? 'Carlos'
          : rol;
      const apellidoPersona =
        rol === 'REPARTIDOR' || rol === 'REPARTIDOR_2' ? 'Delivery' : 'E2E Test';
      const rolEnBd = rol === 'REPARTIDOR_2' ? 'REPARTIDOR' : rol;

      await prisma.$transaction(async (tx) => {
        const ident = await tx.partyIdentifier.findUnique({
          where: { tipo_numero: { tipo: 'DNI', numero: dni } },
        });

        let partyId: bigint;
        if (ident) {
          partyId = ident.party_id;
          await tx.person.upsert({
            where: { party_id: partyId },
            update: { nombres: nombrePersona, apellidos: apellidoPersona },
            create: { party_id: partyId, nombres: nombrePersona, apellidos: apellidoPersona },
          });

          await tx.userAccount.upsert({
            where: { party_id: partyId },
            update: {
              rol: rolEnBd,
              hash,
              debe_cambiar: false,
              activo: true,
            },
            create: {
              party_id: partyId,
              rol: rolEnBd,
              hash,
              debe_cambiar: false,
              activo: true,
            },
          });
        } else {
          const party = await tx.party.create({
            data: { tipo: 'PERSONA', estado: 'ACTIVO' },
          });
          partyId = party.id;

          await tx.person.create({
            data: {
              party_id: partyId,
              nombres: nombrePersona,
              apellidos: apellidoPersona,
            },
          });

          await tx.partyIdentifier.create({
            data: {
              party_id: partyId,
              tipo: 'DNI',
              numero: dni,
            },
          });

          await tx.userAccount.create({
            data: {
              party_id: partyId,
              rol: rolEnBd,
              hash,
              debe_cambiar: false,
              activo: true,
            },
          });
        }
      });
    }

    // 9. Piso y mesa para pruebas de salón y pedidos admin
    const pisoPrincipal = await prisma.piso.upsert({
      where: { id: 1 },
      update: {
        nombre: 'Piso 1',
        activo: true,
        cuadricula_ancho: 20,
        cuadricula_alto: 12,
      },
      create: {
        id: 1,
        nombre: 'Piso 1',
        activo: true,
        cuadricula_ancho: 20,
        cuadricula_alto: 12,
      },
    });

    await prisma.elementoPlano.upsert({
      where: { id: 1 },
      update: {
        piso_id: pisoPrincipal.id,
        tipo: 'MESA',
        nombre: 'Mesa 1',
        numero: 1,
        asientos: 4,
        x: 2,
        y: 2,
        ancho: 2,
        alto: 2,
        activo: true,
      },
      create: {
        id: 1,
        piso_id: pisoPrincipal.id,
        tipo: 'MESA',
        nombre: 'Mesa 1',
        numero: 1,
        asientos: 4,
        x: 2,
        y: 2,
        ancho: 2,
        alto: 2,
        activo: true,
      },
    });

    // 10. Pedidos Delivery en estado LISTO distribuidos en distintos sectores (Norte, Sur, Este)
    const prodCafe = mapaProductos.get('Café Americano');
    const ahora = new Date();

    const pedidosDeliveryPrueba = [
      // Sector Norte (4 pedidos para probar iniciar ruta eligiendo 2 de 4 y concurrencia)
      {
        codigo: 'CP-D001',
        cliente_nombre: 'Ana Norte',
        cliente_telefono: '987111001',
        entrega_direccion: 'Av. Gran Chimu 120, SJL',
        entrega_lat: -12.008,
        entrega_lng: -76.963,
        minutosListo: 40,
        total: 20.0,
      },
      {
        codigo: 'CP-D002',
        cliente_nombre: 'Bruno Norte',
        cliente_telefono: '987111002',
        entrega_direccion: 'Jr. Los Claveles 340, SJL',
        entrega_lat: -12.005,
        entrega_lng: -76.962,
        minutosListo: 35,
        total: 20.0,
      },
      {
        codigo: 'CP-D003',
        cliente_nombre: 'Carla Norte',
        cliente_telefono: '987111003',
        entrega_direccion: 'Calle Las Flores 560, SJL',
        entrega_lat: -12.002,
        entrega_lng: -76.961,
        minutosListo: 25,
        total: 20.0,
      },
      {
        codigo: 'CP-D004',
        cliente_nombre: 'Diego Norte',
        cliente_telefono: '987111004',
        entrega_direccion: 'Av. Canto Grande 780, SJL',
        entrega_lat: -11.999,
        entrega_lng: -76.96,
        minutosListo: 15,
        total: 20.0,
      },
      // Sector Sur (2 pedidos)
      {
        codigo: 'CP-D005',
        cliente_nombre: 'Elena Sur',
        cliente_telefono: '987111005',
        entrega_direccion: 'Av. Malecon Checa 890, SJL',
        entrega_lat: -12.03,
        entrega_lng: -76.965,
        minutosListo: 22,
        total: 20.0,
      },
      {
        codigo: 'CP-D006',
        cliente_nombre: 'Fernando Sur',
        cliente_telefono: '987111006',
        entrega_direccion: 'Jr. Piramides del Sol 1100, SJL',
        entrega_lat: -12.035,
        entrega_lng: -76.967,
        minutosListo: 18,
        total: 20.0,
      },
      // Sector Este (2 pedidos)
      {
        codigo: 'CP-D007',
        cliente_nombre: 'Gabriela Este',
        cliente_telefono: '987111007',
        entrega_direccion: 'Av. Santa Rosa 450, SJL',
        entrega_lat: -12.019,
        entrega_lng: -76.95,
        minutosListo: 30,
        total: 20.0,
      },
      {
        codigo: 'CP-D008',
        cliente_nombre: 'Hector Este',
        cliente_telefono: '987111008',
        entrega_direccion: 'Calle Los Sauces 210, SJL',
        entrega_lat: -12.018,
        entrega_lng: -76.945,
        minutosListo: 12,
        total: 20.0,
      },
      // Sector Oeste (2 pedidos LISTO, al oeste del local de la semilla)
      {
        codigo: 'CP-D009',
        cliente_nombre: 'Ivan Oeste',
        cliente_telefono: '987111009',
        entrega_direccion: 'Av. Oeste 100, SJL',
        entrega_lat: -12.021,
        entrega_lng: -76.975,
        minutosListo: 28,
        total: 20.0,
      },
      {
        codigo: 'CP-D010',
        cliente_nombre: 'Julia Oeste',
        cliente_telefono: '987111010',
        entrega_direccion: 'Jr. Occidente 200, SJL',
        entrega_lat: -12.017,
        entrega_lng: -76.98,
        minutosListo: 8,
        total: 20.0,
      },
      // Trampas: el mapa NO debe dibujarlas. CP-D011 ANULADO al este, CP-D012 ENTREGADO al sur
      {
        codigo: 'CP-D011',
        estado: 'ANULADO',
        cliente_nombre: 'Trampa Anulada',
        cliente_telefono: '987111011',
        entrega_direccion: 'Av. Trampa 300, SJL',
        entrega_lat: -12.016,
        entrega_lng: -76.94,
        minutosListo: 80,
        total: 20.0,
      },
      {
        codigo: 'CP-D012',
        estado: 'ENTREGADO',
        cliente_nombre: 'Trampa Entregada',
        cliente_telefono: '987111012',
        entrega_direccion: 'Av. Trampa 400, SJL',
        entrega_lat: -12.04,
        entrega_lng: -76.963,
        minutosListo: 90,
        total: 20.0,
      },
    ];

    for (const p of pedidosDeliveryPrueba as Array<(typeof pedidosDeliveryPrueba)[number] & { estado?: string }>) {
      const estadoPedido = p.estado ?? 'LISTO';
      const fechaListo = new Date(ahora.getTime() - p.minutosListo * 60 * 1000);
      const fechaCreado = new Date(fechaListo.getTime() - 10 * 60 * 1000);

      const ped = await prisma.pedido.upsert({
        where: { codigo: p.codigo },
        update: {
          modalidad: 'DELIVERY',
          estado: estadoPedido,
          repartidor_party_id: null,
          entrega_lat: new Prisma.Decimal(p.entrega_lat),
          entrega_lng: new Prisma.Decimal(p.entrega_lng),
          entrega_direccion: p.entrega_direccion,
          cliente_nombre: p.cliente_nombre,
          cliente_telefono: p.cliente_telefono,
          total: new Prisma.Decimal(p.total),
          subtotal: new Prisma.Decimal(p.total),
          listo_en: fechaListo,
          creado_en: fechaCreado,
        },
        create: {
          codigo: p.codigo,
          modalidad: 'DELIVERY',
          estado: estadoPedido,
          canal: 'CARTA',
          pago_metodo: 'EFECTIVO',
          pago_estado: 'PENDIENTE',
          entrega_lat: new Prisma.Decimal(p.entrega_lat),
          entrega_lng: new Prisma.Decimal(p.entrega_lng),
          entrega_direccion: p.entrega_direccion,
          cliente_nombre: p.cliente_nombre,
          cliente_telefono: p.cliente_telefono,
          total: new Prisma.Decimal(p.total),
          subtotal: new Prisma.Decimal(p.total),
          listo_en: fechaListo,
          creado_en: fechaCreado,
        },
      });

      if (prodCafe) {
        const lineaExistente = await prisma.pedidoLinea.findFirst({
          where: { pedido_id: ped.id },
        });
        if (!lineaExistente) {
          await prisma.pedidoLinea.create({
            data: {
              pedido_id: ped.id,
              producto_id: prodCafe.id,
              nombre: 'Café Americano',
              cantidad: 2,
              precio_unit: new Prisma.Decimal(10.0),
              subtotal: new Prisma.Decimal(20.0),
            },
          });
        }
      }
    }

    // Exponer contraseñas al proceso en memoria
    process.env.E2E_PASSWORDS = JSON.stringify(mapaEnvClaves);

    return {
      dbUrl,
      credenciales: credencialesGeneradas,
    };
  } finally {
    await prisma.$disconnect();
  }
}

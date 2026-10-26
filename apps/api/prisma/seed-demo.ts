import { PrismaClient } from '@prisma/client';
import { ROLES, PERMISOS, MATRIZ } from '../src/modulos/acceso/permisos';
import { main as sembrarCarta } from './seed-carta';
import { main as sembrarZonas } from './seed-zonas';
import { main as sembrarCaja } from './seed-caja';
import { main as sembrarCocinaStock } from './seed-cocina-stock';
import { main as sembrarSalon } from './seed-salon';
import { main as sembrarLegal } from './seed-legal';

const prisma = new PrismaClient();

async function sembrarRolesYPermisos() {
  console.log('1. Sembrando Roles y Permisos oficiales...');

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
    for (const permClave of listaPermisos) {
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
  console.log(`   ✓ ${ROLES.length} roles y ${PERMISOS.length} permisos sincronizados.`);
}

async function configurarParametrosDemo() {
  console.log('7. Asegurando parámetros base de demostración...');

  const pagosDemo = {
    efectivo: { activo: true },
    yape: { activo: true, numero: '123456789' },
    plin: { activo: true, numero: '123456789' },
    transferencia: { activo: true, cuenta: '123456789', banco: 'BCP' },
    tarjeta: { activo: true },
  };

  await prisma.parametro.upsert({
    where: { clave: 'local_pagos' },
    update: {},
    create: { clave: 'local_pagos', valor: pagosDemo },
  });

  const params = [
    { clave: 'rep_max_pedidos', valor: 3 },
    { clave: 'rep_naranja_min', valor: 35 },
    { clave: 'rep_rojo_min', valor: 50 },
    { clave: 'reserva_tolerancia_min', valor: 15 },
    { clave: 'tolerancia_reserva_min', valor: 15 },
    { clave: 'alta_demanda_min_base', valor: 0 },
    { clave: 'chatbot_activo', valor: 'no' },
  ];

  for (const p of params) {
    await prisma.parametro.upsert({
      where: { clave: p.clave },
      update: { valor: p.valor },
      create: { clave: p.clave, valor: p.valor },
    });
  }
  console.log('   ✓ Parámetros de pagos (123456789) y tiempos de entrega configurados.');
}

export async function main() {
  console.log('====================================================');
  console.log('   INICIANDO SIEMBRA LIMPIA DE DEMOSTRACIÓN');
  console.log('====================================================');

  await sembrarRolesYPermisos();

  console.log('2. Sembrando Carta real y áreas de cocina...');
  await sembrarCarta();

  console.log('3. Sembrando Zonas de reparto oficiales...');
  await sembrarZonas();

  console.log('4. Sembrando Insumos y Recetas base...');
  await sembrarCocinaStock();

  console.log('5. Sembrando Plano del local por defecto...');
  await sembrarSalon();

  console.log('6. Sembrando Configuración legal y correlativos...');
  await sembrarLegal();

  await configurarParametrosDemo();

  console.log('====================================================');
  console.log('   SIEMBRA DE DEMOSTRACIÓN COMPLETADA CON ÉXITO');
  console.log('   (Sin datos de prueba ni contraseñas conocidas)');
  console.log('====================================================');
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error('Error durante la siembra de demo:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

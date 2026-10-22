import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const PAGOS_DEFAULT = {
  efectivo: { activo: true },
  yape: { activo: true, numero: '(pendiente)' },
  plin: { activo: true, numero: '(pendiente)' },
  transferencia: { activo: true, cuenta: '(pendiente)', banco: '(pendiente)' },
  tarjeta: { activo: true },
};

export async function main() {
  console.log('--- Iniciando seed-caja: parámetros iniciales ---');

  const parametrosIniciales: Array<{ clave: string; valor: any }> = [
    { clave: 'rep_max_pedidos', valor: 3 },
    { clave: 'rep_naranja_min', valor: 35 },
    { clave: 'rep_rojo_min', valor: 50 },
  ];

  for (const p of parametrosIniciales) {
    await prisma.parametro.upsert({
      where: { clave: p.clave },
      update: { valor: p.valor },
      create: { clave: p.clave, valor: p.valor },
    });
    console.log(`Parámetro configurado: ${p.clave} = ${p.valor}`);
  }

  // Medios de pago configurados en parámetros (si ya existe no se duplica)
  const existePagos = await prisma.parametro.findUnique({
    where: { clave: 'local_pagos' },
  });

  if (!existePagos) {
    await prisma.parametro.create({
      data: {
        clave: 'local_pagos',
        valor: PAGOS_DEFAULT,
      },
    });
    console.log('Parámetro configurado: local_pagos (medios de pago iniciales)');
  } else {
    console.log('Parámetro local_pagos ya existe, se mantiene la configuración existente.');
  }

  const totalParams = await prisma.parametro.count();
  console.log('--- Resumen seed-caja ---');
  console.log(`- total parámetros en BD: ${totalParams}`);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

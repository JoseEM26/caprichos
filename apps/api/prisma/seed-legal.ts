import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function main() {
  console.log('--- Iniciando seed-legal: serie inicial y parámetros legales ---');

  // 1. Serie NV01 de nota de venta (ultimo_numero 0 si no existe)
  const secuencia = await prisma.secuenciaComprobante.upsert({
    where: { serie: 'NV01' },
    update: {}, // No sobreescribir si ya avanzó el correlativo
    create: {
      serie: 'NV01',
      ultimo_numero: 0,
    },
  });
  console.log(`Serie configurada: ${secuencia.serie} (último número: ${secuencia.ultimo_numero})`);

  // 2. Parámetros iniciales legales
  const parametrosLegales: Array<{ clave: string; valor: any }> = [
    {
      clave: 'terminos_texto',
      valor:
        'Términos y condiciones del servicio Caprichos. Al utilizar nuestros canales de atención y realizar pedidos, el cliente acepta las políticas de compra, medios de pago, tiempos de entrega y condiciones del servicio vigentes. (texto de ejemplo, pendiente de revisión legal D-06)',
    },
    {
      clave: 'privacidad_texto',
      valor:
        'Aviso de privacidad y tratamiento de datos personales de Caprichos. De conformidad con la Ley N° 29733 (Ley de Protección de Datos Personales de Perú), sus datos personales proporcionados son tratados de manera confidencial y utilizados exclusivamente para la gestión, entrega, facturación y atención de sus pedidos. (texto de ejemplo, pendiente de revisión legal D-06)',
    },
    {
      clave: 'reclamo_plazo_dias_habiles',
      valor: 15, // RN-CAP-099 y NEC-CAP-089: plazo legal de respuesta en 15 días hábiles
    },
  ];

  for (const p of parametrosLegales) {
    await prisma.parametro.upsert({
      where: { clave: p.clave },
      update: { valor: p.valor },
      create: { clave: p.clave, valor: p.valor },
    });
    console.log(`Parámetro configurado: ${p.clave}`);
  }

  console.log('--- Resumen seed-legal completado con éxito ---');
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

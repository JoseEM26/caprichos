import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function main() {
  console.log('--- Iniciando semilla de Atención, WhatsApp y Encuestas (FT-ATN-01..03) ---');

  // 1. Respuestas rápidas
  const respuestasRapidasData = [
    {
      titulo: 'Saludo inicial',
      texto: '¡Hola! 😊 Gracias por comunicarte con Caprichos. ¿En qué te podemos ayudar hoy? 🧁',
    },
    {
      titulo: 'Horario de atención',
      texto: 'Nuestro horario de atención es de Lunes a Domingo de 2:00 pm a 10:00 pm.',
    },
    {
      titulo: 'Ubicación del local',
      texto: 'Estamos ubicados en Av. Principal 123. ¡Te esperamos para compartir los mejores momentos!',
    },
    {
      titulo: 'Datos para pago Yape/Plin',
      texto: 'Para pagar por Yape o Plin: 987654321 a nombre de Caprichos S.A.C. Por favor envíanos la captura una vez realizado.',
    },
    {
      titulo: 'Confirmación y pase a cocina',
      texto: '¡Recibimos tu comprobante conforme! Tu pedido ya está en preparación en cocina 👩‍🍳.',
    },
    {
      titulo: 'Aviso de motorizado en camino',
      texto: '¡Tu pedido va en camino! 🛵 Nuestro repartidor llegará en aproximadamente 15 a 20 minutos.',
    },
  ];

  for (const rr of respuestasRapidasData) {
    await prisma.respuestaRapida.upsert({
      where: { titulo: rr.titulo },
      update: { texto: rr.texto, activo: true },
      create: { titulo: rr.titulo, texto: rr.texto, activo: true },
    });
    console.log(`Respuesta rápida asegurada: "${rr.titulo}".`);
  }

  // 2. Clientes y Conversaciones de WhatsApp del mockup (CONV0: Ana Pérez, Rosa Díaz, Luis Ramos)
  const convsMock = [
    {
      nombre: 'Ana Pérez',
      telefono: '999888777',
      dni: '10000001',
      duenio: 'PERSONA',
      urgente: true,
      estado: 'ABIERTA',
      modalidad: 'Delivery',
      msgs: [
        { direccion: 'ENTRA', autor: 'CLIENTE', tipo: 'TEXTO', texto: 'Hola' },
        { direccion: 'SALE', autor: 'BOT', tipo: 'TEXTO', texto: '¡Hola! ☕ Soy Capri, la asistente de Caprichos. ¿En qué te puedo ayudar hoy? 🧁' },
        { direccion: 'ENTRA', autor: 'CLIENTE', tipo: 'BOTON', texto: '🙋 Hablar con una persona' },
        { direccion: 'SALE', autor: 'BOT', tipo: 'TEXTO', texto: 'Te paso con alguien del equipo. Ya les avisé con tu nombre y tu número; en unos minutos te escriben.' },
        { direccion: 'ENTRA', autor: 'CLIENTE', tipo: 'TEXTO', texto: 'Mi pedido de ayer llegó sin la salsa' },
      ],
    },
    {
      nombre: 'Rosa Díaz',
      telefono: '977666555',
      dni: '10000002',
      duenio: 'PERSONA',
      urgente: false,
      estado: 'VALIDAR_PAGO',
      modalidad: 'Delivery',
      msgs: [
        { direccion: 'ENTRA', autor: 'CLIENTE', tipo: 'TEXTO', texto: 'Hola' },
        { direccion: 'SALE', autor: 'BOT', tipo: 'TEXTO', texto: '¡Hola! ☕ Soy Capri, la asistente de Caprichos. ¿En qué te puedo ayudar hoy? 🧁' },
        { direccion: 'ENTRA', autor: 'CLIENTE', tipo: 'BOTON', texto: '☕ Hacer un pedido' },
        { direccion: 'SALE', autor: 'BOT', tipo: 'TEXTO', texto: 'Perfecto. ¿Cómo lo quieres?' },
        { direccion: 'ENTRA', autor: 'CLIENTE', tipo: 'BOTON', texto: 'Delivery' },
        { direccion: 'SALE', autor: 'BOT', tipo: 'TEXTO', texto: 'Listo. Recibimos tu pedido CP-0002. Una persona del equipo te escribe por este mismo chat para confirmarlo y ver el pago contigo.' },
        { direccion: 'SALE', autor: 'PERSONA', tipo: 'TEXTO', texto: 'Hola 😊 Soy del equipo de Caprichos. Para pagar por Yape: 987 654 321. El total es s/ 34.50. Envíame aquí la captura, por favor.' },
        { direccion: 'ENTRA', autor: 'CLIENTE', tipo: 'IMAGEN', texto: '[Imagen: comprobante de Yape por S/ 34.50]' },
      ],
    },
    {
      nombre: 'Luis Ramos',
      telefono: '988777666',
      dni: '10000003',
      duenio: 'BOT',
      urgente: false,
      estado: 'ABIERTA',
      modalidad: 'Para llevar',
      msgs: [
        { direccion: 'ENTRA', autor: 'CLIENTE', tipo: 'TEXTO', texto: 'Hola' },
        { direccion: 'SALE', autor: 'BOT', tipo: 'TEXTO', texto: '¡Hola! ☕ Soy Capri, la asistente de Caprichos. ¿En qué te puedo ayudar hoy? 🧁' },
      ],
    },
  ];

  for (const c of convsMock) {
    let partyId: bigint;
    const doc = await prisma.partyIdentifier.findUnique({
      where: { tipo_numero: { tipo: 'DNI', numero: c.dni } },
    });

    if (doc) {
      partyId = doc.party_id;
    } else {
      const p = await prisma.party.create({
        data: {
          tipo: 'PERSONA',
          estado: 'ACTIVO',
          persona: {
            create: {
              nombres: c.nombre.split(' ')[0],
              apellidos: c.nombre.split(' ').slice(1).join(' '),
            },
          },
          documentos: {
            create: {
              tipo: 'DNI',
              numero: c.dni,
            },
          },
          contactos: {
            create: {
              tipo: 'WHATSAPP',
              valor: c.telefono,
              principal: true,
            },
          },
        },
      });
      partyId = p.id;
    }

    const conv = await prisma.conversacion.upsert({
      where: { telefono: c.telefono },
      update: {
        duenio: c.duenio,
        urgente: c.urgente,
        estado: c.estado,
        party_id: partyId,
      },
      create: {
        telefono: c.telefono,
        duenio: c.duenio,
        urgente: c.urgente,
        estado: c.estado,
        party_id: partyId,
      },
    });

    const msgCount = await prisma.mensajeChat.count({
      where: { conversacion_id: conv.id },
    });

    if (msgCount === 0) {
      for (const m of c.msgs) {
        await prisma.mensajeChat.create({
          data: {
            conversacion_id: conv.id,
            direccion: m.direccion,
            autor: m.autor,
            tipo: m.tipo,
            contenido: { texto: m.texto },
          },
        });
      }
      console.log(`Conversación y mensajes registrados para ${c.nombre} (${c.telefono}).`);
    }
  }

  // 3. Encuesta posventa de ejemplo
  const primerPedido = await prisma.pedido.findFirst({
    where: { estado: 'ENTREGADO' },
  });

  if (primerPedido) {
    const encExistente = await prisma.encuesta.findUnique({
      where: { pedido_id: primerPedido.id },
    });

    if (!encExistente) {
      await prisma.encuesta.create({
        data: {
          pedido_id: primerPedido.id,
          nota: 5,
          comentario: 'Excelente atención, las bebidas llegaron bien frías y las donas frescas.',
          enviada_en: new Date('2026-10-15T21:00:00Z'),
          respondida_en: new Date('2026-10-15T21:15:00Z'),
        },
      });
      console.log(`Encuesta posventa registrada para pedido ${primerPedido.codigo}.`);
    }
  }

  console.log('--- Semilla de Atención, WhatsApp y Encuestas finalizada con éxito ---');
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

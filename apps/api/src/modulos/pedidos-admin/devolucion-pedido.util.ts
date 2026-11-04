import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { ESTADO_REPROG, NUMERO_PREGUNTA_REPROG } from '../chatbot/servicios/reprogramacion.service';
import { aCentimos, enPesos } from '../caja/caja.calculo';

/** Pedido cancelado porque el cliente no quiso reprogramar o no respondió (mismo criterio que «No entregados»). */
export const FILTRO_CANCELADO_NO_RECIBIR: Prisma.PedidoWhereInput = {
  estado: 'ANULADO',
  mensajesReparto: {
    some: {
      numero: NUMERO_PREGUNTA_REPROG,
      estado: { in: [ESTADO_REPROG.NO_REPROGRAMAR, ESTADO_REPROG.SIN_RESPUESTA, ESTADO_REPROG.TOPE_ALCANZADO] },
    },
  },
};

/** Pagos que cuentan como dinero recibido para devolver (mismo criterio que «Revisar devolución»). */
export const PAGOS_DEVOLVIBLES = ['PAGADO', 'COORDINADO'];

/** Estados de la baja de un comprobante que cuentan como «ya dado de baja» (no hace falta consultar al contador). */
export const BAJA_HECHA = ['ACEPTADA', 'SOLICITADA', 'PENDIENTE_RESUMEN'];

/** Monto sugerido = lo pagado menos el envío (el repartidor ya salió). Todo en céntimos. */
export function sugerirDevolucion(total: number, envio: number) {
  const pagado = aCentimos(total);
  const envioC = aCentimos(envio);
  return {
    pagado: enPesos(pagado),
    envio: enPesos(envioC),
    sugerido: enPesos(Math.max(0, pagado - envioC)),
  };
}

/** Nombre visible de cada party (persona o «Usuario #id»). Vacío si no hay IDs. */
export async function nombresDePartes(prisma: PrismaService, ids: bigint[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const partes = await prisma.party.findMany({ where: { id: { in: ids } }, include: { persona: true } });
  return new Map(
    partes.map((p) => [
      String(p.id),
      `${p.persona?.nombres ?? ''} ${p.persona?.apellidos ?? ''}`.trim() || `Usuario #${p.id}`,
    ]),
  );
}

/** Forma de salida de una devolución: nombres de quien la registró y de quien la autorizó, no IDs. */
export function salidaDevolucion(
  f: {
    id: bigint;
    pedido_id: bigint;
    monto_devuelto: Prisma.Decimal | number;
    medio: string;
    motivo: string | null;
    comprobante_baja_estado: string | null;
    por_party_id: bigint;
    autorizado_por_party_id: bigint;
    creado_en: Date;
  },
  nombres: Map<string, string>,
) {
  return {
    id: String(f.id),
    montoDevuelto: Number(f.monto_devuelto),
    medio: f.medio,
    motivo: f.motivo,
    porNombre: nombres.get(String(f.por_party_id)) ?? null,
    autorizadoPorNombre: nombres.get(String(f.autorizado_por_party_id)) ?? null,
    comprobanteBajaEstado: f.comprobante_baja_estado,
    creadoEn: f.creado_en,
  };
}

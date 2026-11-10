// Datos de planilla que acompañan a una fila de importación del personal (acuerdo laboral, sueldo, pago, áreas de cocina).
// Se guardan dentro de la MISMA transacción que crea la cuenta: o queda todo o no queda nada de esa fila.

export const ACUERDOS_LABORALES = ['TIEMPO_PARCIAL', 'TIEMPO_COMPLETO', 'TERCERIZADO_MENSUAL'] as const;
export type AcuerdoLaboral = (typeof ACUERDOS_LABORALES)[number];

/** Etiqueta legible del acuerdo, para la nota del vínculo. */
export const ETIQUETA_ACUERDO: Record<AcuerdoLaboral, string> = {
  TIEMPO_PARCIAL: 'Tiempo Parcial',
  TIEMPO_COMPLETO: 'Tiempo Completo',
  TERCERIZADO_MENSUAL: 'Tercerizado Mensual',
};

/** Tiempo Parcial y Tiempo Completo son planilla; Tercerizado Mensual es contrato temporal (sin feriado ×2 ni vacaciones). */
export const vinculoDeAcuerdo = (a: AcuerdoLaboral): 'PLANILLA' | 'CONTRATO_TEMPORAL' => (a === 'TERCERIZADO_MENSUAL' ? 'CONTRATO_TEMPORAL' : 'PLANILLA');

export interface DatosPlanillaImportacion {
  area?: string;
  acuerdoLaboral?: AcuerdoLaboral;
  sueldoMensual?: number;
  tarifaHora?: number;
  diasMes?: number;
  horasDia?: number;
  pagoCelular?: string;
  pagoMedio?: string;
  areasCocina?: string[];
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const quitarTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Área de cocina activa cuyo nombre coincide (sin tildes ni mayúsculas) con el nombre pedido. */
export function areaPorNombre(areas: Array<{ id: bigint; nombre: string }>, nombre: string): bigint | null {
  const q = quitarTildes(nombre);
  return areas.find((a) => quitarTildes(a.nombre) === q)?.id ?? areas.find((a) => quitarTildes(a.nombre).includes(q))?.id ?? null;
}

/**
 * Guarda vínculo, sueldo, datos de pago y áreas de cocina de una persona recién creada. Devuelve avisos
 * (nunca documentos ni celulares). `tx` es el cliente de la transacción de la fila.
 */
export async function guardarDatosPlanillaTx(
  tx: any,
  partyId: bigint,
  userAccountId: bigint,
  rol: string,
  fechaIngreso: Date,
  d: DatosPlanillaImportacion,
): Promise<string[]> {
  const avisos: string[] = [];
  const llevaPlanilla = rol !== 'ADMIN';

  if (d.acuerdoLaboral && llevaPlanilla) {
    const tipo = vinculoDeAcuerdo(d.acuerdoLaboral);
    await tx.vinculoPersonal.create({
      data: {
        party_id: partyId,
        tipo,
        fecha_ingreso: fechaIngreso,
        regimen_vacaciones: tipo === 'PLANILLA' ? 30 : null,
        notas: [d.area ? `Área: ${d.area}` : null, `Acuerdo: ${ETIQUETA_ACUERDO[d.acuerdoLaboral]}`].filter(Boolean).join(' · '),
      },
    });
  }

  if (llevaPlanilla && (d.sueldoMensual !== undefined || d.tarifaHora !== undefined)) {
    const porHora = d.tarifaHora !== undefined && d.sueldoMensual === undefined;
    const mensual = porHora ? 0 : r2(d.sueldoMensual ?? 0);
    await tx.sueldoPersonal.create({
      data: {
        party_id: partyId,
        // Sueldo mensual (el Excel paga por mes); la tarifa por hora no lleva sueldo
        modalidad: porHora ? 'SEMANAL' : 'MENSUAL',
        monto_mensual: mensual,
        monto_semanal: r2((mensual * 12) / 52),
        metodo_valor_hora: porHora ? 'TARIFA_HORA' : 'DIAS_HORAS',
        ...(d.diasMes !== undefined ? { dias_mes: d.diasMes } : {}),
        ...(d.horasDia !== undefined ? { horas_dia: d.horasDia } : {}),
        ...(porHora ? { tarifa_hora: d.tarifaHora } : {}),
        pago_celular: d.pagoCelular ?? null,
        pago_medio: d.pagoMedio ?? null,
      },
    });
  } else if (d.pagoCelular || d.pagoMedio) {
    avisos.push('Sin sueldo ni tarifa: el medio de pago no se guardó');
  }

  if (d.areasCocina?.length) {
    const disponibles: Array<{ id: bigint; nombre: string }> = await tx.areaCocina.findMany({ where: { activo: true }, select: { id: true, nombre: true } });
    const ids = new Set<bigint>();
    for (const nombre of d.areasCocina) {
      const id = areaPorNombre(disponibles, nombre);
      if (id) ids.add(id);
      else avisos.push(`El área de cocina «${nombre}» no existe: asígnala a mano`);
    }
    if (ids.size) await tx.userAccountArea.createMany({ data: [...ids].map((area_id) => ({ user_account_id: userAccountId, area_id })) });
  }
  return avisos;
}

/** Campos de planilla de una fila ya validada; undefined si la fila no trae ninguno. */
export function datosPlanilla(f: DatosPlanillaImportacion): DatosPlanillaImportacion | undefined {
  const d: DatosPlanillaImportacion = {
    area: f.area,
    acuerdoLaboral: f.acuerdoLaboral,
    sueldoMensual: f.sueldoMensual,
    tarifaHora: f.tarifaHora,
    diasMes: f.diasMes,
    horasDia: f.horasDia,
    pagoCelular: f.pagoCelular,
    pagoMedio: f.pagoMedio,
    areasCocina: f.areasCocina,
  };
  return Object.values(d).some((v) => v !== undefined && !(Array.isArray(v) && v.length === 0)) ? d : undefined;
}

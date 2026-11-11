import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AvisosEquipoCorreoService } from '../correo/avisos-equipo-correo.service';
import { momentoLima } from '../correo/destinatarios.util';
import { SunatEmisor } from './sunat/sunat.emisor';
import { VENCIMIENTO_CERTIFICADO_AVISO } from './sunat/sunat.config';

/** Días antes del vencimiento en que sale el correo a los ADMIN. Solo 60 por ahora; para ampliar, agregar 30, 15, 7. */
export const DIAS_AVISO_CORREO_CERTIFICADO = [60];

const DIA_MS = 86_400_000;
const REVISION_MS = DIA_MS;

export interface AvisoCertificado {
  /** Clave única (por fecha de vencimiento y umbral): un correo por destinatario, aunque la tarea corra cada día. */
  clave: string;
  asunto: string;
  texto: string;
}

/** Aviso que corresponde hoy, o null si faltan más días que el umbral más lejano. Puro: sin base de datos. */
export function avisoCertificado(vence: Date, ahora: Date): AvisoCertificado | null {
  const dias = Math.floor((vence.getTime() - ahora.getTime()) / DIA_MS);
  const cruzados = DIAS_AVISO_CORREO_CERTIFICADO.filter((d) => dias <= d);
  if (cruzados.length === 0) return null;
  const umbral = Math.min(...cruzados);
  const fecha = momentoLima(vence).fecha;
  const [a, m, d] = fecha.split('-');
  const ddmmyyyy = `${d}/${m}/${a}`;
  const vencido = dias < 0;
  const estado = vencido
    ? `Ya venció hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}: los comprobantes electrónicos no se pueden enviar a SUNAT hasta cargar uno nuevo.`
    : `Faltan ${dias} ${dias === 1 ? 'día' : 'días'} para que venza.`;
  return {
    clave: `cert-sunat-venc:${fecha}:${umbral}d`,
    asunto: `Renovar el certificado digital de SUNAT (vence el ${ddmmyyyy})`,
    texto: [
      'Hola,',
      '',
      `El certificado digital con el que Caprichos emite boletas y facturas electrónicas ante SUNAT vence el ${ddmmyyyy}.`,
      estado,
      '',
      'Qué hacer:',
      '1. Renovar el certificado digital con la entidad certificadora.',
      '2. Cargar el nuevo certificado en el servidor: actualizar los secretos SUNAT_CERT_P12_B64 y SUNAT_CERT_CLAVE.',
      '3. Ejecutar la acción configurar-sunat y revisar Comprobantes > Electrónicos.',
      '',
      'Este aviso llega una sola vez por cada fecha de vencimiento. No incluye claves ni datos del certificado.',
    ].join('\n'),
  };
}

/**
 * Tarea diaria: si el certificado SUNAT vence en 60 días o menos (o ya venció), avisa por correo a los ADMIN con casilla.
 * Sin lectura del certificado usa VENCIMIENTO_CERTIFICADO_AVISO. No depende del horario de turno.
 * ponytail: setInterval por proceso; con varias réplicas la clave única de correo_envio evita el doble envío.
 */
@Injectable()
export class ComprobantesCertificadoAvisoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ComprobantesCertificadoAvisoService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly sunat: SunatEmisor,
    private readonly correo: AvisosEquipoCorreoService,
  ) {}

  onModuleInit() {
    this.ejecutar().catch((e) => this.logger.error(`Aviso de certificado: ${e?.message ?? e}`));
    this.timer = setInterval(() => {
      this.ejecutar().catch((e) => this.logger.error(`Aviso de certificado: ${e?.message ?? e}`));
    }, REVISION_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Una revisión. Devuelve el resultado del envío, o null si hoy no toca avisar. */
  async ejecutar(ahora = new Date()) {
    const vence = this.sunat.certificadoVence() ?? new Date(`${VENCIMIENTO_CERTIFICADO_AVISO}T12:00:00Z`);
    const aviso = avisoCertificado(vence, ahora);
    if (!aviso) return null;
    return this.correo.avisarAdministradores({ clave: aviso.clave, origen: 'CERTIFICADO_SUNAT', tipo: 'COMPROBANTES', asunto: aviso.asunto, texto: aviso.texto });
  }
}

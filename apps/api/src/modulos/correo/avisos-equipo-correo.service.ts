import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { CorreoService, ResultadoCorreo } from './correo.service';
import {
  CoberturaDia,
  PersonaTurno,
  elegirDestinatarios,
  minutosDeHora,
  momentoLima,
} from './destinatarios.util';

export interface AvisoEquipo {
  clave: string;
  origen: string;
  asunto: string;
  texto: string;
  ahora?: Date;
}

/** Avisos del sistema al equipo por correo: solo a quien tiene la casilla y está de turno (o 24/7 si nadie lo está). */
@Injectable()
export class AvisosEquipoCorreoService {
  private readonly logger = new Logger(AvisosEquipoCorreoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
  ) {}

  /** Nunca lanza: si algo falla, el aviso queda en el log y el flujo que lo originó sigue. */
  async avisar(aviso: AvisoEquipo): Promise<ResultadoCorreo | null> {
    try {
      const momento = momentoLima(aviso.ahora ?? new Date());
      const { personas, correos, coberturas } = await this.cargar(momento.fecha);
      const ids = elegirDestinatarios(momento, personas, coberturas);
      const destinatarios = ids.map((id) => correos.get(id)).filter((c): c is string => !!c);
      return await this.correo.enviar({
        clave: aviso.clave,
        origen: aviso.origen,
        asunto: aviso.asunto,
        texto: aviso.texto,
        destinatarios,
      });
    } catch (err: any) {
      this.logger.error(JSON.stringify({ evento: 'correo_aviso_error', origen: aviso.origen, error: err?.message ?? 'DESCONOCIDO' }));
      return null;
    }
  }

  private async cargar(fecha: string) {
    const cuentas = await this.prisma.userAccount.findMany({
      where: { activo: true },
      select: {
        party_id: true,
        avisos_correo: true,
        party: {
          select: {
            persona: { select: { correo: true, horario_24_7: true } },
            horariosTrabajo: { where: { activo: true }, select: { dia_semana: true, entrada: true, salida: true } },
            reemplazosDia: { where: { activo: true }, select: { dia_semana: true, reemplaza_party_id: true } },
          },
        },
      },
    });
    const coberturasHoy = await this.prisma.coberturaTurno.findMany({
      where: { fecha: new Date(`${fecha}T00:00:00.000Z`) },
      select: { cubre_party_id: true, reemplaza_party_id: true, desde: true, hasta: true },
    });

    const correos = new Map<string, string>();
    const personas: PersonaTurno[] = cuentas.map((c) => {
      const id = c.party_id.toString();
      const correo = c.party?.persona?.correo?.trim().toLowerCase();
      if (correo) correos.set(id, correo);
      return {
        partyId: id,
        conCasilla: c.avisos_correo,
        h247: Boolean(c.party?.persona?.horario_24_7),
        horarios: (c.party?.horariosTrabajo ?? []).map((h) => ({
          dia: h.dia_semana,
          entrada: minutosDeHora(h.entrada),
          salida: minutosDeHora(h.salida),
        })),
        fijos: (c.party?.reemplazosDia ?? []).map((r) => ({
          dia: r.dia_semana,
          reemplazaId: r.reemplaza_party_id.toString(),
        })),
      };
    });
    const coberturas: CoberturaDia[] = coberturasHoy.map((c) => ({
      cubreId: c.cubre_party_id.toString(),
      reemplazaId: c.reemplaza_party_id?.toString() ?? null,
      desde: minutosDeHora(c.desde),
      hasta: minutosDeHora(c.hasta),
    }));
    return { personas, correos, coberturas };
  }
}

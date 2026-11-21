import { Controller, Get, Header, HttpException, HttpStatus, Req } from '@nestjs/common';
import { PantallaLocalService, RespuestaPantalla } from './pantalla-local.service';

const VENTANA_MS = 60000;
const MAX_POR_VENTANA = 60; // una pantalla consulta cada 5 s (12 por minuto): sobra margen
const visitas = new Map<string, { n: number; desde: number }>();

/** Límite por IP en memoria. ponytail: por instancia; si se escala a varias, moverlo a Redis. */
export function pasaLimite(ip: string, ahora = Date.now()): boolean {
  const v = visitas.get(ip);
  if (!v || ahora - v.desde > VENTANA_MS) {
    if (visitas.size > 5000) visitas.clear();
    visitas.set(ip, { n: 1, desde: ahora });
    return true;
  }
  v.n += 1;
  return v.n <= MAX_POR_VENTANA;
}

/** Público y de solo lectura: lo que muestra la TV del local (sin datos personales). */
@Controller('carta/pantalla')
export class PantallaLocalController {
  constructor(private readonly servicio: PantallaLocalService) {}

  @Get('pedidos')
  @Header('Cache-Control', 'public, max-age=5')
  async pedidos(@Req() req: any): Promise<RespuestaPantalla> {
    const ip = String(req?.ip ?? 'desconocida');
    if (!pasaLimite(ip)) {
      throw new HttpException({ codigo: 'DEMASIADAS_CONSULTAS', mensaje: 'Demasiadas consultas, espera un momento' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.servicio.pedidos();
  }
}

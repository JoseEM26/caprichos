import { Controller, Get, Header, HttpException, HttpStatus, Param, Req } from '@nestjs/common';
import { AsistenciaService } from './asistencia.service';

// ponytail: límite en memoria por IP (un proceso). Con varias instancias, moverlo a Redis.
const VENTANA_MS = 60_000;
const MAX_POR_VENTANA = 60; // la tablet pide 1 QR cada 30 s; sobra
const pedidosPorIp = new Map<string, number[]>();

function limitar(ip: string): void {
  const ahora = Date.now();
  const lista = (pedidosPorIp.get(ip) ?? []).filter((t) => t > ahora - VENTANA_MS);
  lista.push(ahora);
  pedidosPorIp.set(ip, lista);
  if (lista.length > MAX_POR_VENTANA) {
    throw new HttpException({ codigo: 'DEMASIADAS_PETICIONES', mensaje: 'Espera un momento.' }, HttpStatus.TOO_MANY_REQUESTS);
  }
}

/**
 * Pantalla del local sin sesión: el acceso lo da el enlace secreto (token en la ruta).
 * No se loguea el token; la respuesta solo lleva el QR, la ranura y el tiempo que falta.
 */
@Controller('carta/asistencia-pantalla')
export class AsistenciaPantallaPublicaController {
  constructor(private readonly asistencia: AsistenciaService) {}

  @Get(':token/qr')
  @Header('Cache-Control', 'no-store')
  qr(@Param('token') token: string, @Req() req: any) {
    limitar((req.ip || req.headers?.['x-forwarded-for'] || 'desconocida') as string);
    return this.asistencia.qrPantallaPublica(token);
  }
}

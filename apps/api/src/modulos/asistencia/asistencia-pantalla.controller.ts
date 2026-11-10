import { Body, Controller, Get, Header, HttpCode, HttpException, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { MarcarWebDto } from './dto/asistencia.dto';
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

  @Get(':token/manifest.webmanifest')
  @Header('Content-Type', 'application/manifest+json; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  manifest(@Param('token') token: string, @Req() req: any) {
    limitar((req.ip || req.headers?.['x-forwarded-for'] || 'desconocida') as string);
    return this.asistencia.manifestPantallaPublica(token);
  }
}

/**
 * Marcar sin celular, sin sesión previa: usuario y contraseña de Caprichos. No abre sesión ni devuelve token.
 * El límite por IP de la página se suma al bloqueo por intentos del servicio.
 */
@Controller('carta/asistencia-web')
export class AsistenciaMarcaWebController {
  constructor(private readonly asistencia: AsistenciaService) {}

  @Post('marcar')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  marcar(@Body() dto: MarcarWebDto, @Req() req: any) {
    const ip = ((req.ip || req.headers?.['x-forwarded-for'] || 'desconocida') as string).split(',')[0].trim();
    limitar(ip);
    return this.asistencia.marcarWeb(dto, ip);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ResultadoDireccion {
  texto: string;
  lat: number;
  lng: number;
}

export interface RespuestaBusqueda {
  resultados: ResultadoDireccion[];
  /** true cuando la búsqueda está apagada (tope, límite o falla): el cliente toca el mapa (ADR-010) */
  apagado: boolean;
}

const TTL_CACHE_MS = 10 * 60 * 1000;
const POR_IP_POR_MINUTO = 20;
// Zona de Lima Metropolitana para priorizar resultados (lng1,lat1,lng2,lat2)
const VISTA_LIMA = '-77.20,-11.75,-76.70,-12.30';

/**
 * Buscador de direcciones. Pasa por la API para cumplir la política de uso de Nominatim
 * (identificación, 1 consulta por segundo, caché) y para topar el uso diario (ADR-010).
 * ponytail: caché y contadores en memoria de un solo proceso; pasar a Redis si hay varias instancias.
 */
@Injectable()
export class DireccionesService {
  private readonly logger = new Logger(DireccionesService.name);
  private readonly cache = new Map<string, { vence: number; resultados: ResultadoDireccion[] }>();
  private readonly porIp = new Map<string, { minuto: number; n: number }>();
  private dia = '';
  private consultasDelDia = 0;
  private cola: Promise<unknown> = Promise.resolve();

  constructor(private readonly config: ConfigService) {}

  async buscar(q: string, ip = 'desconocida'): Promise<RespuestaBusqueda> {
    const clave = q.trim().toLowerCase().replace(/\s+/g, ' ');
    const enCache = this.cache.get(clave);
    if (enCache && enCache.vence > Date.now()) {
      return { resultados: enCache.resultados, apagado: false };
    }
    if (!this.permitirIp(ip) || !this.hayCupoDiario()) {
      return { resultados: [], apagado: true };
    }

    try {
      const resultados = await this.encolar(() => this.consultar(clave));
      this.cache.set(clave, { vence: Date.now() + TTL_CACHE_MS, resultados });
      if (this.cache.size > 500) this.cache.delete(this.cache.keys().next().value as string);
      return { resultados, apagado: false };
    } catch (err) {
      this.logger.warn(`Búsqueda de direcciones no disponible: ${(err as Error).message}`);
      return { resultados: [], apagado: true };
    }
  }

  private permitirIp(ip: string): boolean {
    const minuto = Math.floor(Date.now() / 60000);
    const reg = this.porIp.get(ip);
    if (!reg || reg.minuto !== minuto) {
      this.porIp.set(ip, { minuto, n: 1 });
      if (this.porIp.size > 2000) this.porIp.clear();
      return true;
    }
    reg.n += 1;
    return reg.n <= POR_IP_POR_MINUTO;
  }

  private hayCupoDiario(): boolean {
    const hoy = new Date().toISOString().slice(0, 10);
    if (hoy !== this.dia) {
      this.dia = hoy;
      this.consultasDelDia = 0;
    }
    const tope = Number(this.config.get('DIRECCIONES_TOPE_DIARIO', 1000));
    if (this.consultasDelDia >= tope) return false;
    this.consultasDelDia += 1;
    return true;
  }

  /** Una consulta por segundo hacia el proveedor */
  private encolar<T>(fn: () => Promise<T>): Promise<T> {
    const turno = this.cola.then(fn, fn);
    const pausa = () =>
      new Promise((r) => setTimeout(r, Number(this.config.get('DIRECCIONES_INTERVALO_MS', 1000))));
    this.cola = turno.then(pausa, pausa);
    return turno;
  }

  private async consultar(q: string): Promise<ResultadoDireccion[]> {
    const base = this.config.get<string>('NOMINATIM_URL', 'https://nominatim.openstreetmap.org');
    const contacto = this.config.get<string>('DIRECCIONES_CONTACTO', 'caprichos-cafe');
    const url =
      `${base}/search?format=jsonv2&limit=5&countrycodes=pe&viewbox=${VISTA_LIMA}` +
      `&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': `Caprichos/1.0 (${contacto})`, 'Accept-Language': 'es' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const datos = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
    return datos
      .map((d) => ({ texto: d.display_name, lat: Number(d.lat), lng: Number(d.lon) }))
      .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng));
  }
}

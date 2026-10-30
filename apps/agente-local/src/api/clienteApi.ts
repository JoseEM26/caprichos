import type {
  TrabajoImpresion,
  EstadoImpresora,
  PeticionTomarTrabajos,
  RespuestaTomarTrabajos,
  PeticionResultadoTrabajo,
  PeticionLatido,
  RolImpresora,
  ImpresoraReportada,
} from '@caprichos/compartido';

export interface IClienteApiImpresion {
  tomarTrabajos(max?: number, roles?: RolImpresora[]): Promise<TrabajoImpresion[]>;
  reportarResultado(id: string, ok: boolean, error?: string): Promise<void>;
  enviarLatido(
    version: string,
    impresora: EstadoImpresora,
    detalle?: string,
    impresoras?: ImpresoraReportada[]
  ): Promise<void>;
}

/** Canjea el código de vinculación (CODIGO o CODIGO@host) por la llave del agente. Sin llave previa. */
export async function canjearCodigoVinculo(
  apiUrlPorDefecto: string,
  codigoCrudo: string,
  fetchFn: typeof fetch = fetch
): Promise<{ apiUrl: string; llave: string }> {
  const [codigo, host] = codigoCrudo.trim().split('@');
  const apiUrl = host ? `https://${host.replace(/^https?:\/\//, '').replace(/\/+$/, '')}` : apiUrlPorDefecto;
  const res = await fetchFn(`${apiUrl}/api/agente-impresion/vincular`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo }),
  });
  if (!res.ok) {
    const cuerpo: any = await res.json().catch(() => ({}));
    throw new Error(cuerpo?.mensaje || `No se pudo vincular (HTTP ${res.status})`);
  }
  const datos = (await res.json()) as { llave: string };
  return { apiUrl, llave: datos.llave };
}

export class ErrorRedApi extends Error {
  constructor(mensaje: string, public readonly causaOriginal?: unknown) {
    super(mensaje);
    this.name = 'ErrorRedApi';
  }
}

export class ErrorRespuestaApi extends Error {
  constructor(
    public readonly status: number,
    mensaje: string,
    public readonly cuerpo?: string
  ) {
    super(`API respondió con estado HTTP ${status}: ${mensaje}`);
    this.name = 'ErrorRespuestaApi';
  }
}

export class ClienteApiImpresion implements IClienteApiImpresion {
  constructor(
    private readonly apiUrl: string,
    private readonly agenteKey: string,
    private readonly timeoutMs: number = 8000
  ) {}

  private obtenerCabeceras(): Record<string, string> {
    const cabeceras: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.agenteKey) {
      cabeceras['Authorization'] = `Bearer ${this.agenteKey}`;
    }
    return cabeceras;
  }

  private async ejecutarPeticion(
    ruta: string,
    metodo: string,
    cuerpo?: unknown
  ): Promise<Response> {
    const url = `${this.apiUrl}${ruta}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const respuesta = await fetch(url, {
        method: metodo,
        headers: this.obtenerCabeceras(),
        body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
        signal: controller.signal,
      });
      return respuesta;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new ErrorRedApi(
          `Tiempo de espera agotado (${this.timeoutMs} ms) al conectar con ${url}`,
          err
        );
      }
      throw new ErrorRedApi(
        `Error de red al conectar con la API (${url}): ${err.message}`,
        err
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async tomarTrabajos(max: number = 10, roles?: RolImpresora[]): Promise<TrabajoImpresion[]> {
    const peticion: PeticionTomarTrabajos = roles ? { max, roles } : { max };
    const res = await this.ejecutarPeticion(
      '/api/agente-impresion/tomar',
      'POST',
      peticion
    );

    if (!res.ok) {
      const texto = await res.text().catch(() => '');
      throw new ErrorRespuestaApi(res.status, 'Error al tomar trabajos', texto);
    }

    const datos = (await res.json()) as RespuestaTomarTrabajos;
    return datos.trabajos || [];
  }

  async reportarResultado(
    id: string,
    ok: boolean,
    error?: string
  ): Promise<void> {
    const peticion: PeticionResultadoTrabajo = { id, ok, error };
    const res = await this.ejecutarPeticion(
      '/api/agente-impresion/resultado',
      'POST',
      peticion
    );

    if (!res.ok && res.status !== 204) {
      const texto = await res.text().catch(() => '');
      throw new ErrorRespuestaApi(
        res.status,
        'Error al reportar resultado',
        texto
      );
    }
  }

  async enviarLatido(
    version: string,
    impresora: EstadoImpresora,
    detalle?: string,
    impresoras?: ImpresoraReportada[]
  ): Promise<void> {
    const peticion: PeticionLatido = { version, impresora, detalle, ...(impresoras ? { impresoras } : {}) };
    const res = await this.ejecutarPeticion(
      '/api/agente-impresion/latido',
      'POST',
      peticion
    );

    if (!res.ok && res.status !== 204) {
      const texto = await res.text().catch(() => '');
      throw new ErrorRespuestaApi(res.status, 'Error al enviar latido', texto);
    }
  }
}

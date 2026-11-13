import { codigoDeError, mensajeDeError } from './culqi.errores';
import { CargoConsultado, CargoHecho, ErrorPasarela, PasarelaPago, PedirCargo, PedirDevolucion } from './pasarela.puerto';

export interface OpcionesCulqi {
  secretKey: string;
  publicKey: string;
  /** Por defecto https://api.culqi.com/v2 */
  apiUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

/** Adaptador HTTP de Culqi. La llave secreta solo viaja en la cabecera Authorization: nunca se registra ni se devuelve. */
export class CulqiAdaptador implements PasarelaPago {
  readonly modo = 'REAL' as const;
  readonly publicKey: string;
  private readonly secretKey: string;
  private readonly apiUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(o: OpcionesCulqi) {
    this.secretKey = o.secretKey;
    this.publicKey = o.publicKey;
    this.apiUrl = (o.apiUrl || 'https://api.culqi.com/v2').replace(/\/$/, '');
    this.timeoutMs = o.timeoutMs ?? 15000;
    this.fetchFn = o.fetchFn ?? fetch;
  }

  private async llamar(ruta: string, cuerpo?: unknown): Promise<{ status: number; json: any }> {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), this.timeoutMs);
    try {
      const r = await this.fetchFn(`${this.apiUrl}${ruta}`, {
        method: cuerpo === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.secretKey}` },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        signal: ctl.signal,
      });
      const json = await r.json().catch(() => null);
      return { status: r.status, json };
    } catch {
      // Sin detalle de la causa: podría incluir la URL o cabeceras
      throw new ErrorPasarela('Sin respuesta de Culqi');
    } finally {
      clearTimeout(t);
    }
  }

  async cargar(p: PedirCargo): Promise<CargoHecho> {
    const { status, json } = await this.llamar('/charges', {
      amount: p.montoCentimos,
      currency_code: p.moneda,
      email: p.email,
      source_id: p.token,
      description: p.descripcion.slice(0, 80),
      metadata: p.metadata,
      ...(p.deviceId ? { antifraud_details: { device_finger_print_id: p.deviceId.slice(0, 200) } } : {}),
      ...cuerpo3ds(p.autenticacion3ds),
    });
    if (status >= 500 || !json) throw new ErrorPasarela(`Culqi respondió ${status}`);
    if (status >= 400 || json.object === 'error') {
      return { estado: 'RECHAZADO', cargoId: null, marca: null, ultimos4: null, codigo: codigoDeError(json) || undefined, mensaje: mensajeDeError(json) };
    }
    // 3DS: el primer cargo responde 200 con action_code REVIEW (en vez de 201). No es un rechazo.
    if (esRevisionDe3ds(status, json)) {
      return { estado: 'REQUIERE_3DS', cargoId: null, marca: null, ultimos4: null, mensaje: 'Tu banco necesita confirmar que eres tú.' };
    }
    const tarjeta = json.source ?? {};
    const num = String(tarjeta.card_number ?? '');
    const base = {
      cargoId: typeof json.id === 'string' ? json.id : null,
      marca: tarjeta.iin?.card_brand ?? null,
      ultimos4: /^\d{4}$/.test(num.slice(-4)) ? num.slice(-4) : (tarjeta.last_four ?? null),
    };
    if (json.outcome?.type === 'venta_exitosa') return { ...base, estado: 'APROBADO', mensaje: 'Pago aprobado.' };
    // 2xx sin venta exitosa (p. ej. en revisión): no se cobra ni se rechaza hasta que llegue el webhook
    return { ...base, estado: 'PENDIENTE', mensaje: 'Estamos confirmando tu pago. Te avisaremos en unos minutos.' };
  }

  async consultarCargo(cargoId: string): Promise<CargoConsultado | null> {
    if (!/^[A-Za-z0-9_]{3,80}$/.test(cargoId)) return null;
    const { status, json } = await this.llamar(`/charges/${cargoId}`);
    if (status === 404) return null;
    if (status >= 400 || !json || json.object === 'error') throw new ErrorPasarela(`Culqi respondió ${status}`);
    const ok = json.outcome?.type === 'venta_exitosa';
    return {
      cargoId: String(json.id ?? cargoId),
      estado: ok ? 'APROBADO' : 'PENDIENTE',
      montoCentimos: Number(json.amount),
      moneda: String(json.currency_code ?? ''),
      metadata: json.metadata && typeof json.metadata === 'object' ? json.metadata : {},
      devueltoCentimos: Number(json.amount_refunded ?? 0) || 0,
    };
  }

  async devolver(p: PedirDevolucion): Promise<{ devolucionId: string }> {
    const { status, json } = await this.llamar('/refunds', {
      amount: p.montoCentimos,
      charge_id: p.cargoId,
      reason: 'solicitud_comprador',
      metadata: { motivo: p.motivo.slice(0, 200) },
    });
    if (status >= 400 || !json || json.object === 'error' || typeof json.id !== 'string') {
      throw new ErrorPasarela(String(json?.merchant_message ?? json?.user_message ?? `Culqi respondió ${status}`).slice(0, 200));
    }
    return { devolucionId: json.id };
  }
}

/**
 * DUDA 3DS (aislado aquí): verificado en los demos oficiales culqi-python-demo-checkoutv4-culqi3ds y
 * culqi-java-demo-checkoutv4-culqi3ds: el primer POST /charges responde HTTP 200 con action_code === 'REVIEW' cuando
 * pide 3DS (201 = cargo hecho). El reintento lleva `authentication_3DS` con lo que entrega Culqi3DS
 * (parameters3DS: cavv, directoryServerTransactionId, eci, protocolVersion, xid; DTO Authentication3DS del demo Java).
 * Falta confirmar con una prueba en integración si Culqi agrega otros campos.
 */
function esRevisionDe3ds(status: number, json: any): boolean {
  return status === 200 && json?.action_code === 'REVIEW';
}

const CAMPOS_3DS = ['cavv', 'directoryServerTransactionId', 'eci', 'protocolVersion', 'xid'];

function cuerpo3ds(a?: Record<string, unknown>): { authentication_3DS?: Record<string, string> } {
  if (!a || typeof a !== 'object') return {};
  const out: Record<string, string> = {};
  for (const k of CAMPOS_3DS) if (typeof a[k] === 'string' && (a[k] as string).length <= 200) out[k] = a[k] as string;
  return Object.keys(out).length ? { authentication_3DS: out } : {};
}

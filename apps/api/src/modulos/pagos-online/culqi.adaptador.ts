import { CargoHecho, ErrorPasarela, PasarelaPago, PedirCargo, PedirDevolucion } from './pasarela.puerto';

const MENSAJE_GENERICO = 'No pudimos procesar tu pago. Revisa los datos o prueba con otro medio.';

/** Códigos de error de Culqi -> texto simple para el cliente. */
const MENSAJES: Record<string, string> = {
  card_declined: 'Tu tarjeta fue rechazada. Prueba con otra tarjeta o con Yape.',
  insufficient_funds: 'Tu tarjeta no tiene fondos suficientes. Prueba con otra tarjeta o con Yape.',
  expired_card: 'Tu tarjeta está vencida. Prueba con otra tarjeta.',
  incorrect_cvv: 'El código de seguridad (CVV) no es correcto.',
  invalid_cvv: 'El código de seguridad (CVV) no es correcto.',
  incorrect_number: 'El número de tarjeta no es correcto.',
  invalid_number: 'El número de tarjeta no es correcto.',
  stolen_card: 'Tu banco no autorizó este pago. Prueba con otra tarjeta o con Yape.',
  lost_card: 'Tu banco no autorizó este pago. Prueba con otra tarjeta o con Yape.',
  processing_error: 'Hubo un problema al procesar el pago. Intenta de nuevo en unos minutos.',
};

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

  private async llamar(ruta: string, cuerpo: unknown): Promise<{ status: number; json: any }> {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), this.timeoutMs);
    try {
      const r = await this.fetchFn(`${this.apiUrl}${ruta}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.secretKey}` },
        body: JSON.stringify(cuerpo),
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
    });
    if (status >= 500 || !json) throw new ErrorPasarela(`Culqi respondió ${status}`);
    if (status >= 400 || json.object === 'error') {
      const codigo = String(json.code ?? json.decline_code ?? '');
      return { estado: 'RECHAZADO', cargoId: null, marca: null, ultimos4: null, mensaje: MENSAJES[codigo] ?? MENSAJE_GENERICO };
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

import { api } from '../../comun/api';

/** Estado del cargo que pide autenticación 3DS (nombre acordado con el backend). */
export const ESTADO_3DS = 'REQUIERE_3DS' as const;

export type MedioCulqi = 'TARJETA' | 'YAPE';
/** Nombre del medio en pago.metodo al crear el pedido (lo acepta el backend). */
export const METODO_CULQI = 'CULQI' as const;

export type MedioDevolucion = 'CULQI' | 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TRANSFERENCIA';

export type ModoCulqi = 'SIMULADO' | 'REAL';

export interface ConfigCulqi {
  activo: boolean;
  publicKey: string | null;
  modo: ModoCulqi;
  medios: MedioCulqi[];
}

export interface IntentoCulqi {
  intentoId: string;
  montoCentimos: number;
  moneda: 'PEN';
  descripcion: string;
  publicKey: string | null;
  modo: ModoCulqi;
  medios: MedioCulqi[];
}

export interface ResultadoCargo {
  estado: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE' | typeof ESTADO_3DS;
  mensaje: string;
  pedidoCodigo: string;
  /** Código de Culqi (p. ej. insufficient_funds) cuando se rechaza. */
  codigo?: string;
  /** Datos para autenticar 3DS (el nombre exacto lo confirma el backend). */
  datos3ds?: { montoCentimos?: number; email?: string };
}

export interface PagoOnline {
  id: string;
  pedidoCodigo: string;
  monto: number;
  medio: string;
  estado: string;
  culqiId: string | null;
  creadoEn: string;
  devuelto: boolean;
  pedidoEstado?: string;
  montoDevuelto?: number;
  devoluciones?: { monto: number; medio: string; en: string }[];
  /** Cobrado en Culqi pero aún sin registrar en Caja. */
  cobroPendiente?: boolean;
  modo?: ModoCulqi;
}

export interface FiltrosPagosOnline {
  desde?: string;
  hasta?: string;
  estado?: string;
  pagina?: number;
}

export const culqiApi = {
  config: () => api.get<ConfigCulqi>('/carta/pagos/culqi/config'),
  intento: (pedidoId: string, seguimientoToken?: string) =>
    api.post<IntentoCulqi>('/carta/pagos/culqi/intento', { pedidoId, ...(seguimientoToken ? { seguimientoToken } : {}) }),
  cargo: (cuerpo: { intentoId: string; token: string; medio: MedioCulqi; email?: string; autenticacion3ds?: unknown }) =>
    api.post<ResultadoCargo>('/carta/pagos/culqi/cargo', cuerpo),
  listar: (f: FiltrosPagosOnline) => {
    const q = new URLSearchParams();
    (['desde', 'hasta', 'estado'] as const).forEach((k) => f[k] && q.set(k, f[k]!));
    q.set('pagina', String(f.pagina ?? 1));
    return api.get<{ items: PagoOnline[]; total: number }>(`/admin/pagos-online?${q}`);
  },
  devolver: (id: string, cuerpo: { monto?: number; motivo: string; medio: MedioDevolucion; confirmar?: boolean }) =>
    api.post(`/admin/pagos-online/${encodeURIComponent(id)}/devolver`, cuerpo),
};

export const URL_CULQI = 'https://checkout.culqi.com/js/v4';
const COLOR_AZUL = '#0B2C3E';
const COLOR_NARANJA = '#E67929';

/** Carga un script externo una sola vez y bajo demanda. */
export function cargarScript(url: string, memo?: { p: Promise<void> | null }): Promise<void> {
  const m = memo ?? { p: null };
  if (m.p) return m.p;
  m.p = new Promise<void>((ok, fallo) => {
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => {
      m.p = null;
      s.remove();
      fallo(new Error('No se pudo cargar el pago. Revisa tu conexión.'));
    };
    document.head.appendChild(s);
  });
  return m.p;
}
const memoCulqi = { p: null as Promise<void> | null };
export const cargarScriptCulqi = () => cargarScript(URL_CULQI, memoCulqi);

/** Opciones de Culqi Checkout V4: solo tarjeta y Yape; los medios con orden quedan apagados. */
export function opcionesCulqi(medios: MedioCulqi[]) {
  return {
    lang: 'auto',
    paymentMethods: {
      tarjeta: medios.includes('TARJETA'),
      yape: medios.includes('YAPE'),
      bancaMovil: false,
      agente: false,
      billetera: false,
      cuotealo: false,
    },
    style: {
      logo: `${window.location.origin}/logo.webp`,
      bannerColor: COLOR_AZUL,
      buttonBackground: COLOR_NARANJA,
      menuColor: COLOR_AZUL,
      linksColor: COLOR_NARANJA,
      buttonText: 'Pagar',
      buttonTextColor: COLOR_AZUL,
      priceColor: COLOR_NARANJA,
    },
  };
}

const MENSAJES_ERROR: Record<string, string> = {
  insufficient_funds: 'fondos insuficientes',
  incorrect_cvv: 'el código de seguridad (CVV) no es correcto',
  stolen_card: 'la tarjeta está bloqueada',
  lost_card: 'la tarjeta está bloqueada',
  fraudulent: 'el banco no autorizó esta compra',
  issuer_decline_operation: 'el banco no autorizó esta operación',
  processing_error: 'hubo un error al procesar la tarjeta, intenta de nuevo',
  invalid_card: 'la tarjeta no es válida',
  contact_issuer: 'comunícate con tu banco',
  issuer_not_available: 'tu banco no responde ahora, intenta en unos minutos',
};

/** Mensaje simple para el cliente según el código de Culqi; si no se conoce, el del servidor. */
export function mensajeRechazo(codigo?: string, mensajeServidor?: string): string {
  const m = codigo ? MENSAJES_ERROR[codigo] : undefined;
  if (m) return `Tu banco rechazó el pago: ${m}.`;
  return mensajeServidor || 'No se pudo cobrar el pago.';
}

/** Abre Culqi Checkout V4 y devuelve el token (o null si el cliente cierra sin pagar). */
export async function abrirCulqi(intento: IntentoCulqi): Promise<{ token: string; medio: MedioCulqi; email?: string } | null> {
  await cargarScriptCulqi();
  const C = (window as any).Culqi;
  if (!C) throw new Error('No se pudo cargar el pago. Intenta de nuevo.');
  return new Promise((resolver, rechazar) => {
    C.publicKey = intento.publicKey;
    C.settings({ title: 'Caprichos', currency: intento.moneda, amount: intento.montoCentimos });
    C.options(opcionesCulqi(intento.medios));
    (window as any).culqi = () => {
      if (C.token?.id) {
        const tk = C.token;
        C.close();
        resolver({ token: tk.id, medio: tk.type === 'yape' || String(tk.id).startsWith('ype_') ? 'YAPE' : 'TARJETA', email: tk.email });
      } else if (C.error) {
        C.close();
        rechazar(new Error(mensajeRechazo(C.error.code ?? C.error.decline_code, C.error.merchant_message)));
      } else {
        C.close();
        resolver(null);
      }
    };
    C.open();
  });
}

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
  datos3ds?: { montoCentimos?: number; moneda?: string; email?: string; publicKey?: string };
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
  pedidoId?: string;
  marca?: string | null;
  ultimos4?: string | null;
  aprobadoEn?: string | null;
  modo?: ModoCulqi;
  /** Solo en el panel admin: comisión de la pasarela (la asume el local) y neto */
  comision?: number | null;
  neto?: number | null;
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
  cargo: (cuerpo: { intentoId: string; token: string; medio: MedioCulqi; email?: string; autenticacion3ds?: unknown; deviceId?: string }) =>
    api.post<ResultadoCargo>('/carta/pagos/culqi/cargo', cuerpo),
  cambiarMedio: (pedidoId: string, medio: string, seguimientoToken?: string) =>
    api.post<{ ok: boolean; estado: string; medio: string; mensaje: string }>('/carta/pagos/culqi/cambiar-medio', {
      pedidoId,
      medio,
      ...(seguimientoToken ? { seguimientoToken } : {}),
    }),
  listar: (f: FiltrosPagosOnline) => {
    const q = new URLSearchParams();
    (['desde', 'hasta', 'estado'] as const).forEach((k) => f[k] && q.set(k, f[k]!));
    q.set('pagina', String(f.pagina ?? 1));
    return api.get<{ items: PagoOnline[]; total: number; totalAprobado?: number; totalDevuelto?: number; totalComision?: number; totalNeto?: number; comisionPorConfirmar?: number }>(`/admin/pagos-online?${q}`);
  },
  devolver: (id: string, cuerpo: { monto?: number; motivo: string; medio: MedioDevolucion; confirmar?: boolean }) =>
    api.post(`/admin/pagos-online/${encodeURIComponent(id)}/devolver`, cuerpo),
};

/** Culqi Checkout Custom (reemplaza al V4, que Culqi retirará): admite `modal:false` + `container`. */
export const URL_CULQI = 'https://js.culqi.com/checkout-js';
/** Id del div de nuestro modal donde Culqi monta su formulario (iframe alojado por Culqi). */
export const ID_CONTENEDOR_CULQI = 'culqi-container';
const COLOR_AZUL = '#0B2C3E';
const COLOR_CREMA = '#FBF4EC';
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

/** Configuración de Culqi Checkout Custom embebido: solo tarjeta y Yape; los medios con orden quedan apagados. */
export function configCulqi(intento: Pick<IntentoCulqi, 'moneda' | 'montoCentimos' | 'medios'>) {
  const paymentMethods = {
    tarjeta: intento.medios.includes('TARJETA'),
    yape: intento.medios.includes('YAPE'),
    bancaMovil: false,
    agente: false,
    billetera: false,
    cuotealo: false,
  };
  return {
    settings: { title: 'Caprichos', currency: intento.moneda, amount: intento.montoCentimos },
    options: {
      lang: 'auto',
      modal: false,
      container: `#${ID_CONTENEDOR_CULQI}`,
      paymentMethods,
      paymentMethodsSort: Object.keys(paymentMethods).filter((k) => paymentMethods[k as keyof typeof paymentMethods]),
    },
    appearance: {
      theme: 'default',
      hiddenCulqiLogo: false,
      hiddenBanner: true, // el encabezado (título, monto, contador) es de nuestro modal
      menuType: 'sliderTop', // cabe en 360 px
      buttonCardPayText: 'Pagar',
      defaultStyle: {
        bannerColor: COLOR_AZUL,
        buttonBackground: COLOR_NARANJA,
        menuColor: COLOR_AZUL,
        linksColor: COLOR_NARANJA,
        buttonTextColor: COLOR_AZUL,
        priceColor: COLOR_NARANJA,
      },
      variables: {
        borderRadius: '10px',
        colorBackground: COLOR_CREMA,
        colorPrimary: COLOR_NARANJA,
        colorPrimaryText: COLOR_AZUL,
        colorText: COLOR_AZUL,
      },
      rules: {
        '.Culqi-Main-Container': { background: COLOR_CREMA },
        '.Culqi-Button': { background: COLOR_NARANJA, color: COLOR_AZUL, fontWeight: '700' },
      },
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

/** El script de Culqi no cargó o no pudo montarse (no es un rechazo del banco). */
export class ErrorAperturaCulqi extends Error {
  constructor(detalle?: string) {
    super(`No se pudo abrir el pago.${detalle ? ` ${detalle}` : ''}`);
  }
}

export interface ResultadoCulqi {
  token: string;
  medio: MedioCulqi;
  email?: string;
}

const log = (...a: unknown[]) => console.info('[culqi]', ...a);
/** Segundos sin ver el iframe de Culqi antes de pasar al respaldo (ventana modal de Culqi). */
export const ESPERA_IFRAME_MS = 8000;

/**
 * Monta Culqi Checkout Custom EMBEBIDO dentro de `anfitrion` (un nodo estable; React no es dueño de lo que
 * se crea dentro) y devuelve el token (o null si se cierra sin pagar). `cerrar()` lo desmonta.
 * Culqi hace document.querySelector(container) y monta una app Vue ahí: por eso el nodo de montaje lo crea
 * este código con un id único justo antes, y no un div que React pueda re-montar.
 * Respaldo: si a los ESPERA_IFRAME_MS no hay iframe, se cierra y se abre en `modal:true` (`alRespaldo(true)`).
 * La tarjeta se escribe en un iframe de Culqi: nuestro JS solo recibe el token.
 */
export function abrirCulqi(
  intento: IntentoCulqi,
  anfitrion: HTMLElement,
  alRespaldo?: (activo: boolean) => void,
  esperaMs = ESPERA_IFRAME_MS,
): { resultado: Promise<ResultadoCulqi | null>; cerrar: () => void } {
  let instancia: any = null;
  let nodo: HTMLElement | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cerrado = false;
  let terminar: (r: ResultadoCulqi | null, e?: Error) => void = () => {};
  const resultado = new Promise<ResultadoCulqi | null>((resolver, rechazar) => {
    terminar = (r, e) => (e ? rechazar(e) : resolver(r));
  });
  const soltar = () => {
    clearTimeout(timer);
    try { instancia?.close(); } catch { /* ya cerrado */ }
    instancia = null;
    nodo?.remove();
    nodo = null;
  };
  const cerrar = () => {
    cerrado = true;
    soltar();
    terminar(null);
  };
  const crear = (modal: boolean) => {
    const CC = (window as any).CulqiCheckout;
    if (!CC) throw new ErrorAperturaCulqi();
    let cfg = configCulqi(intento);
    if (modal) {
      const opciones = { ...cfg.options, container: undefined };
      cfg = { ...cfg, options: { ...opciones, modal: true } as any };
    } else {
      nodo = document.createElement('div');
      nodo.id = `${ID_CONTENEDOR_CULQI}-${Math.random().toString(36).slice(2, 10)}`;
      nodo.style.cssText = 'width:100%;height:100%';
      anfitrion.appendChild(nodo);
      cfg = { ...cfg, options: { ...cfg.options, container: `#${nodo.id}` } };
    }
    instancia = new CC(intento.publicKey, cfg);
    log('instancia creada', modal ? 'modal' : cfg.options.container);
    instancia.culqi = () => {
      const C = instancia;
      if (C.token?.id) {
        const tk = C.token;
        C.close();
        terminar({ token: tk.id, medio: tk.type === 'yape' || String(tk.id).startsWith('ype_') ? 'YAPE' : 'TARJETA', email: tk.email });
      } else if (C.error) {
        C.close();
        terminar(null, new Error(mensajeRechazo(C.error.code ?? C.error.decline_code, C.error.merchant_message)));
      } else {
        C.close();
        terminar(null);
      }
    };
    instancia.closeCheckout = () => terminar(null);
    instancia.open();
    log('open', modal ? 'modal' : 'embebido');
  };
  const hayIframe = (modal: boolean) =>
    !!(modal ? document.querySelector('iframe[name="checkout_frame"]') : nodo?.querySelector('iframe'));
  const vigilar = (modal: boolean) => {
    timer = setTimeout(() => {
      if (cerrado) return;
      if (hayIframe(modal)) return log('iframe visto', modal ? 'modal' : 'embebido');
      if (modal) return terminar(null, new ErrorAperturaCulqi());
      log('sin iframe: respaldo modal');
      soltar();
      try {
        alRespaldo?.(true);
        crear(true);
        vigilar(true);
      } catch {
        alRespaldo?.(false);
        terminar(null, new ErrorAperturaCulqi());
      }
    }, esperaMs);
  };
  cargarScriptCulqi()
    .then(() => {
      if (cerrado) return;
      log('script cargado');
      crear(false);
      vigilar(false);
    })
    .catch(() => terminar(null, new ErrorAperturaCulqi()));
  return { resultado, cerrar };
}

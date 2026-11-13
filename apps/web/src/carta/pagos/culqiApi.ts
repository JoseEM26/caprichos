import { api } from '../../comun/api';

export type MedioCulqi = 'TARJETA' | 'YAPE';
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
  estado: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE';
  mensaje: string;
  pedidoCodigo: string;
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
}

export interface FiltrosPagosOnline {
  desde?: string;
  hasta?: string;
  estado?: string;
  pagina?: number;
}

export const culqiApi = {
  config: () => api.get<ConfigCulqi>('/carta/pagos/culqi/config'),
  intento: (pedidoId: string) => api.post<IntentoCulqi>('/carta/pagos/culqi/intento', { pedidoId }),
  cargo: (cuerpo: { intentoId: string; token: string; medio: MedioCulqi; email?: string }) =>
    api.post<ResultadoCargo>('/carta/pagos/culqi/cargo', cuerpo),
  listar: (f: FiltrosPagosOnline) => {
    const q = new URLSearchParams();
    (['desde', 'hasta', 'estado'] as const).forEach((k) => f[k] && q.set(k, f[k]!));
    q.set('pagina', String(f.pagina ?? 1));
    return api.get<{ items: PagoOnline[]; total: number }>(`/admin/pagos-online?${q}`);
  },
  devolver: (id: string, cuerpo: { monto?: number; motivo: string }) =>
    api.post(`/admin/pagos-online/${encodeURIComponent(id)}/devolver`, cuerpo),
};

const URL_CULQI = 'https://js.culqi.com/checkout-js';
let promesaScript: Promise<void> | null = null;

/** Carga el script oficial de Culqi solo cuando se pide (modo REAL). */
export function cargarScriptCulqi(): Promise<void> {
  if (promesaScript) return promesaScript;
  promesaScript = new Promise<void>((ok, fallo) => {
    const s = document.createElement('script');
    s.src = URL_CULQI;
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => {
      promesaScript = null;
      s.remove();
      fallo(new Error('No se pudo cargar el pago. Revisa tu conexión.'));
    };
    document.head.appendChild(s);
  });
  return promesaScript;
}

/** Abre Culqi Checkout y devuelve el token (o null si el cliente cierra sin pagar). */
export async function abrirCulqi(intento: IntentoCulqi): Promise<{ token: string; medio: MedioCulqi; email?: string } | null> {
  await cargarScriptCulqi();
  const C = (window as any).Culqi;
  if (!C) throw new Error('No se pudo cargar el pago. Intenta de nuevo.');
  return new Promise((resolver) => {
    C.publicKey = intento.publicKey;
    C.settings({ title: 'Caprichos', currency: intento.moneda, amount: intento.montoCentimos });
    C.options({ paymentMethods: { tarjeta: intento.medios.includes('TARJETA'), yape: intento.medios.includes('YAPE') } });
    (window as any).culqi = () => {
      if (C.token?.id) {
        const tk = C.token;
        C.close();
        resolver({ token: tk.id, medio: tk.type === 'yape' || String(tk.id).startsWith('ype_') ? 'YAPE' : 'TARJETA', email: tk.email });
      } else {
        C.close();
        resolver(null);
      }
    };
    C.open();
  });
}

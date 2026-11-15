import { cargarScript } from './culqiApi';

// ponytail: nombres de la librería Culqi 3DS tomados de los repos oficiales *-checkoutv4-culqi3ds
// (script https://3ds.culqi.com, Culqi3DS.settings/options/initAuthentication y mensaje 'message' con
// parameters3DS). SIN VERIFICAR contra Culqi: se mantiene aislado aquí. Duda abierta.
export const URL_CULQI_3DS = 'https://3ds.culqi.com';
const memo = { p: null as Promise<void> | null };

async function libreria(): Promise<any> {
  await cargarScript(URL_CULQI_3DS, memo);
  const C3 = (window as any).Culqi3DS;
  if (!C3) throw new Error('No se pudo cargar la verificación del banco. Intenta de nuevo.');
  return C3;
}

/** Huella del dispositivo (Culqi3DS.generateDevice); se manda como deviceId en el cargo. */
export async function obtenerDeviceId(): Promise<string> {
  return String(await (await libreria()).generateDevice());
}

const CAMPOS_3DS = ['cavv', 'directoryServerTransactionId', 'eci', 'protocolVersion', 'xid'] as const;

/** Autentica el token con 3DS y devuelve el objeto que el servidor reenvía en el cargo. */
export async function autenticar3ds(
  publicKey: string,
  tokenId: string,
  datos: { montoCentimos: number; email?: string; moneda?: string },
): Promise<unknown> {
  const C3 = await libreria();
  return new Promise((ok, fallo) => {
    const escuchar = (ev: MessageEvent) => {
      if (!ev.data || (ev.data.parameters3DS === undefined && ev.data.error === undefined)) return;
      window.removeEventListener('message', escuchar);
      // Como el demo oficial (culqi-python-demo-checkoutv4-culqi3ds): se limpia la librería al terminar
      try { C3.reset?.(); } catch { /* sin efecto */ }
      if (ev.data.parameters3DS) ok(Object.fromEntries(CAMPOS_3DS.map((k) => [k, ev.data.parameters3DS[k]]).filter(([, v]) => v !== undefined)));
      else fallo(new Error('Tu banco no pudo verificar la tarjeta. Prueba con otra o con otro medio.'));
    };
    window.addEventListener('message', escuchar);
    C3.publicKey = publicKey;
    C3.settings = { charge: { totalAmount: datos.montoCentimos, currency: datos.moneda ?? 'PEN', returnUrl: window.location.href }, card: { email: datos.email ?? '' } };
    C3.options = { showModal: true, showLoading: true, showIcon: true, style: { btnColor: '#E67929', btnTextColor: '#0B2C3E' }, closeModalAction: () => escuchar(new MessageEvent('message', { data: { error: 'cerrado' } })) };
    C3.initAuthentication(tokenId);
  });
}

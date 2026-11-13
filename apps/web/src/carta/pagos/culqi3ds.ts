import { cargarScript } from './culqiApi';

// ponytail: nombres de la librería Culqi 3DS tomados de los repos oficiales *-checkoutv4-culqi3ds
// (script https://3ds.culqi.com, Culqi3DS.settings/options/initAuthentication y mensaje 'message' con
// parameters3DS). SIN VERIFICAR contra Culqi: se mantiene aislado aquí. Duda abierta.
export const URL_CULQI_3DS = 'https://3ds.culqi.com';
const memo = { p: null as Promise<void> | null };

/** Autentica el token con 3DS y devuelve el objeto que el servidor reenvía en el cargo. */
export async function autenticar3ds(
  publicKey: string,
  tokenId: string,
  datos: { montoCentimos: number; email?: string },
): Promise<unknown> {
  await cargarScript(URL_CULQI_3DS, memo);
  const C3 = (window as any).Culqi3DS;
  if (!C3) throw new Error('No se pudo cargar la verificación del banco. Intenta de nuevo.');
  return new Promise((ok, fallo) => {
    const escuchar = (ev: MessageEvent) => {
      if (!ev.data || (ev.data.parameters3DS === undefined && ev.data.error === undefined)) return;
      window.removeEventListener('message', escuchar);
      if (ev.data.parameters3DS) ok(ev.data.parameters3DS);
      else fallo(new Error('Tu banco no pudo verificar la tarjeta. Prueba con otra o con otro medio.'));
    };
    window.addEventListener('message', escuchar);
    C3.publicKey = publicKey;
    C3.settings = { charge: { totalAmount: datos.montoCentimos, returnUrl: window.location.href }, card: { email: datos.email ?? '' } };
    C3.options = { showModal: true, showLoading: true, showIcon: true, closeModalAction: () => escuchar(new MessageEvent('message', { data: { error: 'cerrado' } })) };
    C3.initAuthentication(tokenId);
  });
}

import { Page, expect } from '@playwright/test';
import { RolPrueba, obtenerDniRol, obtenerClaveRol } from './credenciales';

export interface ResultadoLoginApi {
  accessToken: string;
  debeCambiar: boolean;
  usuario: {
    partyId: string;
    nombres: string;
    rol: string;
  };
  cookieHeader?: string;
}

/**
 * Realiza el login por API contra el endpoint /auth/ingresar.
 * Obtiene el token de acceso JWT y datos de sesión por rol.
 */
export async function loginPorApi(
  rol: RolPrueba,
  apiBaseUrl: string = process.env.API_BASE_URL || `http://127.0.0.1:${3100 + Number(process.env.E2E_SLOT || 0)}`,
): Promise<ResultadoLoginApi> {
  const dni = obtenerDniRol(rol);
  const contrasena = obtenerClaveRol(rol);

  const respuesta = await fetch(`${apiBaseUrl}/auth/ingresar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dni, contrasena }),
  });

  if (!respuesta.ok) {
    const errorText = await respuesta.text();
    throw new Error(`Fallo login por API para rol ${rol} (${respuesta.status}): ${errorText}`);
  }

  const data = await respuesta.json();
  const setCookie = respuesta.headers.get('set-cookie') || undefined;

  return {
    accessToken: data.accessToken,
    debeCambiar: Boolean(data.debeCambiar),
    usuario: data.usuario,
    cookieHeader: setCookie,
  };
}

/**
 * Inicia sesión a través de la interfaz web (/admin/ingresar).
 * Llena el formulario con DNI y contraseña del rol y valida la llegada al tablero.
 */
export async function loginPorUi(
  page: Page,
  rol: RolPrueba,
  frontBaseUrl: string = process.env.FRONT_BASE_URL || `http://127.0.0.1:${5273 + Number(process.env.E2E_SLOT || 0)}`,
): Promise<void> {
  const dni = obtenerDniRol(rol);
  const contrasena = obtenerClaveRol(rol);

  await page.goto(`${frontBaseUrl}/admin/ingresar`, { waitUntil: 'domcontentloaded' });

  const inputUsuario = page.locator('#lg-user, input[aria-label="DNI"], input[placeholder*="Usuario"]');
  const inputPassword = page.locator('#lg-pass, input[type="password"]');
  const botonSubmit = page.locator('button[type="submit"]');

  await inputUsuario.waitFor({ state: 'visible', timeout: 10000 });
  await inputUsuario.fill(dni);
  await inputPassword.fill(contrasena);
  await botonSubmit.click();

  // Esperar a que la URL cambie a /admin (tablero o vista del rol, saliendo de /admin/ingresar)
  await page.waitForURL((url) => url.pathname.startsWith('/admin') && !url.pathname.includes('/ingresar'), {
    timeout: 15000,
  });
}

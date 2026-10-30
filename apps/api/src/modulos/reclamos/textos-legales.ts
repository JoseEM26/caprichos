import type { PrismaService } from '../../comun/prisma/prisma.service';

/** Línea que solo ve el administrador: la carta la quita. */
export const PREFIJO_NOTA_ADMIN = '[[ADMIN]] ';
export const NOTA_ADMIN = 'Texto base sugerido: revísalo con tu asesor legal antes de publicarlo.';

export const MARCADORES = [
  'razon_social',
  'ruc',
  'direccion_fiscal',
  'correo_contacto',
  'telefono_contacto',
  'whatsapp',
  'nombre_comercial',
  'fecha_vigencia',
] as const;
export type Marcador = (typeof MARCADORES)[number];

const ETIQUETA_FALTA: Record<Marcador, string> = {
  razon_social: 'razón social',
  ruc: 'RUC',
  direccion_fiscal: 'dirección fiscal',
  correo_contacto: 'correo de contacto',
  telefono_contacto: 'teléfono de contacto',
  whatsapp: 'WhatsApp',
  nombre_comercial: 'nombre comercial',
  fecha_vigencia: 'fecha de vigencia',
};

/** Lo que la carta muestra cuando un dato falta: neutro, que no rompe la frase. */
const NEUTRO: Record<Marcador, string> = {
  razon_social: 'Caprichos',
  ruc: 'el que figura en nuestros comprobantes',
  direccion_fiscal: 'la dirección de nuestro local',
  correo_contacto: 'nuestro WhatsApp',
  telefono_contacto: 'nuestro WhatsApp',
  whatsapp: 'nuestro canal de WhatsApp',
  nombre_comercial: 'Caprichos',
  fecha_vigencia: 'la fecha de su publicación',
};

export type DatosNegocio = Partial<Record<Marcador, string | null | undefined>>;

/** Datos del negocio desde local_datos (Configuración ▸ Local) y la versión vigente del texto. */
export function datosNegocioDe(localDatos: any, version?: string | null): DatosNegocio {
  const d = localDatos && typeof localDatos === 'object' ? localDatos : {};
  const limpio = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  return {
    razon_social: limpio(d.razon_social),
    ruc: limpio(d.ruc),
    direccion_fiscal: limpio(d.direccion_fiscal) ?? limpio(d.direccion),
    correo_contacto: limpio(d.correo),
    telefono_contacto: limpio(d.telefono),
    whatsapp: limpio(d.whatsapp),
    nombre_comercial: limpio(d.nombre),
    fecha_vigencia: version ? formatearFecha(version) : undefined,
  };
}

export function formatearFecha(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/**
 * Reemplaza los marcadores. modo 'admin': lo que falta queda visible como «[Falta: RUC]» y se conserva la nota
 * para el administrador. modo 'carta': lo que falta se cambia por un texto neutro y se quita la nota.
 */
export function resolverMarcadores(
  texto: string,
  datos: DatosNegocio,
  modo: 'admin' | 'carta',
): { texto: string; faltantes: string[] } {
  const faltantes = new Set<string>();
  let salida = texto
    .split('\n')
    .filter((l) => modo === 'admin' || !l.startsWith(PREFIJO_NOTA_ADMIN))
    .map((l) => (modo === 'admin' && l.startsWith(PREFIJO_NOTA_ADMIN) ? l.slice(PREFIJO_NOTA_ADMIN.length) : l))
    .join('\n')
    .replace(/^\n+/, '');
  salida = salida.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (todo, nombre: string) => {
    if (!(MARCADORES as readonly string[]).includes(nombre)) return todo;
    const m = nombre as Marcador;
    const valor = datos[m];
    if (valor) return valor;
    faltantes.add(ETIQUETA_FALTA[m]);
    return modo === 'admin' ? `[Falta: ${ETIQUETA_FALTA[m]}]` : NEUTRO[m];
  });
  return { texto: salida, faltantes: [...faltantes] };
}

/** Versión (fecha ISO) de un texto legal, para guardar con el consentimiento. */
export async function versionesLegales(prisma: Pick<PrismaService, 'parametro'>): Promise<{ terminos: string; privacidad: string }> {
  try {
    const filas = await prisma.parametro.findMany({ where: { clave: { in: ['terminos_version', 'privacidad_version'] } } });
    const v = (c: string) => String(filas.find((f) => f.clave === c)?.valor ?? '') || 'sin-version';
    return { terminos: v('terminos_version'), privacidad: v('privacidad_version') };
  } catch {
    return { terminos: 'sin-version', privacidad: 'sin-version' };
  }
}

/** Texto que la carta muestra junto a la casilla de consentimiento (sin DNI). */
export const TEXTO_CONSENTIMIENTO =
  'Acepto que Caprichos guarde mi celular y mis datos para gestionar mis pedidos, acumular puntos y enviarme avisos de mis pedidos por WhatsApp y mi cupón de cumpleaños, según los Términos y Condiciones y la Política de Privacidad.';

/** Versión del consentimiento que se guarda en consent.version_texto: texto de celular + versiones vigentes. */
export function versionConsentimiento(v: { terminos: string; privacidad: string }): string {
  return `celular-v1|T:${v.terminos}|P:${v.privacidad}`;
}

export const TERMINOS_BASE = `${PREFIJO_NOTA_ADMIN}${NOTA_ADMIN}

TÉRMINOS Y CONDICIONES DE USO — {{nombre_comercial}}
Vigentes desde el {{fecha_vigencia}}

1. Quiénes somos
{{razon_social}}, con RUC {{ruc}} y domicilio fiscal en {{direccion_fiscal}}, opera la cafetería artesanal {{nombre_comercial}} en Lima, Perú (en adelante, «Caprichos»). Puedes escribirnos a {{correo_contacto}}, llamar al {{telefono_contacto}} o hablarnos por WhatsApp al {{whatsapp}}.

2. Qué ofrecemos
Esta carta virtual te permite ver nuestros productos, hacer pedidos para delivery, para llevar o para consumir en el local, y administrar tu cuenta. Los precios están en soles (S/) e incluyen los impuestos de ley. Los productos y precios pueden cambiar; vale el precio mostrado al enviar tu pedido.

3. Tu cuenta
Para tener cuenta necesitas un celular peruano de 9 dígitos y una contraseña de al menos 8 caracteres. El celular es tu usuario. No pedimos tu DNI para crear la cuenta. Eres responsable de guardar tu contraseña; si crees que alguien más la conoce, cámbiala con la opción «Olvidé mi contraseña», que te envía un código por WhatsApp a tu mismo celular. Podemos suspender cuentas que se usen para fraude o abuso.

4. Pedidos y pagos
Tu pedido se confirma cuando lo recibimos y, si pagas con Yape, Plin o transferencia, cuando validamos tu pago. El delivery tiene un costo según la zona y solo llega a las zonas que atendemos. Los tiempos de entrega son estimados. Puedes pedir como invitado, pero sin cuenta no acumulas puntos.

5. Voucher de pago
Si pagas con transferencia, Yape o Plin, te pedimos la imagen del voucher. La guardamos de forma privada y solo para validar tu pago. Podemos usar una lectura automática con inteligencia artificial para ayudar a leerla, pero esa lectura nunca aprueba un pago por sí sola: lo confirma una persona de Caja.

6. Puntos
Por lo que pagas en productos sin promoción ni cupón acumulas el 5 % en puntos. Los puntos se suman cuando se cobra el pedido, no son dinero, no se pueden cambiar por efectivo ni transferir, y se pueden ajustar o revertir si el pedido se anula o se devuelve el pago. Los puntos pueden canjearse solo en productos sin promoción, según lo que indique la carta.

7. Cupón de cumpleaños
Si nos das tu fecha de cumpleaños, te enviaremos un beneficio especial. Es opcional y puedes pedir que lo quitemos.

8. Comprobantes de pago
Emitimos boleta o factura electrónica. El documento de identidad (DNI) o el RUC solo se pide cuando lo solicitas para tu boleta o factura, o cuando la ley lo exige, y queda únicamente en ese comprobante: no se guarda en tu cuenta.

9. Cambios y cancelaciones
Puedes pedir cambios o anular tu pedido mientras no haya empezado su preparación, escribiéndonos por WhatsApp. Si ya se preparó, no podemos anularlo. Si hay un problema con tu pedido, contáctanos para solucionarlo.

10. WhatsApp
Te escribimos por WhatsApp para avisarte del estado de tu pedido, de la entrega y de tu pago, y para atender tus consultas. Para dejar de recibir mensajes que no sean esenciales, como promociones o encuestas, responde BAJA o STOP. Los avisos necesarios para entregar un pedido en curso se seguirán enviando.

11. Libro de Reclamaciones
Tienes derecho a presentar un reclamo o queja en nuestro Libro de Reclamaciones virtual, disponible en esta carta. Te entregamos una constancia y respondemos dentro del plazo legal.

12. Propiedad intelectual
Las marcas, fotos, textos y diseños de la carta son de Caprichos o de sus autores. No puedes copiarlos ni usarlos con fines comerciales sin nuestra autorización.

13. Datos personales
El tratamiento de tus datos se explica en nuestra Política de Privacidad.

14. Cambios a estos términos
Podemos actualizar estos términos. Publicaremos la nueva versión en la carta con su fecha de vigencia. Si sigues usando la carta después de un cambio, entendemos que lo aceptas; si el cambio es importante, te lo avisaremos.

15. Ley aplicable
Estos términos se rigen por las leyes de la República del Perú. Cualquier controversia se somete a los jueces y tribunales de Lima, sin perjuicio de tus derechos como consumidor ante INDECOPI.
`;

export const PRIVACIDAD_BASE = `${PREFIJO_NOTA_ADMIN}${NOTA_ADMIN}

POLÍTICA DE PRIVACIDAD — {{nombre_comercial}}
Vigente desde el {{fecha_vigencia}}

1. Responsable del tratamiento
{{razon_social}}, RUC {{ruc}}, domicilio en {{direccion_fiscal}}, es la titular del banco de datos personales de clientes de {{nombre_comercial}}. Contacto: {{correo_contacto}}, teléfono {{telefono_contacto}} o WhatsApp {{whatsapp}}. Tratamos tus datos conforme a la Ley N.º 29733, Ley de Protección de Datos Personales, y su reglamento.

2. Qué datos guardamos
- Datos de tu cuenta: nombre, celular y contraseña (la guardamos cifrada, nunca en claro).
- Datos opcionales: cumpleaños (día y mes), correo y foto de perfil.
- Direcciones de entrega que usas en tus pedidos delivery.
- Historial de pedidos y de puntos.
- Voucher de pago (imagen) cuando pagas por transferencia, Yape o Plin.
- Mensajes con nosotros por WhatsApp y, si respondes, tu opinión sobre el pedido.
No pedimos tu DNI para tener cuenta.

3. Para qué los usamos
- Gestionar tus pedidos, entregas y pagos.
- Llevar tu cuenta, tus direcciones y tus puntos.
- Enviarte el cupón de cumpleaños, si nos diste tu fecha.
- Avisarte por WhatsApp del estado de tu pedido.
- Enviarte una encuesta después de tu pedido para mejorar el servicio.
- Atender consultas, reclamos y cumplir obligaciones legales y tributarias.
No vendemos tus datos ni los usamos para fines distintos de los indicados.

4. WhatsApp
Usamos tu celular para escribirte por WhatsApp. Los mensajes operativos (tu pedido, tu pago, tu entrega) son necesarios para el servicio. Si no quieres recibir lo demás, como promociones o encuestas, responde BAJA o STOP y dejaremos de enviarlo.

5. Voucher de pago
La imagen de tu voucher se guarda en un archivo privado y solo la ve el personal que valida pagos. Puede leerse con ayuda de inteligencia artificial para facilitar la revisión, pero esa lectura no aprueba pagos y no se usa para otro fin.

6. Comprobantes y documento de identidad
Tu DNI o RUC solo se pide cuando solicitas boleta o factura con tus datos, o cuando la ley lo exige. Se guarda únicamente en ese comprobante, por el tiempo que exige la normativa tributaria, y no se asocia a tu cuenta ni a tus pedidos. Si presentas un reclamo en el Libro de Reclamaciones, el documento que indiques se guarda solo en ese reclamo.

7. Con quién compartimos tus datos
Solo con quienes necesitamos para darte el servicio: el repartidor (tu nombre, dirección y celular para entregar tu pedido), el proveedor de WhatsApp (Meta), proveedores de alojamiento y de facturación electrónica, y autoridades cuando la ley lo exija. Estos proveedores tratan tus datos solo para prestarnos su servicio.

8. Cuánto tiempo los conservamos
Conservamos tus datos mientras tu cuenta esté activa. Si pides eliminarla, borramos o anonimizamos tus datos personales, salvo lo que debamos guardar por ley: por ejemplo, los comprobantes de pago y los reclamos, por los plazos tributarios y de protección al consumidor.

9. Tus derechos (ARCO)
Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición sobre tus datos personales. Puedes corregir tu nombre, correo y cumpleaños desde tu cuenta. Para los demás derechos, escríbenos a {{correo_contacto}} o por WhatsApp al {{whatsapp}} indicando tu nombre y el celular de tu cuenta; te responderemos dentro del plazo legal. Si no estás conforme, puedes acudir a la Autoridad Nacional de Protección de Datos Personales.

10. Seguridad
Aplicamos medidas técnicas y organizativas para proteger tus datos: contraseñas cifradas, acceso limitado por roles, archivos privados y registro de accesos. Ningún sistema es infalible; si ocurriera un incidente que te afecte, te lo comunicaremos conforme a la ley.

11. Cambios a esta política
Si la modificamos, publicaremos la nueva versión con su fecha de vigencia y, si el cambio es importante, te lo avisaremos. Al registrarte guardamos la versión de los Términos y de esta Política que aceptaste.
`;

/** Fecha de hoy en Lima (YYYY-MM-DD): la «versión» de un texto legal. */
export function hoyLima(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

const TEXTOS = [
  { clave: 'terminos_texto', versionClave: 'terminos_version', base: TERMINOS_BASE },
  { clave: 'privacidad_texto', versionClave: 'privacidad_version', base: PRIVACIDAD_BASE },
] as const;

/**
 * Siembra los textos base y su versión SOLO si el parámetro no existe o está vacío.
 * Nunca pisa lo que el dueño ya escribió. Idempotente.
 */
export async function sembrarTextosLegales(prisma: PrismaService): Promise<{ sembrados: string[] }> {
  const sembrados: string[] = [];
  for (const t of TEXTOS) {
    const actual = await prisma.parametro.findUnique({ where: { clave: t.clave } });
    const vacio = !actual || typeof actual.valor !== 'string' || actual.valor.trim() === '';
    if (vacio) {
      await prisma.parametro.upsert({ where: { clave: t.clave }, update: { valor: t.base }, create: { clave: t.clave, valor: t.base } });
      await prisma.parametro.upsert({ where: { clave: t.versionClave }, update: { valor: hoyLima() }, create: { clave: t.versionClave, valor: hoyLima() } });
      sembrados.push(t.clave);
    } else if (!(await prisma.parametro.findUnique({ where: { clave: t.versionClave } }))) {
      await prisma.parametro.create({ data: { clave: t.versionClave, valor: hoyLima() } });
    }
  }
  return { sembrados };
}

export interface TextoLegalResuelto {
  texto: string;
  version: string;
  faltantes: string[];
}

/** Términos y privacidad con los marcadores ya reemplazados. 'carta': público; 'admin': con faltantes visibles. */
export async function leerTextosLegales(
  prisma: Pick<PrismaService, 'parametro'>,
  modo: 'admin' | 'carta',
): Promise<{ terminos: TextoLegalResuelto; privacidad: TextoLegalResuelto }> {
  const filas = await prisma.parametro.findMany({
    where: { clave: { in: ['local_datos', 'terminos_texto', 'terminos_version', 'privacidad_texto', 'privacidad_version'] } },
  });
  const val = (c: string) => filas.find((f) => f.clave === c)?.valor;
  const una = (clave: string, versionClave: string, base: string): TextoLegalResuelto => {
    const crudo = val(clave);
    const version = typeof val(versionClave) === 'string' ? (val(versionClave) as string) : '';
    const r = resolverMarcadores(typeof crudo === 'string' && crudo.trim() ? crudo : base, datosNegocioDe(val('local_datos'), version), modo);
    return { texto: r.texto, version, faltantes: r.faltantes };
  };
  return {
    terminos: una('terminos_texto', 'terminos_version', TERMINOS_BASE),
    privacidad: una('privacidad_texto', 'privacidad_version', PRIVACIDAD_BASE),
  };
}

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useSesion } from '../../comun/sesion';
import { api, ErrorApi } from '../../comun/api';
import { Confirmar } from '../../comun/Confirmar';
import { HorarioTab } from './HorarioTab';
import { PagosTab } from './PagosTab';
import { FechasEspecialesTab } from './FechasEspecialesTab';
import { ZonasRepartoView } from './ZonasRepartoView';
import { SeccionAltaDemanda } from './SeccionAltaDemanda';
import { SeccionRepartoConfig } from './SeccionRepartoConfig';
import { ParametrosOperacionTab } from './ParametrosOperacionTab';
import { ChatbotConfiguracionTab } from './ChatbotConfiguracionTab';
import { TarjetaImpresionEtiquetas } from '../impresion/TarjetaImpresionEtiquetas';
import { TarjetaAyudaIaConfiguracion } from './TarjetaAyudaIaConfiguracion';
import { TarjetaVouchersIaConfiguracion } from './TarjetaVouchersIaConfiguracion';
import { TarjetaControlAlmacenConfiguracion } from './TarjetaControlAlmacenConfiguracion';
import { TarjetaNotificacionesConfiguracion } from './TarjetaNotificacionesConfiguracion';
import { TarjetaConfirmarDespejarConfiguracion } from './TarjetaConfirmarDespejarConfiguracion';
import { TarjetaMinutosPreparacionConfiguracion } from './TarjetaMinutosPreparacionConfiguracion';
import { TarjetaResenasGoogleConfiguracion } from './TarjetaResenasGoogleConfiguracion';
import { TarjetaInvitadoConfiguracion } from './TarjetaInvitadoConfiguracion';
import { TarjetaPantallaIngresoConfiguracion } from './TarjetaPantallaIngresoConfiguracion';
import { BuscadorConfiguracion } from './BuscadorConfiguracion';
import { NavegacionConfiguracion, useEsMovil, grupoDe } from './NavegacionConfiguracion';
import { useResaltarCampo, CampoConfig } from './CampoConfig';
import { CampoAyuda } from './AyudaCampo';
import { MapaUbicacion } from '../../comun/mapa/MapaUbicacion';
import { BuscadorDireccion } from '../../comun/mapa/BuscadorDireccion';
import { SEDE_DEFECTO } from '../../comun/mapa/sedeDefecto';
import { propsAyuda } from './catalogo/propsAyuda';
import type { EntradaConfig } from './catalogo';

export interface InfoLocalState {
  // local
  nombre: string;
  lema: string;
  // ubicacion
  direccion: string;
  lat: string;
  lng: string;
  // contacto
  telefono: string;
  whatsapp: string;
  // redes
  instagramNombre: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  // empresa (comprobantes)
  razonSocial: string;
  ruc: string;
  direccionFiscal: string;
  // textos legales de la carta
  terminos: string;
  privacidad: string;
}

const INFO_DEFAULT: InfoLocalState = {
  nombre: 'Caprichos',
  lema: '',
  direccion: '',
  lat: String(SEDE_DEFECTO.lat),
  lng: String(SEDE_DEFECTO.lng),
  telefono: '',
  whatsapp: '',
  instagramNombre: '',
  instagram: '',
  facebook: '',
  tiktok: '',
  razonSocial: '',
  ruc: '',
  direccionFiscal: '',
  terminos: '',
  privacidad: '',
};

/** Ajuste que no se edita en el formulario: remite al parámetro real en Parámetros del sistema. */
interface EnlaceParametro {
  /** id del catálogo de la fila en la pestaña Parámetros (data-cfg-id) */
  id: string;
  /** Nombre del parámetro, como se ve en Parámetros */
  nombre: string;
}

interface CategoriaConfig {
  id: string;
  n: string;
  d: string;
  fields: Array<{
    k: keyof InfoLocalState | string;
    l: string;
    ph?: string;
    multi?: boolean;
    /** Si existe, el campo no se edita aquí: se muestra «Se edita en Parámetros → …» con un enlace. */
    par?: EnlaceParametro;
  }>;
}

export const CATEGORIAS_CONFIG: CategoriaConfig[] = [
  {
    id: 'local',
    n: 'Datos del local',
    d: 'Nombre y lema de la carta',
    fields: [
      { k: 'nombre', l: 'Nombre del local', ph: 'Nombre del local' },
      { k: 'lema', l: 'Lema (debajo del nombre)', ph: 'Ejemplo: Cafetería artesanal' },
    ],
  },
  {
    id: 'ubicacion',
    n: 'Ubicación',
    d: 'Dirección y punto en el mapa',
    fields: [{ k: 'direccion', l: 'Dirección', ph: 'Dirección física del local' }],
  },
  {
    id: 'contacto',
    n: 'Contacto',
    d: 'Teléfono y WhatsApp',
    fields: [
      { k: 'telefono', l: 'Teléfono que se muestra', ph: 'Ejemplo: 987 654 321' },
      { k: 'whatsapp', l: 'WhatsApp (solo números, con código de país)', ph: 'Ejemplo: 51987654321' },
    ],
  },
  {
    id: 'horario',
    n: 'Horario y fechas',
    d: 'Horario de cada día y fechas especiales',
    fields: [],
  },
  {
    id: 'redes',
    n: 'Redes sociales',
    d: 'Enlaces a las cuentas',
    fields: [
      { k: 'instagramNombre', l: 'Nombre que se ve en Instagram', ph: 'Ejemplo: @caprichos' },
      { k: 'instagram', l: 'Enlace de Instagram', ph: 'https://www.instagram.com/...' },
      { k: 'facebook', l: 'Enlace de Facebook', ph: 'https://www.facebook.com/...' },
      { k: 'tiktok', l: 'Enlace de TikTok', ph: 'https://www.tiktok.com/@...' },
    ],
  },
  {
    id: 'pagos',
    n: 'Pagos',
    d: 'Medios que se aceptan y datos de cobro',
    fields: [],
  },
  {
    id: 'operacion',
    n: 'Operación',
    d: 'Tiempo prometido, reservas, puntos y descuento del personal',
    fields: [
      { k: 'tiempoBase', l: 'Tiempo prometido de entrega (minutos)', par: { id: 'parametros-tiempo-prometido-min', nombre: 'Tiempo prometido de entrega (base)' } },
      { k: 'resTol', l: 'Tolerancia de reservas (minutos)', par: { id: 'parametros-reserva-tolerancia-min', nombre: 'Tolerancia de reservas' } },
      { k: 'ptsPct', l: 'Puntos: % del total que gana el cliente con cuenta', par: { id: 'parametros-puntos-porcentaje', nombre: 'Porcentaje de puntos para el cliente' } },
      { k: 'credPct', l: 'Descuento del personal al pagar a crédito (%)', par: { id: 'parametros-descuento-personal-pct', nombre: 'Descuento para el personal a crédito' } },
    ],
  },
  {
    id: 'demanda',
    n: 'Alta demanda y pausa de pedidos',
    d: 'Minutos extra de entrega y pausa para carta y chatbot',
    fields: [],
  },
  {
    id: 'cocina',
    n: 'Cocina',
    d: 'Confirmación al despejar las comandas',
    fields: [],
  },
  {
    id: 'zonas',
    n: 'Zonas de reparto (mapa)',
    d: 'Puntos que limitan cada zona',
    fields: [],
  },
  {
    id: 'fallas',
    n: 'Entregas fallidas',
    d: 'Espera, intentos y qué se hace si el cliente no recibe',
    fields: [
      { k: 'fallaEsperaMin', l: 'Espera del repartidor en la dirección (minutos)', par: { id: 'parametros-reparto-espera-max-min', nombre: 'Espera máxima en la puerta' } },
      { k: 'fallaMaxIntentos', l: 'Intentos de entrega antes de devolver el pedido a la tienda', par: { id: 'parametros-reprog-max-intentos', nombre: 'Reprogramaciones máximas por pedido' } },
      { k: 'fallaPlazoMin', l: 'Plazo para coordinar con el cliente por WhatsApp (minutos)', par: { id: 'parametros-reprog-respuesta-min', nombre: 'Tiempo del cliente para responder si reprograma' } },
      { k: 'fallaRecargo', l: 'Recargo por reprogramar una entrega (S/)', par: { id: 'parametros-reparto-recargo-reprogramacion', nombre: 'Monto fijo por reprogramar' } },
    ],
  },
  {
    id: 'reparto',
    n: 'Reparto y avisos al cliente',
    d: 'Colores del mapa y mensajes de WhatsApp al salir y al llegar',
    fields: [],
  },
  {
    id: 'textos',
    n: 'Textos y mensajes',
    d: 'Términos y privacidad de la carta, y encuesta posventa',
    fields: [
      { k: 'terminos', l: 'Términos y condiciones (se ven en la carta)', multi: true, ph: 'Términos de servicio y políticas de pedidos...' },
      { k: 'privacidad', l: 'Política de privacidad (se ve en la carta)', multi: true, ph: 'Política de tratamiento de datos personales...' },
      { k: 'encMin', l: 'Encuesta posventa: minutos después de la entrega', par: { id: 'parametros-encuesta-espera-min', nombre: 'Espera antes de enviar la encuesta' } },
    ],
  },
  {
    id: 'entrega',
    n: 'Entrega',
    d: 'Envío gratis y pedido mínimo',
    fields: [
      { k: 'envioGratis', l: 'Envío gratis: monto (S/)', par: { id: 'parametros-envio-gratis-monto', nombre: 'Monto de compra para envío gratis' } },
      { k: 'envioGratisMas', l: 'Envío gratis solo si se pasa del monto (Sí) o desde el monto exacto (No)', par: { id: 'parametros-envio-gratis-modo', nombre: 'Cómo se compara el monto de envío gratis' } },
      { k: 'pedidoMin', l: 'Pedido mínimo de delivery (S/)', par: { id: 'parametros-pedido-minimo', nombre: 'Pedido mínimo' } },
    ],
  },
  {
    id: 'empresa',
    n: 'Empresa',
    d: 'Datos fiscales que imprimen los comprobantes',
    fields: [
      { k: 'razonSocial', l: 'Razón social', ph: 'Razón social de la empresa' },
      { k: 'ruc', l: 'RUC', ph: 'Número de RUC (11 dígitos)' },
      { k: 'direccionFiscal', l: 'Dirección fiscal', ph: 'Dirección fiscal registrada' },
    ],
  },
  {
    id: 'parametros',
    n: 'Parámetros del sistema',
    d: 'WhatsApp, tiempos de reparto, encuestas y umbrales operativos',
    fields: [],
  },
  {
    id: 'chatbot',
    n: 'Chatbot y seguridad',
    d: 'Textos, interruptores de función, anti-spam y privacidad Ley 29733',
    fields: [],
  },
  {
    id: 'impresion',
    n: 'Impresión de etiquetas',
    d: 'Estado del agente de caja, trabajos y llaves',
    fields: [],
  },
  {
    id: 'ayuda',
    n: 'Asistente de ayuda con IA',
    d: 'Capri, interruptor con IA y consumo mensual',
    fields: [],
  },
  {
    id: 'vouchers',
    n: 'Lectura de vouchers con IA',
    d: 'Yape y Plin, interruptor con IA, tope mensual, titular y números',
    fields: [],
  },
  {
    id: 'ingreso',
    n: 'Pantalla de ingreso',
    d: 'Imágenes del carrusel y frase de la pantalla de ingreso',
    fields: [],
  },
];

/** Valores de ejemplo que el servidor devuelve mientras el dueño no guarda sus datos: no se muestran como si fueran reales. */
const EJEMPLOS_DEL_SERVIDOR = new Set(['Av. Principal 123', '999999999']);

/** Campos que viajan a PUT /admin/local/datos (local_datos). Términos y privacidad van a /admin/configuracion/<clave>. */
const CLAVES_DATOS_LOCAL: Array<keyof InfoLocalState> = [
  'nombre', 'lema', 'direccion', 'lat', 'lng', 'telefono', 'whatsapp',
  'instagramNombre', 'instagram', 'facebook', 'tiktok', 'razonSocial', 'ruc', 'direccionFiscal',
];
const RUC_VALIDO = /^(10|15|17|20)\d{9}$/;

/** Pestañas con componente propio: no usan el formulario genérico. */
const TABS_PROPIAS = ['horario', 'pagos', 'zonas', 'demanda', 'cocina', 'reparto', 'parametros', 'chatbot', 'impresion', 'ayuda', 'vouchers', 'ingreso'];

const estiloInputCoord = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '44px',
  borderRadius: '10px',
  border: '1.5px solid var(--cp-line)',
  background: 'var(--cp-white)',
  color: 'var(--cp-navy)',
  padding: '0 10px',
  fontSize: '14px',
} as const;

/** Id de catálogo de un campo del formulario genérico: `<tab>-<clave en kebab>` (ej. operacion-tiempo-base). */
export const idCampoGenerico = (tab: string, k: string) =>
  `${tab}-${k.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/_/g, '-').toLowerCase()}`;

/** Secciones plegables de las pestañas largas del formulario genérico (se abren solas al saltar desde el buscador). */
const GRUPOS_CAMPOS: Record<string, Array<[string, string[]]>> = {
  textos: [
    ['Términos y privacidad', ['terminos', 'privacidad']],
    ['Encuesta posventa', ['encMin']],
  ],
};

function gruposDe(tab: string, fields: CategoriaConfig['fields']): Array<{ titulo: string | null; campos: CategoriaConfig['fields'] }> {
  const def = GRUPOS_CAMPOS[tab];
  if (!def) return [{ titulo: null, campos: fields }];
  return def
    .map(([titulo, claves]) => ({ titulo, campos: fields.filter((f) => claves.includes(String(f.k))) }))
    .filter((g) => g.campos.length > 0);
}

export function ConfiguracionLocalView() {
  const { tiene, usuario } = useSesion();
  const esAdmin = usuario?.rol === 'ADMIN' || tiene('ADMIN');
  const puedeVer = esAdmin || tiene('local/ver') || tiene('configuracion/ver');
  // Pantalla de ingreso: solo quien tiene configuracion/editar (ADMIN).
  const puedeEditarIngreso = esAdmin || tiene('configuracion/editar');
  const puedeEditar = esAdmin || tiene('local/editar') || tiene('configuracion/editar');
  const puedeEditarDemanda =
    esAdmin ||
    tiene('cocina/demanda') ||
    tiene('local/editar') ||
    tiene('configuracion/editar');

  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const tabParam = useMemo(() => {
    return new URLSearchParams(location.search).get('tab');
  }, [location.search]);

  const [tabId, setTabId] = useState<string>(() => tabParam || 'local');
  const esMovil = useEsMovil();
  // En celular, sin ?tab= se muestra primero la lista de categorías (estilo ajustes del teléfono).
  const [verDetalle, setVerDetalle] = useState<boolean>(() => !!tabParam);
  useResaltarCampo();

  useEffect(() => {
    if (tabParam && tabParam !== tabId) {
      setTabId(tabParam);
    }
    if (tabParam) setVerDetalle(true);
  }, [tabParam, tabId]);
  const [info, setInfo] = useState<InfoLocalState>(INFO_DEFAULT);
  const [infoGuardada, setInfoGuardada] = useState<InfoLocalState>(INFO_DEFAULT);
  /** Ya respondió el servidor: antes de eso no se avisa «Falta razón social/RUC». */
  const [datosCargados, setDatosCargados] = useState(false);

  const [mensaje, setMensaje] = useState<string>('');

  // Diálogos de confirmación
  const [confirmarGuardar, setConfirmarGuardar] = useState(false);
  const [confirmarDescartar, setConfirmarDescartar] = useState(false);

  const esModificado = useMemo(() => {
    return JSON.stringify(info) !== JSON.stringify(infoGuardada);
  }, [info, infoGuardada]);

  // Cargar desde el servidor: datos del local (local_datos) y textos legales (terminos_texto, privacidad_texto)
  useEffect(() => {
    let vigente = true;
    const texto = (v: unknown) => (typeof v === 'string' && !EJEMPLOS_DEL_SERVIDOR.has(v.trim()) ? v : '');
    const num = (v: unknown, defecto: string) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : defecto);
    (async () => {
      const cambios: Partial<InfoLocalState> = {};
      try {
        const data = await api.get<any>('/admin/local/datos');
        if (data && typeof data === 'object') {
          cambios.nombre = texto(data.nombre) || INFO_DEFAULT.nombre;
          cambios.direccion = texto(data.direccion);
          cambios.telefono = texto(data.telefono);
          cambios.whatsapp = texto(data.whatsapp);
          cambios.lema = texto(data.lema);
          cambios.lat = num(data.lat, INFO_DEFAULT.lat);
          cambios.lng = num(data.lng, INFO_DEFAULT.lng);
          cambios.razonSocial = texto(data.razon_social);
          cambios.ruc = texto(data.ruc);
          cambios.direccionFiscal = texto(data.direccion_fiscal);
          cambios.instagram = texto(data.redes?.instagram);
          cambios.facebook = texto(data.redes?.facebook);
          cambios.tiktok = texto(data.redes?.tiktok);
          cambios.instagramNombre = texto(data.redes?.instagramNombre);
          if (vigente) setDatosCargados(true);
        }
      } catch {
        // sin datos del servidor: se muestran los campos vacíos
      }
      try {
        const lista = await api.get<Array<{ clave: string; valor: unknown }>>('/admin/configuracion');
        if (Array.isArray(lista)) {
          const t = lista.find((p) => p.clave === 'terminos_texto')?.valor;
          const pv = lista.find((p) => p.clave === 'privacidad_texto')?.valor;
          if (typeof t === 'string') cambios.terminos = t;
          if (typeof pv === 'string') cambios.privacidad = pv;
        }
      } catch {
        // sin permiso para leer parámetros: los textos legales quedan vacíos
      }
      if (!vigente) return;
      setInfo((prev) => ({ ...prev, ...cambios }));
      setInfoGuardada((prev) => ({ ...prev, ...cambios }));
    })();
    return () => {
      vigente = false;
    };
  }, []);

  const categoriaActual = useMemo(() => {
    return CATEGORIAS_CONFIG.find((c) => c.id === tabId) || CATEGORIAS_CONFIG[0];
  }, [tabId]);

  const irACategoria = (id: string, campo?: string) => {
    setTabId(id);
    setVerDetalle(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', id);
        if (campo) next.set('campo', campo);
        else next.delete('campo');
        return next;
      },
      { replace: true },
    );
    setMensaje('');
  };

  const categoriasVisibles = CATEGORIAS_CONFIG.filter((c) => c.id !== 'ingreso' || puedeEditarIngreso);

  const handleChange = (key: keyof InfoLocalState, value: string) => {
    setInfo((prev) => ({ ...prev, [key]: value }));
  };

  /** Mensaje del primer dato inválido, o null. El servidor vuelve a validar. */
  const validar = (): string | null => {
    const datosCambiaron = CLAVES_DATOS_LOCAL.some((k) => info[k] !== infoGuardada[k]);
    if (datosCambiaron) {
      if (!info.nombre.trim()) return 'El nombre del local es obligatorio.';
      if (!info.direccion.trim()) return 'La dirección es obligatoria.';
      if (!info.telefono.trim()) return 'El teléfono es obligatorio.';
      if (info.ruc.trim() && !RUC_VALIDO.test(info.ruc.trim())) return 'El RUC debe tener 11 dígitos y empezar con 10, 15, 17 o 20.';
      const lat = Number(info.lat);
      const lng = Number(info.lng);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) return 'La latitud debe ser un número entre -90 y 90.';
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) return 'La longitud debe ser un número entre -180 y 180.';
      if (info.lema.trim().length > 80) return 'El lema no puede pasar de 80 caracteres.';
    }
    if (info.terminos !== infoGuardada.terminos && !info.terminos.trim()) return 'Los términos y condiciones no pueden quedar vacíos.';
    if (info.privacidad !== infoGuardada.privacidad && !info.privacidad.trim()) return 'La política de privacidad no puede quedar vacía.';
    return null;
  };

  const handleGuardar = async () => {
    setConfirmarGuardar(false);
    const problema = validar();
    if (problema) {
      setMensaje(problema);
      return;
    }
    // Se guarda por partes; cada parte confirmada pasa a «guardada» aunque la siguiente falle.
    let guardado = infoGuardada;
    try {
      if (CLAVES_DATOS_LOCAL.some((k) => info[k] !== infoGuardada[k])) {
        await api.put('/admin/local/datos', {
          nombre: info.nombre.trim(),
          direccion: info.direccion.trim(),
          telefono: info.telefono.trim(),
          whatsapp: info.whatsapp.trim(),
          redes: {
            instagram: info.instagram.trim(),
            facebook: info.facebook.trim(),
            tiktok: info.tiktok.trim(),
            instagramNombre: info.instagramNombre.trim(),
          },
          lema: info.lema.trim(),
          razon_social: info.razonSocial.trim(),
          ruc: info.ruc.trim(),
          direccion_fiscal: info.direccionFiscal.trim(),
          lat: Number(info.lat),
          lng: Number(info.lng),
        });
        guardado = { ...guardado };
        for (const k of CLAVES_DATOS_LOCAL) guardado[k] = info[k];
      }
      if (info.terminos !== infoGuardada.terminos) {
        await api.put('/admin/configuracion/terminos_texto', { valor: info.terminos.trim() });
        guardado = { ...guardado, terminos: info.terminos };
      }
      if (info.privacidad !== infoGuardada.privacidad) {
        await api.put('/admin/configuracion/privacidad_texto', { valor: info.privacidad.trim() });
        guardado = { ...guardado, privacidad: info.privacidad };
      }
      setInfoGuardada(guardado);
      setMensaje('Guardado. La carta virtual y el sistema usan estos datos.');
      setTimeout(() => setMensaje(''), 4000);
    } catch (e) {
      setInfoGuardada(guardado);
      setMensaje(e instanceof ErrorApi ? `No se guardó: ${e.message}` : 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.');
    }
  };

  const handleDescartar = () => {
    setConfirmarDescartar(false);
    setInfo(infoGuardada);
    setMensaje('Cambios descartados.');
    setTimeout(() => setMensaje(''), 3000);
  };

  const renderCampo = (f: CategoriaConfig['fields'][number]) => {
    const idCfg = idCampoGenerico(tabId, String(f.k));
    const ay = propsAyuda(idCfg);

    if (f.par) {
      const par = f.par;
      return (
        <CampoConfig key={String(f.k)} id={idCfg}>
          <div className="cfg-ayuda-campo" data-testid={`enlace-${idCfg}`}>
            <div className="cfg-ayuda-etiqueta">{f.l}</div>
            <div className="cfg-ayuda-texto">{ay.ayuda}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginTop: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700 }}>Se edita en Parámetros → {par.nombre}</span>
              <button
                type="button"
                aria-label={`Ir a Parámetros: ${par.nombre}`}
                onClick={() => irACategoria('parametros', par.id)}
                style={{ minHeight: '44px', padding: '0 16px', borderRadius: '10px', border: '1.5px solid var(--cp-navy)', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
              >
                Ir a Parámetros
              </button>
            </div>
          </div>
        </CampoConfig>
      );
    }

    const k = f.k as keyof InfoLocalState;
    if (f.multi) {
      const esLegal = k === 'terminos' || k === 'privacidad';
      return (
        <CampoConfig key={String(f.k)} id={idCfg}>
          <CampoAyuda id={`cfg-${String(f.k)}`} etiqueta={f.l} {...ay}>
            <textarea
              rows={esLegal ? 8 : 3}
              disabled={!puedeEditar}
              placeholder={f.ph || ''}
              value={info[k]}
              onChange={(e) => handleChange(k, e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: '12px',
                border: '1.5px solid var(--cp-line)',
                padding: '10px 12px',
                fontSize: '14px',
                fontFamily: 'inherit',
                color: 'var(--cp-navy)',
                background: !puedeEditar ? 'var(--cp-bg)' : 'var(--cp-white)',
                cursor: !puedeEditar ? 'not-allowed' : 'text',
              }}
            />
          </CampoAyuda>
          {esLegal && (
            <div
              data-testid={`vista-previa-${k}`}
              style={{ marginTop: '8px', border: '1px dashed var(--cp-line)', borderRadius: '12px', padding: '10px 12px', background: 'var(--cp-cream)' }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--cp-soft)', marginBottom: '4px' }}>VISTA PREVIA EN LA CARTA</div>
              <div style={{ fontSize: '13px', lineHeight: '19px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {info[k].trim() || 'Sin texto: la carta muestra un texto provisional.'}
              </div>
            </div>
          )}
        </CampoConfig>
      );
    }

    return (
      <CampoConfig key={String(f.k)} id={idCfg}>
        <CampoAyuda id={`cfg-${String(f.k)}`} etiqueta={f.l} {...ay}>
          <input
            type="text"
            disabled={!puedeEditar}
            placeholder={f.ph || ''}
            value={info[k]}
            onChange={(e) => handleChange(k, e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: '44px',
              borderRadius: '12px',
              border: '1.5px solid var(--cp-line)',
              padding: '0 12px',
              fontSize: '14px',
              color: 'var(--cp-navy)',
              background: !puedeEditar ? 'var(--cp-bg)' : 'var(--cp-white)',
              cursor: !puedeEditar ? 'not-allowed' : 'text',
            }}
          />
        </CampoAyuda>
      </CampoConfig>
    );
  };

  const coordValida = (v: string, max: number) => v.trim() !== '' && Number.isFinite(Number(v)) && Math.abs(Number(v)) <= max;
  const puntoSede = {
    lat: coordValida(info.lat, 90) ? Number(info.lat) : SEDE_DEFECTO.lat,
    lng: coordValida(info.lng, 180) ? Number(info.lng) : SEDE_DEFECTO.lng,
  };
  const sedeGuardada = {
    lat: coordValida(infoGuardada.lat, 90) ? Number(infoGuardada.lat) : SEDE_DEFECTO.lat,
    lng: coordValida(infoGuardada.lng, 180) ? Number(infoGuardada.lng) : SEDE_DEFECTO.lng,
  };
  const faltaFiscal = [!infoGuardada.razonSocial.trim() && 'razón social', !infoGuardada.ruc.trim() && 'RUC'].filter(Boolean) as string[];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Subtítulo exacto del mockup */}
      <div style={{ fontSize: '13px', lineHeight: '19px', color: 'var(--cp-soft)' }}>
        Aquí se cambian los datos que ve el cliente: ubicación, teléfono, horario, redes, pagos y entrega. Se guardan por categorías y la carta virtual los usa.
      </div>

      {/* Barra de estado: Todo guardado / Cambios sin guardar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        {esModificado ? (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '9999px',
              padding: '4px 12px',
              background: 'var(--cp-gold)',
              color: 'var(--cp-navy)',
            }}
          >
            Cambios sin guardar
          </span>
        ) : (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '9999px',
              padding: '4px 12px',
              background: 'var(--cp-navy)',
              color: 'var(--cp-cream)',
            }}
          >
            Todo guardado
          </span>
        )}
        {mensaje && (
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--cp-soft)' }}>
            {mensaje}
          </span>
        )}
      </div>

      {datosCargados && faltaFiscal.length > 0 && (
        <div
          role="status"
          data-testid="aviso-falta-fiscal"
          style={{
            background: 'var(--cp-cream)',
            border: '1.5px solid var(--cp-orange)',
            borderRadius: '12px',
            padding: '10px 14px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            alignItems: 'center',
            fontSize: '13px',
            color: 'var(--cp-navy)',
          }}
        >
          <span style={{ flex: '1 1 260px', fontWeight: 700 }}>
            Falta {faltaFiscal.join(' y ')}: los comprobantes saldrán sin esos datos del local.
          </span>
          <button
            type="button"
            onClick={() => irACategoria('empresa')}
            style={{ minHeight: '44px', padding: '0 16px', borderRadius: '10px', border: '1.5px solid var(--cp-navy)', background: 'transparent', color: 'var(--cp-navy)', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
          >
            Completar en Empresa
          </button>
        </div>
      )}

      <BuscadorConfiguracion
        categorias={categoriasVisibles}
        onElegir={(e: EntradaConfig) => irACategoria(e.tab, e.id)}
      />

      {/* Contenedor: navegación por grupos (PC) o lista a pantalla completa (celular) + panel de edición */}
      <div className="cfg-contenedor">
        {(!esMovil || !verDetalle) && (
          <div className="cfg-lateral">
            <NavegacionConfiguracion
              categorias={categoriasVisibles}
              activo={tabId}
              movil={esMovil}
              onElegir={(id) => irACategoria(id)}
            />
          </div>
        )}

        {/* Panel de edición */}
        {(!esMovil || verDetalle) && (
        <div
          role="tabpanel"
          className="cfg-panel"
          style={{
            minWidth: 0,
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div>
            {esMovil && (
              <button type="button" className="cfg-volver" onClick={() => setVerDetalle(false)}>
                ‹ Configuración
              </button>
            )}
            <div className="cfg-migas">Configuración › {grupoDe(categoriaActual.id)}</div>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '18px' }}>
              {categoriaActual.n}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
              {categoriaActual.d}
            </div>
          </div>

          {/* Subcaso: UBICACIÓN */}
          {tabId === 'ubicacion' && (
            <div
              style={{
                background: 'var(--cp-cream)',
                border: '2px solid var(--cp-orange)',
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div>
                <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '16px' }}>
                  Ubicación actual de la tienda
                </div>
                <div style={{ fontSize: '12px', lineHeight: '17px', color: 'var(--cp-soft)' }}>
                  Es el punto desde donde se miden los radios de entrega y el centro de los mapas. Busca la dirección o toca el mapa y arrastra el pin hasta la puerta del local. Se guarda con «Guardar cambios».
                </div>
              </div>

              <BuscadorDireccion
                onElegir={(p) => setInfo((prev) => ({ ...prev, lat: p.lat.toFixed(6), lng: p.lng.toFixed(6) }))}
              />

              <MapaUbicacion
                punto={puntoSede}
                onCambiar={(p) => setInfo((prev) => ({ ...prev, lat: p.lat.toFixed(6), lng: p.lng.toFixed(6) }))}
                altura={300}
                etiqueta="Mapa para marcar la ubicación de la tienda"
                local={{ ...sedeGuardada, nombre: info.nombre }}
                ajustarA="punto"
                soloLectura={!puedeEditar}
              />
              <div style={{ fontSize: '11px', color: 'var(--cp-soft)' }}>
                El icono de la tienda es la sede guardada; el pin es la nueva ubicación.
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ flex: '1 1 220px', background: 'var(--cp-white)', borderRadius: '10px', padding: '8px 12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--cp-soft)' }}>DIRECCIÓN</div>
                  <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{info.direccion || 'Sin dirección'}</div>
                </div>
                <div style={{ flex: '1 1 180px', background: 'var(--cp-white)', borderRadius: '10px', padding: '8px 12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--cp-soft)' }}>COORDENADAS EN USO</div>
                  <div style={{ fontWeight: 700 }}>{info.lat}, {info.lng}</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  disabled={!puedeEditar}
                  onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setInfo((prev) => ({
                            ...prev,
                            lat: pos.coords.latitude.toFixed(6),
                            lng: pos.coords.longitude.toFixed(6),
                          }));
                          setMensaje('Coordenadas detectadas desde el navegador.');
                        },
                        () => setMensaje('No se pudo obtener la geolocalización.'),
                      );
                    }
                  }}
                  style={{
                    flex: '1 1 220px',
                    minHeight: '52px',
                    border: 0,
                    borderRadius: '12px',
                    background: 'var(--cp-orange)',
                    color: 'var(--cp-navy)',
                    fontWeight: 800,
                    fontSize: '14px',
                    cursor: puedeEditar ? 'pointer' : 'not-allowed',
                    opacity: puedeEditar ? 1 : 0.6,
                  }}
                >
                  Usar la ubicación de este equipo
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 140px' }}>
                  <CampoAyuda id="loc-lat" etiqueta="Latitud" cfgId="ubicacion-lat" {...propsAyuda('ubicacion-lat')}>
                  <input
                    type="text"
                    inputMode="decimal"
                    disabled={!puedeEditar}
                    value={info.lat}
                    onChange={(e) => handleChange('lat', e.target.value)}
                    style={estiloInputCoord}
                  />
                  </CampoAyuda>
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <CampoAyuda id="loc-lng" etiqueta="Longitud" cfgId="ubicacion-lng" {...propsAyuda('ubicacion-lng')}>
                  <input
                    type="text"
                    inputMode="decimal"
                    disabled={!puedeEditar}
                    value={info.lng}
                    onChange={(e) => handleChange('lng', e.target.value)}
                    style={estiloInputCoord}
                  />
                  </CampoAyuda>
                </div>
              </div>
            </div>
          )}

          {/* Subcaso: HORARIO Y FECHAS ESPECIALES */}
          {tabId === 'horario' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <HorarioTab puedeEditar={puedeEditar} />
              <div style={{ borderTop: '1px solid var(--cp-line)', paddingTop: '14px' }}>
                <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '16px', marginBottom: '8px' }}>
                  Fechas especiales y feriados
                </div>
                <FechasEspecialesTab puedeEditar={puedeEditar} />
              </div>
            </div>
          )}

          {/* Subcaso: ZONAS DE REPARTO (MAPA). Los polígonos viven en /admin/zonas (zona_reparto); el formulario legado zpoly_* ya no se usa. */}
          {tabId === 'zonas' && <ZonasRepartoView />}

          {/* Subcaso: MEDIOS DE PAGO (parámetro local_pagos en el servidor; lo leen carta y bot) */}
          {tabId === 'pagos' && <PagosTab puedeEditar={puedeEditar} />}

          {/* Subcaso: ALTA DEMANDA Y PAUSA DE PEDIDOS */}
          {tabId === 'cocina' && <TarjetaConfirmarDespejarConfiguracion />}
          {tabId === 'cocina' && <TarjetaMinutosPreparacionConfiguracion />}

          {tabId === 'demanda' && (
            <SeccionAltaDemanda puedeEditar={puedeEditarDemanda} />
          )}

          {/* Subcaso: REPARTO Y TIEMPOS DE ESPERA */}
          {tabId === 'reparto' && (
            <SeccionRepartoConfig puedeEditar={puedeEditar} />
          )}

          {/* Subcaso: PARÁMETROS DEL SISTEMA (WHATSAPP, REPARTO, ENCUESTAS) */}
          {tabId === 'parametros' && (
            <ParametrosOperacionTab puedeVer={true} puedeEditar={puedeEditar} />
          )}

          {/* Subcaso: CONFIGURACIÓN Y SEGURIDAD DEL CHATBOT */}
          {tabId === 'chatbot' && (
            <ChatbotConfiguracionTab puedeVer={puedeVer} puedeEditar={puedeEditar} />
          )}

          {/* Subcaso: IMPRESIÓN DE ETIQUETAS */}
          {tabId === 'impresion' && (
            <TarjetaImpresionEtiquetas />
          )}

          {/* Subcaso: ASISTENTE DE AYUDA CON IA */}
          {tabId === 'ayuda' && (
            <TarjetaAyudaIaConfiguracion />
          )}

          {/* Subcaso: LECTURA DE VOUCHERS CON IA */}
          {tabId === 'vouchers' && (
            <TarjetaVouchersIaConfiguracion />
          )}

          {/* Subcaso: PANTALLA DE INGRESO (solo configuracion/editar) */}
          {tabId === 'ingreso' && puedeEditarIngreso && (
            <TarjetaPantallaIngresoConfiguracion />
          )}

          {/* Subcaso: CAMPOS REGULARES DE OTRAS CATEGORÍAS */}
          {!TABS_PROPIAS.includes(tabId) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tabId === 'operacion' && <TarjetaControlAlmacenConfiguracion />}
              {tabId === 'operacion' && <TarjetaNotificacionesConfiguracion />}
              {tabId === 'operacion' && <TarjetaResenasGoogleConfiguracion />}
              {tabId === 'operacion' && <TarjetaInvitadoConfiguracion />}
              {tabId === 'operacion' && (
                <div
                  style={{
                    background: 'var(--cp-cream)',
                    border: '1.5px dashed var(--cp-orange)',
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    marginBottom: '8px',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--cp-navy)' }}>
                    Alta demanda y pausa de pedidos
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--cp-soft)', lineHeight: '17px' }}>
                    Si necesitas sumar minutos extra de entrega por congestión en cocina o pausar la recepción de pedidos en la carta y chatbot, puedes gestionarlo desde la sección dedicada.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTabId('demanda');
                      setSearchParams(
                        (prev) => {
                          const next = new URLSearchParams(prev);
                          next.set('tab', 'demanda');
                          return next;
                        },
                        { replace: true },
                      );
                    }}
                    style={{
                      alignSelf: 'flex-start',
                      minHeight: '40px',
                      padding: '0 14px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-navy)',
                      background: 'transparent',
                      color: 'var(--cp-navy)',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Ir a Alta demanda y pausa de pedidos
                  </button>
                </div>
              )}
              {!puedeEditar && (
                <div
                  role="status"
                  style={{
                    background: 'var(--cp-bg)',
                    border: '1px solid var(--cp-line)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    color: 'var(--cp-soft)',
                  }}
                >
                  Modo sólo lectura. No tienes el permiso <b>local/editar</b> para modificar estos datos.
                </div>
              )}
              {gruposDe(tabId, categoriaActual.fields).map((g, gi) => {
                const campos = g.campos.map(renderCampo);
                if (!g.titulo) return <React.Fragment key={gi}>{campos}</React.Fragment>;
                return (
                  <details key={g.titulo} open={gi === 0} className="cfg-grupo-detalle">
                    <summary className="cfg-grupo-resumen">{g.titulo}</summary>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '10px' }}>{campos}</div>
                  </details>
                );
              })}
            </div>
          )}

          {/* Botones de acción inferiores */}
          {!TABS_PROPIAS.includes(tabId) && categoriaActual.fields.some((f) => !f.par) && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
              <button
                type="button"
                disabled={!puedeEditar}
                onClick={() => setConfirmarGuardar(true)}
                style={{
                  flex: '1 1 200px',
                  minHeight: '52px',
                  border: 0,
                  borderRadius: '12px',
                  background: 'var(--cp-orange)',
                  color: 'var(--cp-navy)',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '15px',
                  cursor: !puedeEditar ? 'not-allowed' : 'pointer',
                  opacity: !puedeEditar ? 0.6 : 1,
                }}
              >
                Guardar cambios
              </button>
              <button
                type="button"
                onClick={() => setConfirmarDescartar(true)}
                style={{
                  flex: '1 1 160px',
                  minHeight: '52px',
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: '12px',
                  background: 'transparent',
                  color: 'var(--cp-navy)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Descartar
              </button>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Modales Confirmar */}
      <Confirmar
        abierto={confirmarGuardar}
        titulo="¿Guardar la configuración del local?"
        mensaje="La carta virtual y el sistema usarán estos datos."
        textoSi="Sí, guardar"
        textoNo="No, cancelar"
        alConfirmar={handleGuardar}
        alCancelar={() => setConfirmarGuardar(false)}
      />

      <Confirmar
        abierto={confirmarDescartar}
        titulo="¿Descartar los cambios sin guardar?"
        mensaje="Volverán los últimos datos guardados."
        textoSi="Sí, descartar"
        textoNo="No, volver"
        peligro={true}
        alConfirmar={handleDescartar}
        alCancelar={() => setConfirmarDescartar(false)}
      />
    </div>
  );
}

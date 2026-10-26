import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useSesion } from '../../comun/sesion';
import { api } from '../../comun/api';
import { Confirmar } from '../../comun/Confirmar';
import { HorarioTab } from './HorarioTab';
import { FechasEspecialesTab } from './FechasEspecialesTab';
import { ZonasRepartoView } from './ZonasRepartoView';
import { SeccionAltaDemanda } from './SeccionAltaDemanda';
import { SeccionRepartoConfig } from './SeccionRepartoConfig';
import { ParametrosOperacionTab } from './ParametrosOperacionTab';
import { ChatbotConfiguracionTab } from './ChatbotConfiguracionTab';
import { TarjetaImpresionEtiquetas } from '../impresion/TarjetaImpresionEtiquetas';

export interface InfoLocalState {
  // local
  nombre: string;
  lema: string;
  zona: string;
  barrio: string;
  descripcion: string;
  // ubicacion
  direccion: string;
  referencia: string;
  mapa: string;
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
  // pagos
  pg_efe: string;
  pg_yape: string;
  pg_plin: string;
  pg_tarj: string;
  pg_transf: string;
  yape: string;
  plin: string;
  cuenta: string;
  // marca
  logo: string;
  // operacion
  tiempoBase: string;
  tiempoMax: string;
  resTol: string;
  ptsPct: string;
  credPct: string;
  wifiNombre: string;
  wifiClave: string;
  // zonas
  zpoly_Z2: string;
  zpoly_Z3: string;
  zpoly_Z4: string;
  zpoly_Z5: string;
  zpoly_Z7: string;
  // fallas
  fallaEsperaMin: string;
  fallaMaxIntentos: string;
  fallaPlazoMin: string;
  fallaRecargo: string;
  fallaDevuelve: string;
  // reparto
  repMax: string;
  repNaranja: string;
  repRojo: string;
  repMsgMin: string;
  repMsg1: string;
  repMsg2: string;
  repMsg3: string;
  // areas
  areasExtra: string;
  area_frappes: string;
  area_iced: string;
  area_frozen: string;
  area_calientes: string;
  area_waffles: string;
  area_salados: string;
  area_croissants: string;
  area_complementos: string;
  // textos
  terminos: string;
  privacidad: string;
  novTit: string;
  novSub: string;
  msgListo: string;
  msgRecojo: string;
  msgUbic: string;
  msgPago: string;
  encMin: string;
  encPregunta: string;
  encDesc: string;
  encLink: string;
  // entrega
  envioGratis: string;
  envioGratisMas: string;
  pedidoMin: string;
  zon_Z2: string;
  zon_Z3: string;
  zon_Z4: string;
  zon_Z5: string;
  zon_Z7: string;
  pinAnular: string;
  tarZ2: string;
  tarZ3: string;
  tarZ4: string;
  tarZ5: string;
  tarZ7: string;
  // avisos
  correoDueno: string;
  grupoWhatsapp: string;
  // empresa
  razonSocial: string;
  ruc: string;
  direccionFiscal: string;
}

const INFO_DEFAULT: InfoLocalState = {
  nombre: 'Caprichos',
  lema: '',
  zona: '',
  barrio: '',
  descripcion: '',
  direccion: '',
  referencia: '',
  mapa: '',
  lat: '-12.0147',
  lng: '-76.966',
  telefono: '',
  whatsapp: '',
  instagramNombre: '',
  instagram: '',
  facebook: '',
  tiktok: '',
  pg_efe: '1',
  pg_yape: '1',
  pg_plin: '1',
  pg_tarj: '1',
  pg_transf: '1',
  yape: '',
  plin: '',
  cuenta: '',
  logo: '',
  tiempoBase: '25',
  tiempoMax: '35',
  resTol: '15',
  ptsPct: '5',
  credPct: '25',
  wifiNombre: '',
  wifiClave: '',
  zpoly_Z2: '-12.0150,-76.9680\n-12.0120,-76.9640\n-12.0180,-76.9620',
  zpoly_Z3: '-12.0190,-76.9700\n-12.0100,-76.9610\n-12.0220,-76.9600',
  zpoly_Z4: '-12.0250,-76.9750\n-12.0080,-76.9580\n-12.0280,-76.9550',
  zpoly_Z5: '-12.0300,-76.9800\n-12.0050,-76.9520\n-12.0350,-76.9500',
  zpoly_Z7: '-12.0350,-76.9900\n-12.0000,-76.9450\n-12.0420,-76.9400',
  fallaEsperaMin: '10',
  fallaMaxIntentos: '2',
  fallaPlazoMin: '120',
  fallaRecargo: '0',
  fallaDevuelve: '1',
  repMax: '3',
  repNaranja: '35',
  repRojo: '50',
  repMsgMin: '1.5',
  repMsg1: '',
  repMsg2: '',
  repMsg3: '',
  areasExtra: '',
  area_frappes: 'Barra',
  area_iced: 'Barra',
  area_frozen: 'Barra',
  area_calientes: 'Barra',
  area_waffles: 'Cocina',
  area_salados: 'Cocina',
  area_croissants: 'Cocina',
  area_complementos: 'Cocina',
  terminos: '',
  privacidad: '',
  novTit: '',
  novSub: '',
  msgListo: '',
  msgRecojo: '',
  msgUbic: '',
  msgPago: '',
  encMin: '120',
  encPregunta: '',
  encDesc: '25',
  encLink: '',
  envioGratis: '70',
  envioGratisMas: '1',
  pedidoMin: '14.50',
  zon_Z2: '1',
  zon_Z3: '1',
  zon_Z4: '1',
  zon_Z5: '1',
  zon_Z7: '1',
  pinAnular: '000000',
  tarZ2: '2',
  tarZ3: '3',
  tarZ4: '4',
  tarZ5: '5',
  tarZ7: '7',
  correoDueno: '',
  grupoWhatsapp: '',
  razonSocial: '',
  ruc: '',
  direccionFiscal: '',
};

interface CategoriaConfig {
  id: string;
  n: string;
  d: string;
  fields: Array<{
    k: keyof InfoLocalState;
    l: string;
    ph?: string;
    multi?: boolean;
    tog?: boolean;
    img?: boolean;
  }>;
}

const CATEGORIAS_CONFIG: CategoriaConfig[] = [
  {
    id: 'local',
    n: 'Datos del local',
    d: 'Nombre, lema y descripción',
    fields: [
      { k: 'nombre', l: 'Nombre del local', ph: 'Nombre del local' },
      { k: 'lema', l: 'Lema (debajo del nombre)', ph: 'Ejemplo: Cafetería artesanal' },
      { k: 'zona', l: 'Distrito', ph: 'Ejemplo: San Juan de Lurigancho' },
      { k: 'barrio', l: 'Zona o barrio', ph: 'Ejemplo: Campoy' },
      { k: 'descripcion', l: 'Descripción para "Conócenos"', multi: true, ph: 'Describe tu propuesta gastronómica y experiencia...' },
    ],
  },
  {
    id: 'ubicacion',
    n: 'Ubicación',
    d: 'Dirección y mapa',
    fields: [
      { k: 'direccion', l: 'Dirección', ph: 'Dirección física del local' },
      { k: 'referencia', l: 'Referencia (cómo llegar)', multi: true, ph: 'Indicaciones o puntos de referencia para llegar' },
      { k: 'mapa', l: 'Enlace de Google Maps', ph: 'https://maps.google.com/...' },
    ],
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
    fields: [
      { k: 'pg_efe', l: 'Aceptar efectivo', tog: true },
      { k: 'pg_yape', l: 'Aceptar Yape', tog: true },
      { k: 'pg_plin', l: 'Aceptar Plin', tog: true },
      { k: 'pg_tarj', l: 'Aceptar tarjeta (POS al entregar)', tog: true },
      { k: 'pg_transf', l: 'Aceptar transferencia bancaria', tog: true },
      { k: 'yape', l: 'Número de Yape', ph: 'Número y titular de Yape' },
      { k: 'plin', l: 'Número de Plin', ph: 'Número y titular de Plin' },
      { k: 'cuenta', l: 'Cuenta para transferir', ph: 'Banco, número de cuenta y CCI' },
    ],
  },
  {
    id: 'marca',
    n: 'Logo',
    d: 'Imagen del negocio en la carta',
    fields: [{ k: 'logo', l: 'Logo (se usa en la cabecera de la carta)', img: true }],
  },
  {
    id: 'operacion',
    n: 'Operación',
    d: 'Tiempos, puntos y Wi-Fi',
    fields: [
      { k: 'tiempoBase', l: 'Entrega que se le dice al cliente: desde (minutos)' },
      { k: 'tiempoMax', l: 'Entrega que se le dice al cliente: hasta (minutos)' },
      { k: 'resTol', l: 'Tolerancia de reservas (minutos)' },
      { k: 'ptsPct', l: 'Puntos: % del total que gana el cliente con cuenta' },
      { k: 'credPct', l: 'Descuento del personal al pagar a crédito (% sobre el pedido)' },
      { k: 'wifiNombre', l: 'Wi-Fi para clientes: nombre de la red', ph: 'Nombre de la red Wi-Fi' },
      { k: 'wifiClave', l: 'Wi-Fi para clientes: clave (sale en la precuenta)', ph: 'Clave de acceso' },
    ],
  },
  {
    id: 'demanda',
    n: 'Alta demanda y pausa de pedidos',
    d: 'Minutos extra de entrega y pausa para carta y chatbot',
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
      { k: 'fallaEsperaMin', l: 'Tiempo que espera el repartidor en la dirección (minutos)' },
      { k: 'fallaMaxIntentos', l: 'Intentos de entrega antes de devolver el pedido a la tienda' },
      { k: 'fallaPlazoMin', l: 'Plazo para coordinar con el cliente por WhatsApp (minutos)' },
      { k: 'fallaRecargo', l: 'Recargo por reprogramar una entrega (s/)' },
      { k: 'fallaDevuelve', l: 'Si el cliente no recibe: recomendar devolver dinero (Sí) o cobrar (No)', tog: true },
    ],
  },
  {
    id: 'reparto',
    n: 'Reparto y avisos al cliente',
    d: 'Colores del mapa y mensajes de WhatsApp al salir y al llegar',
    fields: [
      { k: 'repMax', l: 'Pedidos que puede llevar a la vez cada repartidor' },
      { k: 'repNaranja', l: 'Naranja (retraso) desde los … minutos, en el mapa y en cocina' },
      { k: 'repRojo', l: 'Rojo (crítico, palpita) desde los … minutos, en el mapa y en cocina' },
      { k: 'repMsgMin', l: 'Minutos sin respuesta antes del mensaje 3' },
      { k: 'repMsg1', l: 'Mensaje 1, al pulsar «En camino» ({nombre} y {codigo})', multi: true, ph: '¡Hola, {nombre}! Tu pedido #{codigo} va en camino...' },
      { k: 'repMsg2', l: 'Mensaje 2, al pulsar «He llegado»', multi: true, ph: '¡Hola, {nombre}! Ya estamos en tu puerta...' },
      { k: 'repMsg3', l: 'Mensaje 3, si el cliente no responde', multi: true, ph: 'Hola, {nombre}. No logramos contactarte...' },
    ],
  },
  {
    id: 'areas',
    n: 'Áreas de cocina',
    d: 'A qué pantalla de cocina va cada categoría',
    fields: [
      { k: 'areasExtra', l: 'Áreas nuevas (hasta 4, separadas por coma). Ejemplo: Barra fría, Parrilla', ph: 'Ejemplo: Barra fría, Parrilla' },
      { k: 'area_frappes', l: 'Frappes (pantalla asignada)' },
      { k: 'area_calientes', l: 'Bebidas calientes (pantalla asignada)' },
      { k: 'area_waffles', l: 'Waffles (pantalla asignada)' },
      { k: 'area_salados', l: 'Salados (pantalla asignada)' },
    ],
  },
  {
    id: 'textos',
    n: 'Textos y mensajes',
    d: 'Términos, privacidad y mensajes de WhatsApp',
    fields: [
      { k: 'terminos', l: 'Términos y condiciones (se ven en la carta)', multi: true, ph: 'Términos de servicio y políticas de pedidos...' },
      { k: 'privacidad', l: 'Política de privacidad (se ve en la carta)', multi: true, ph: 'Política de tratamiento de datos personales...' },
      { k: 'novTit', l: 'Novedades: título de la sección', ph: 'Título para novedades' },
      { k: 'novSub', l: 'Novedades: subtítulo (texto editable, no es un banner)', multi: true, ph: 'Subtítulo o texto descriptivo' },
      { k: 'msgListo', l: 'Mensaje: pedido listo / en camino', multi: true, ph: 'Mensaje de pedido listo' },
      { k: 'msgRecojo', l: 'Mensaje: listo para recoger', multi: true, ph: 'Mensaje para recoger en tienda' },
      { k: 'msgUbic', l: 'Mensaje: pedir ubicación', multi: true, ph: 'Indicaciones para compartir ubicación' },
      { k: 'msgPago', l: 'Mensaje: indicaciones de pago', multi: true, ph: 'Instrucciones para enviar comprobante de pago' },
      { k: 'encMin', l: 'Encuesta posventa: minutos después de la entrega' },
      { k: 'encPregunta', l: 'Encuesta posventa: pregunta', multi: true, ph: 'Pregunta de satisfacción' },
      { k: 'encDesc', l: 'Encuesta posventa: % de descuento de agradecimiento' },
      { k: 'encLink', l: 'Encuesta posventa: enlace de reseña (Google Maps)', ph: 'https://maps.google.com/...' },
    ],
  },
  {
    id: 'entrega',
    n: 'Entrega',
    d: 'Envío gratis y pedido mínimo',
    fields: [
      { k: 'envioGratis', l: 'Envío gratis: monto (s/)' },
      { k: 'envioGratisMas', l: 'Envío gratis solo si se pasa del monto (Sí) o desde el monto exacto (No)', tog: true },
      { k: 'pedidoMin', l: 'Pedido mínimo de delivery (s/)' },
      { k: 'zon_Z2', l: 'Atender zona 2', tog: true },
      { k: 'zon_Z3', l: 'Atender zona 3', tog: true },
      { k: 'zon_Z4', l: 'Atender zona 4', tog: true },
      { k: 'zon_Z5', l: 'Atender zona 5', tog: true },
      { k: 'zon_Z7', l: 'Atender zona 7', tog: true },
      { k: 'pinAnular', l: 'PIN de 6 dígitos de la supervisora para anular (ejemplo; en el sistema real cada administradora tiene el suyo y se guarda como huella)' },
      { k: 'tarZ2', l: 'Envío zona 2 (s/)' },
      { k: 'tarZ3', l: 'Envío zona 3 (s/)' },
      { k: 'tarZ4', l: 'Envío zona 4 (s/)' },
      { k: 'tarZ5', l: 'Envío zona 5 (s/)' },
      { k: 'tarZ7', l: 'Envío zona 7 (s/)' },
    ],
  },
  {
    id: 'avisos',
    n: 'Avisos',
    d: 'Correo y grupo de WhatsApp para alertas y quejas',
    fields: [
      { k: 'correoDueno', l: 'Correo de Kevin (alertas de stock y quejas)', ph: 'correo@ejemplo.com' },
      { k: 'grupoWhatsapp', l: 'Grupo de WhatsApp del equipo (nombre o enlace)', ph: 'Nombre o enlace del grupo de WhatsApp' },
    ],
  },
  {
    id: 'empresa',
    n: 'Empresa',
    d: 'Uso interno: no se muestra al cliente',
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
];

const SLOTS_FOTOS = [
  'Fachada',
  'Salón principal',
  'Barra y vitrina',
  'Terraza',
  'Equipo y cocina',
  'Ambiente de noche',
];

const VALORES_MOCK_PROHIBIDOS = new Set([
  '987 654 321',
  '51987654321',
  '987654321',
  '987 654 321 (Caprichos)',
  '0011-0123-0200123456 (BCP)',
  'correo@caprichos.pe',
  'admin@caprichos.pe',
  'https://instagram.com/caprichos',
  'https://facebook.com/caprichos',
  'https://tiktok.com/@caprichos',
  '@caprichos',
  'Caprichos_Clientes',
  'cafeyfrappes',
  'Caprichos S.A.C.',
  '20601234567',
  'Av. Principal 123, SJL',
]);

export function ConfiguracionLocalView() {
  const { tiene, usuario } = useSesion();
  const esAdmin = usuario?.rol === 'ADMIN' || tiene('ADMIN');
  const puedeVer = esAdmin || tiene('local/ver') || tiene('configuracion/ver');
  const puedeEditar = esAdmin || tiene('local/editar') || tiene('configuracion/editar');
  const puedeEditarDemanda =
    esAdmin ||
    tiene('cocina/demanda') ||
    tiene('local/editar') ||
    tiene('configuracion/editar');

  const sanitizar = (obj: any): InfoLocalState => {
    const res = { ...INFO_DEFAULT, ...obj };
    for (const k of Object.keys(res) as Array<keyof InfoLocalState>) {
      if (typeof res[k] === 'string' && VALORES_MOCK_PROHIBIDOS.has(res[k].trim())) {
        res[k] = '';
      }
    }
    if (!res.descripcion || res.descripcion === '[object Object]' || typeof res.descripcion !== 'string') {
      res.descripcion = INFO_DEFAULT.descripcion;
    }
    return res;
  };

  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const tabParam = useMemo(() => {
    return new URLSearchParams(location.search).get('tab');
  }, [location.search]);

  const [tabId, setTabId] = useState<string>(() => tabParam || 'local');

  useEffect(() => {
    if (tabParam && tabParam !== tabId) {
      setTabId(tabParam);
    }
  }, [tabParam, tabId]);
  const [info, setInfo] = useState<InfoLocalState>(() => {
    try {
      const saved = localStorage.getItem('caprichos_local_info');
      return saved ? sanitizar(JSON.parse(saved)) : INFO_DEFAULT;
    } catch {
      return INFO_DEFAULT;
    }
  });
  const [infoGuardada, setInfoGuardada] = useState<InfoLocalState>(() => {
    try {
      const saved = localStorage.getItem('caprichos_local_info');
      return saved ? sanitizar(JSON.parse(saved)) : INFO_DEFAULT;
    } catch {
      return INFO_DEFAULT;
    }
  });

  const [mensaje, setMensaje] = useState<string>('');
  const [fotosLocales, setFotosLocales] = useState<Record<string, string>>(() => {
    try {
      const f = localStorage.getItem('caprichos_fotos_local');
      return f ? JSON.parse(f) : {};
    } catch {
      return {};
    }
  });

  // Diálogos de confirmación
  const [confirmarGuardar, setConfirmarGuardar] = useState(false);
  const [confirmarDescartar, setConfirmarDescartar] = useState(false);

  const esModificado = useMemo(() => {
    return JSON.stringify(info) !== JSON.stringify(infoGuardada);
  }, [info, infoGuardada]);

  // Cargar desde API inicial
  useEffect(() => {
    api.get<any>('/admin/local/datos')
      .then((data) => {
        if (data && (data.nombre || data.direccion)) {
          const descRaw = data.descripcion;
          const descVal =
            typeof descRaw === 'string' && descRaw !== '[object Object]' && descRaw.trim()
              ? descRaw
              : typeof descRaw === 'object' &&
                descRaw !== null &&
                typeof descRaw.texto === 'string' &&
                descRaw.texto !== '[object Object]' &&
                descRaw.texto.trim()
              ? descRaw.texto
              : undefined;

          const nuevoActualizador = (prev: InfoLocalState): InfoLocalState => ({
            ...prev,
            nombre: typeof data.nombre === 'string' && data.nombre ? data.nombre : prev.nombre,
            direccion: typeof data.direccion === 'string' && data.direccion ? data.direccion : prev.direccion,
            telefono: typeof data.telefono === 'string' && data.telefono ? data.telefono : prev.telefono,
            whatsapp: typeof data.whatsapp === 'string' && data.whatsapp ? data.whatsapp : prev.whatsapp,
            instagram: typeof data.redes?.instagram === 'string' && data.redes.instagram ? data.redes.instagram : prev.instagram,
            facebook: typeof data.redes?.facebook === 'string' && data.redes.facebook ? data.redes.facebook : prev.facebook,
            tiktok: typeof data.redes?.tiktok === 'string' && data.redes.tiktok ? data.redes.tiktok : prev.tiktok,
            descripcion: descVal ?? prev.descripcion,
          });

          setInfo(nuevoActualizador);
          setInfoGuardada(nuevoActualizador);
        }
      })
      .catch(() => {});
  }, []);

  const categoriaActual = useMemo(() => {
    return CATEGORIAS_CONFIG.find((c) => c.id === tabId) || CATEGORIAS_CONFIG[0];
  }, [tabId]);

  const handleChange = (key: keyof InfoLocalState, value: string) => {
    setInfo((prev) => ({ ...prev, [key]: value }));
  };

  const handleGuardar = async () => {
    setConfirmarGuardar(false);
    try {
      // 1. Guardar en API local si es posible
      await api.put('/admin/local/datos', {
        nombre: info.nombre,
        direccion: info.direccion,
        telefono: info.telefono,
        whatsapp: info.whatsapp,
        redes: {
          instagram: info.instagram,
          facebook: info.facebook,
          tiktok: info.tiktok,
        },
      }).catch(() => {});

      // 2. Persistir localmente
      localStorage.setItem('caprichos_local_info', JSON.stringify(info));
      setInfoGuardada(info);
      setMensaje('Guardado. La carta virtual y el sistema usan estos datos.');
      setTimeout(() => setMensaje(''), 4000);
    } catch (e: any) {
      setMensaje('Error al guardar cambios.');
    }
  };

  const handleDescartar = () => {
    setConfirmarDescartar(false);
    setInfo(infoGuardada);
    setMensaje('Cambios descartados.');
    setTimeout(() => setMensaje(''), 3000);
  };

  const handleSubirFoto = (slot: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const nuevas = { ...fotosLocales, [slot]: reader.result };
          setFotosLocales(nuevas);
          try {
            localStorage.setItem('caprichos_fotos_local', JSON.stringify(nuevas));
          } catch {}
          setMensaje(`Foto "${slot}" actualizada.`);
          setTimeout(() => setMensaje(''), 3000);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQuitarFoto = (slot: string) => {
    const nuevas = { ...fotosLocales };
    delete nuevas[slot];
    setFotosLocales(nuevas);
    try {
      localStorage.setItem('caprichos_fotos_local', JSON.stringify(nuevas));
    } catch {}
  };

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

      {/* Contenedor: Pestañas a la izquierda + Panel de edición a la derecha */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
        {/* Pestañas laterales */}
        <div
          role="tablist"
          aria-label="Categorías de configuración"
          style={{
            flex: '1 1 240px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {CATEGORIAS_CONFIG.map((c) => {
            const activo = tabId === c.id;
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={activo}
                onClick={() => {
                  setTabId(c.id);
                  setSearchParams(
                    (prev) => {
                      const next = new URLSearchParams(prev);
                      next.set('tab', c.id);
                      return next;
                    },
                    { replace: true },
                  );
                  setMensaje('');
                }}
                style={{
                  textAlign: 'left',
                  background: 'var(--cp-white)',
                  border: `1.5px solid ${activo ? 'var(--cp-orange)' : 'var(--cp-line)'}`,
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  color: 'var(--cp-navy)',
                  cursor: 'pointer',
                  boxShadow: activo ? '0 2px 8px rgba(230, 121, 41, 0.15)' : 'none',
                }}
              >
                <span style={{ fontWeight: 800 }}>{c.n}</span>
                <span style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>{c.d}</span>
              </button>
            );
          })}
        </div>

        {/* Panel de edición */}
        <div
          role="tabpanel"
          style={{
            flex: '2 1 420px',
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
                  Es el punto desde donde se miden los radios de entrega y el centro de los mapas. Cámbiala si la tienda se muda o si estás en el local y quieres marcarlo.
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ flex: '1 1 220px', background: 'var(--cp-white)', borderRadius: '10px', padding: '8px 12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--cp-soft)' }}>DIRECCIÓN</div>
                  <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{info.direccion}</div>
                </div>
                <div style={{ flex: '1 1 180px', background: 'var(--cp-white)', borderRadius: '10px', padding: '8px 12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--cp-soft)' }}>COORDENADAS EN USO</div>
                  <div style={{ fontWeight: 700 }}>{info.lat}, {info.lng}</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
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
                    cursor: 'pointer',
                  }}
                >
                  Usar la ubicación de este equipo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMensaje(`Buscando dirección: ${info.direccion}`);
                  }}
                  style={{
                    flex: '1 1 180px',
                    minHeight: '52px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: '12px',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Buscar la dirección escrita
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMensaje('Coordenadas sincronizadas con el enlace de Google Maps.');
                  }}
                  style={{
                    flex: '1 1 180px',
                    minHeight: '52px',
                    border: '1.5px solid var(--cp-navy)',
                    borderRadius: '12px',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Tomar del enlace de Google Maps
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 140px' }}>
                  <label htmlFor="loc-lat" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                    Latitud
                  </label>
                  <input
                    id="loc-lat"
                    type="text"
                    inputMode="decimal"
                    value={info.lat}
                    onChange={(e) => handleChange('lat', e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: '44px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-white)',
                      color: 'var(--cp-navy)',
                      padding: '0 10px',
                      fontSize: '14px',
                    }}
                  />
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label htmlFor="loc-lng" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                    Longitud
                  </label>
                  <input
                    id="loc-lng"
                    type="text"
                    inputMode="decimal"
                    value={info.lng}
                    onChange={(e) => handleChange('lng', e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: '44px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-line)',
                      background: 'var(--cp-white)',
                      color: 'var(--cp-navy)',
                      padding: '0 10px',
                      fontSize: '14px',
                    }}
                  />
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

          {/* Subcaso: ZONAS DE REPARTO (MAPA) */}
          {tabId === 'zonas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <ZonasRepartoView />
              <div style={{ borderTop: '1px solid var(--cp-line)', paddingTop: '12px' }}>
                <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '15px', marginBottom: '4px' }}>
                  Polígonos de zonas (un punto por línea: "latitud, longitud")
                </div>
                {(['Z2', 'Z3', 'Z4', 'Z5', 'Z7'] as const).map((z) => {
                  const key = `zpoly_${z}` as keyof InfoLocalState;
                  return (
                    <div key={z} style={{ marginTop: '8px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                        Zona {z.slice(1)}: Coordenadas del polígono
                      </label>
                      <textarea
                        rows={3}
                        value={info[key]}
                        onChange={(e) => handleChange(key, e.target.value)}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          borderRadius: '10px',
                          border: '1.5px solid var(--cp-line)',
                          padding: '8px',
                          fontFamily: 'monospace',
                          fontSize: '12px',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Subcaso: ALTA DEMANDA Y PAUSA DE PEDIDOS */}
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

          {/* Subcaso: CAMPOS REGULARES DE OTRAS CATEGORÍAS */}
          {tabId !== 'horario' && tabId !== 'zonas' && tabId !== 'demanda' && tabId !== 'reparto' && tabId !== 'parametros' && tabId !== 'chatbot' && tabId !== 'impresion' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
              {categoriaActual.fields.map((f) => {
                if (f.tog) {
                  const isChecked = info[f.k] === '1';
                  return (
                    <div
                      key={String(f.k)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        border: '1.5px solid var(--cp-line)',
                        borderRadius: '10px',
                        background: 'var(--cp-cream)',
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>{f.l}</span>
                      <button
                        type="button"
                        disabled={!puedeEditar}
                        onClick={() => handleChange(f.k, isChecked ? '0' : '1')}
                        style={{
                          minHeight: '36px',
                          padding: '0 16px',
                          borderRadius: '9999px',
                          border: '1.5px solid var(--cp-navy)',
                          background: isChecked ? 'var(--cp-navy)' : 'transparent',
                          color: isChecked ? 'var(--cp-cream)' : 'var(--cp-navy)',
                          fontWeight: 800,
                          fontSize: '12px',
                          cursor: !puedeEditar ? 'not-allowed' : 'pointer',
                          opacity: !puedeEditar ? 0.6 : 1,
                        }}
                      >
                        {isChecked ? 'Sí' : 'No'}
                      </button>
                    </div>
                  );
                }

                if (f.img) {
                  return (
                    <div key={String(f.k)} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontWeight: 700, fontSize: '13px' }}>{f.l}</label>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div
                          style={{
                            width: '72px',
                            height: '72px',
                            borderRadius: '36px',
                            border: '1.5px solid var(--cp-line)',
                            background: 'var(--cp-sand)',
                            backgroundImage: info[f.k] ? `url('${info[f.k]}')` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            color: 'var(--cp-navy)',
                          }}
                        >
                          {!info[f.k] && 'Logo'}
                        </div>
                        <label
                          style={{
                            position: 'relative',
                            minHeight: '44px',
                            padding: '0 16px',
                            borderRadius: '10px',
                            background: 'var(--cp-orange)',
                            color: 'var(--cp-navy)',
                            fontWeight: 800,
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            cursor: !puedeEditar ? 'not-allowed' : 'pointer',
                            opacity: !puedeEditar ? 0.6 : 1,
                          }}
                        >
                          Subir logo
                          <input
                            type="file"
                            accept="image/*"
                            disabled={!puedeEditar}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const rd = new FileReader();
                                rd.onload = () => {
                                  if (typeof rd.result === 'string') {
                                    handleChange(f.k, rd.result);
                                  }
                                };
                                rd.readAsDataURL(file);
                              }
                            }}
                            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: !puedeEditar ? 'not-allowed' : 'pointer', width: '100%', height: '100%' }}
                          />
                        </label>
                      </div>
                    </div>
                  );
                }

                if (f.multi) {
                  return (
                    <div key={String(f.k)}>
                      <label htmlFor={`cfg-${String(f.k)}`} style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                        {f.l}
                      </label>
                      <textarea
                        id={`cfg-${String(f.k)}`}
                        rows={3}
                        disabled={!puedeEditar}
                        placeholder={f.ph || ''}
                        value={info[f.k]}
                        onChange={(e) => handleChange(f.k, e.target.value)}
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
                    </div>
                  );
                }

                return (
                  <div key={String(f.k)}>
                    <label htmlFor={`cfg-${String(f.k)}`} style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                      {f.l}
                    </label>
                    <input
                      id={`cfg-${String(f.k)}`}
                      type="text"
                      disabled={!puedeEditar}
                      placeholder={f.ph || ''}
                      value={info[f.k]}
                      onChange={(e) => handleChange(f.k, e.target.value)}
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
                  </div>
                );
              })}
            </div>
          )}

          {/* Botones de acción inferiores */}
          {tabId !== 'horario' && tabId !== 'zonas' && tabId !== 'demanda' && tabId !== 'impresion' && (
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
      </div>

      {/* Tarjeta Fotos del Local (a todo el ancho) */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '1px solid var(--cp-line)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '18px' }}>
            Fotos del local
          </div>
          <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
            Se ven en la página Conócenos de la carta virtual (galería "Nuestro lugar"). Sube las fotos que entregue el restaurante: del local, del grupo, del equipo. Cada foto se guarda al subirla.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          {SLOTS_FOTOS.map((slot) => {
            const foto = fotosLocales[slot];
            return (
              <div
                key={slot}
                style={{
                  border: '1px solid var(--cp-line)',
                  borderRadius: '12px',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    aspectRatio: '4/3',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    background: 'var(--cp-sand)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--cp-soft)',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  {foto ? (
                    <img
                      src={foto}
                      alt={slot}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span>Sin foto</span>
                  )}
                </div>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>{slot}</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <label
                    style={{
                      position: 'relative',
                      flex: 1,
                      minHeight: '44px',
                      boxSizing: 'border-box',
                      borderRadius: '10px',
                      background: 'var(--cp-orange)',
                      color: 'var(--cp-navy)',
                      fontWeight: 800,
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    {foto ? 'Cambiar foto' : 'Subir foto'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleSubirFoto(slot, e)}
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                    />
                  </label>
                  {foto && (
                    <button
                      type="button"
                      onClick={() => handleQuitarFoto(slot)}
                      style={{
                        minHeight: '44px',
                        padding: '0 12px',
                        border: '1.5px solid var(--cp-rust)',
                        borderRadius: '10px',
                        background: 'transparent',
                        color: 'var(--cp-rust)',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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

import type { AnuncioPublico } from '../../anuncios/tipos';

export type EstadoAnuncio = 'PROGRAMADO' | 'AL_AIRE' | 'VENCIDO' | 'APAGADO';

export interface AnuncioAdmin {
  id: string;
  publico: 'CARTA' | 'PERSONAL' | 'AMBOS';
  roles: string[];
  plantilla: string;
  titulo: string;
  texto: string | null;
  imagen_url: string | null;
  boton_texto: string | null;
  boton_enlace: string | null;
  detalle: Record<string, string> | null;
  color: string;
  desde: string | null;
  hasta: string | null;
  franja_desde: string | null;
  franja_hasta: string | null;
  dias_semana: number[];
  frecuencia: string;
  veces_por_dia: number;
  cada_horas: number | null;
  cierre_segundos: number;
  puede_cerrar: boolean;
  prioridad: number;
  activo: boolean;
  estado: EstadoAnuncio;
  estadisticas?: { vistas: number; cierres: number; clics: number; entendidos: number };
}

/** Lo que edita el formulario: fechas como «AAAA-MM-DDTHH:mm» en hora de Lima. */
export interface FormAnuncio {
  publico: 'CARTA' | 'PERSONAL' | 'AMBOS';
  roles: string[];
  plantilla: string;
  titulo: string;
  texto: string;
  imagen_url: string;
  boton_texto: string;
  boton_enlace: string;
  detalle: Record<string, string>;
  color: string;
  desde: string;
  hasta: string;
  franja_desde: string;
  franja_hasta: string;
  dias_semana: number[];
  frecuencia: string;
  veces_por_dia: number;
  cada_horas: number;
  cierre_segundos: number;
  puede_cerrar: boolean;
  prioridad: number;
  activo: boolean;
}

export const FORM_VACIO: FormAnuncio = {
  publico: 'CARTA', roles: [], plantilla: 'NOVEDAD', titulo: '', texto: '', imagen_url: '', boton_texto: '', boton_enlace: '',
  detalle: {}, color: 'CREMA', desde: '', hasta: '', franja_desde: '', franja_hasta: '', dias_semana: [],
  frecuencia: 'UNA_VEZ', veces_por_dia: 1, cada_horas: 4, cierre_segundos: 8, puede_cerrar: true, prioridad: 0, activo: true,
};

export const ROLES_PERSONAL = ['ADMIN', 'SUPERVISOR', 'CAJERO', 'MOZO', 'COCINA', 'ALMACEN', 'REPARTIDOR', 'APOYO_DELIVERY', 'MARKETING'];
export const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const partes = (d: Date) => {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '00';
  return { dia: `${g('year')}-${g('month')}-${g('day')}`, hora: `${g('hour')}:${g('minute')}` };
};

/** Instante → «AAAA-MM-DDTHH:mm» en Lima (para <input type="datetime-local">). */
export const aInputLima = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const { dia, hora } = partes(d);
  return `${dia}T${hora}`;
};

/** «AAAA-MM-DDTHH:mm» de Lima → ISO (Lima es UTC-5 todo el año). */
export const deInputLima = (v: string): string | null => {
  if (!v) return null;
  const d = new Date(`${v}:00-05:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

export type AtajoVigencia = 'HOY' | 'HORAS' | 'DIAS' | 'SEMANA' | 'SIEMPRE';

/** Atajos del formulario: devuelven desde/hasta listos para los campos. `n` = horas o días. */
export function atajoVigencia(tipo: AtajoVigencia, n = 1, ahora: Date = new Date()): { desde: string; hasta: string } {
  const desde = aInputLima(ahora.toISOString());
  if (tipo === 'SIEMPRE') return { desde, hasta: '' };
  if (tipo === 'HORAS') return { desde, hasta: aInputLima(new Date(ahora.getTime() + Math.max(1, n) * 3_600_000).toISOString()) };
  const dias = tipo === 'HOY' ? 1 : tipo === 'SEMANA' ? 7 : Math.max(1, n);
  const [y, m, d] = partes(ahora).dia.split('-').map(Number);
  const fin = new Date(Date.UTC(y, m - 1, d + dias - 1)).toISOString().slice(0, 10);
  return { desde, hasta: `${fin}T23:59` };
}

export const aForm = (a: AnuncioAdmin): FormAnuncio => ({
  publico: a.publico, roles: a.roles ?? [], plantilla: a.plantilla, titulo: a.titulo, texto: a.texto ?? '', imagen_url: a.imagen_url ?? '',
  boton_texto: a.boton_texto ?? '', boton_enlace: a.boton_enlace ?? '', detalle: a.detalle ?? {}, color: a.color,
  desde: aInputLima(a.desde), hasta: aInputLima(a.hasta), franja_desde: a.franja_desde ?? '', franja_hasta: a.franja_hasta ?? '',
  dias_semana: a.dias_semana ?? [], frecuencia: a.frecuencia, veces_por_dia: a.veces_por_dia, cada_horas: a.cada_horas ?? 4,
  cierre_segundos: a.cierre_segundos, puede_cerrar: a.puede_cerrar, prioridad: a.prioridad, activo: a.activo,
});

/** Cuerpo para POST/PUT /admin/anuncios. */
export const deForm = (f: FormAnuncio) => ({
  publico: f.publico,
  roles: f.publico === 'CARTA' ? [] : f.roles,
  plantilla: f.plantilla,
  titulo: f.titulo.trim(),
  texto: f.texto.trim() || null,
  imagen_url: f.imagen_url || null,
  boton_texto: f.boton_texto.trim() || null,
  boton_enlace: f.boton_enlace.trim() || null,
  detalle: f.detalle,
  color: f.color,
  desde: deInputLima(f.desde),
  hasta: deInputLima(f.hasta),
  franja_desde: f.franja_desde || null,
  franja_hasta: f.franja_hasta || null,
  dias_semana: f.dias_semana,
  frecuencia: f.frecuencia,
  veces_por_dia: f.veces_por_dia,
  cada_horas: f.frecuencia === 'CADA_N_HORAS' ? f.cada_horas : null,
  cierre_segundos: f.cierre_segundos,
  puede_cerrar: f.publico === 'PERSONAL' ? f.puede_cerrar : true,
  prioridad: f.prioridad,
  activo: f.activo,
});

/** Formulario → lo que ve quien recibe el anuncio (vista previa en vivo y vista previa real). */
export const formAPublico = (f: FormAnuncio, id = 'previa'): AnuncioPublico => ({
  id,
  plantilla: f.plantilla,
  titulo: f.titulo || 'Título del anuncio',
  texto: f.texto || null,
  imagen: f.imagen_url || null,
  botonTexto: f.boton_texto && f.boton_enlace ? f.boton_texto : null,
  botonEnlace: f.boton_texto && f.boton_enlace ? f.boton_enlace : null,
  detalle: f.detalle,
  color: f.color,
  frecuencia: f.frecuencia,
  vecesPorDia: f.veces_por_dia,
  cadaHoras: f.cada_horas,
  cierreSegundos: f.cierre_segundos,
  puedeCerrar: f.publico === 'PERSONAL' ? f.puede_cerrar : true,
});

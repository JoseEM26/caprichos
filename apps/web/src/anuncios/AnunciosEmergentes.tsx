import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../comun/api';
import { ModalAnuncio } from './ModalAnuncio';
import type { MotivoCierre } from './ModalAnuncio';
import { tocaPorFrecuencia } from './tipos';
import type { AnuncioPublico, TipoEventoAnuncio } from './tipos';

const MAX_POR_INGRESO = 3;
const CLAVE_VISTAS = 'caprichos_anuncios_vistas';
const CLAVE_SESION = 'caprichos_anuncios_sesion';

type Historial = Record<string, number[]>;

const claveDe = (a: 'local' | 'sesion') => (a === 'local' ? CLAVE_VISTAS : CLAVE_SESION);
const almacenDe = (a: 'local' | 'sesion') => (a === 'local' ? window.localStorage : window.sessionStorage);

const leer = (a: 'local' | 'sesion'): Historial => {
  try {
    const j = JSON.parse(almacenDe(a).getItem(claveDe(a)) ?? '{}');
    return j && typeof j === 'object' ? j : {};
  } catch {
    return {};
  }
};

const guardarVista = (id: string) => {
  for (const a of ['local', 'sesion'] as const) {
    try {
      const h = leer(a);
      h[id] = [...(h[id] ?? []), Date.now()].slice(-20);
      almacenDe(a).setItem(claveDe(a), JSON.stringify(h));
    } catch { /* sin almacenamiento (modo privado): puede repetirse al recargar */ }
  }
};

/**
 * Anuncios emergentes al ingresar. En la carta la frecuencia se recuerda en el navegador; en el panel la decide el servidor
 * (`/admin/anuncios/mios` ya trae solo los que tocan). Se muestran uno tras otro, máximo 3 por ingreso.
 * `listo` = false espera (p. ej. mientras el usuario debe cambiar su clave).
 */
export function AnunciosEmergentes({ origen, listo = true, pausado = false }: { origen: 'CARTA' | 'PERSONAL'; listo?: boolean; pausado?: boolean }) {
  const navigate = useNavigate();
  const [cola, setCola] = useState<AnuncioPublico[]>([]);
  const pedido = useRef(false);
  const base = origen === 'CARTA' ? '/carta/anuncios' : '/admin/anuncios/mios';

  useEffect(() => {
    if (!listo || pedido.current) return;
    pedido.current = true;
    let vivo = true;
    api.get<AnuncioPublico[]>(base)
      .then((lista) => {
        if (!vivo || !Array.isArray(lista)) return;
        let toca = lista;
        if (origen === 'CARTA') {
          const local = leer('local');
          const sesion = leer('sesion');
          // «Cada ingreso» en la carta = una vez por visita (pestaña), no cada recarga
          toca = lista.filter((a) => tocaPorFrecuencia(a, local[a.id] ?? []) && !(a.frecuencia === 'CADA_INGRESO' && (sesion[a.id]?.length ?? 0) > 0));
        } else {
          const sesion = leer('sesion');
          toca = lista.filter((a) => !(a.frecuencia === 'CADA_INGRESO' && (sesion[a.id]?.length ?? 0) > 0));
        }
        setCola(toca.slice(0, MAX_POR_INGRESO));
      })
      .catch(() => undefined); // un anuncio nunca debe romper la pantalla
    return () => { vivo = false; };
  }, [listo, base, origen]);

  const actual = cola[0];
  if (!actual || pausado) return null;

  const evento = (tipo: TipoEventoAnuncio) => {
    Promise.resolve(api.post(`${base}/${actual.id}/evento`, { tipo })).catch(() => undefined);
  };
  const alMontar = () => { guardarVista(actual.id); evento('VISTA'); };
  const alCerrar = (motivo: MotivoCierre) => {
    evento(motivo === 'ENTENDIDO' ? 'ENTENDIDO' : 'CIERRE');
    setCola((c) => c.slice(1));
  };
  const alClic = (enlace: string) => {
    evento('CLIC');
    setCola((c) => c.slice(1));
    navigate(enlace);
  };

  return <ModalAnuncio key={actual.id} anuncio={actual} alMontar={alMontar} alCerrar={alCerrar} alClicBoton={alClic} />;
}

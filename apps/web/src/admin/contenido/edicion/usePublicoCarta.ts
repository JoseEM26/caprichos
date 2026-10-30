import { useEffect, useState } from 'react';
import { api } from '../../../comun/api';
import type { ContenidoCarta, VistaPreviaCarta } from '../../../carta/CartaPublica';
import type { CategoriaCarta, DatosLocalCarta, EstadoLocalCarta } from '../../../carta/tipos';
import type { OfertaItem } from '../../ofertas/ofertasApi';

/** Lo que la carta pública muestra hoy (categorías, estado, datos del local, paleta…), para pintar la página que se edita. */
export function usePublicoCarta() {
  const [datos, setDatos] = useState<Omit<VistaPreviaCarta, 'contenido'> & { contenido: Partial<ContenidoCarta> | null } | null>(null);
  useEffect(() => {
    let vivo = true;
    Promise.all([
      api.get<CategoriaCarta[]>('/carta').catch(() => []),
      api.get<OfertaItem[]>('/carta/ofertas').catch(() => []),
      api.get<EstadoLocalCarta>('/carta/estado').catch(() => null),
      api.get<DatosLocalCarta>('/carta/local').catch(() => null),
      api.get<ContenidoCarta>('/carta/contenido').catch(() => null),
    ]).then(([categorias, ofertas, estadoLocal, datosLocal, contenido]) => {
      if (vivo) setDatos({ categorias: Array.isArray(categorias) ? categorias : [], ofertas: Array.isArray(ofertas) ? ofertas : [], estadoLocal, datosLocal, contenido });
    });
    return () => {
      vivo = false;
    };
  }, []);
  return datos;
}

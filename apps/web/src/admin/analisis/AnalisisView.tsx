import { useMemo } from 'react';
import { Pestanas } from '../../comun/ModalConPestanas';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { useSesion } from '../../comun/sesion';
import { FiltrosAnalisis } from './comun/FiltrosAnalisis';
import { useFiltrosAnalisis } from './comun/useFiltrosAnalisis';
import { PESTANAS_ANALISIS } from './registro';
import './comun/analisis.css';

/**
 * Módulo Análisis: una pestaña por tema con un filtro común de fechas (y los extras que cada pestaña pida).
 * La pestaña activa y los filtros viven en la dirección. El permiso analisis/ver lo exige también la ruta.
 */
export function AnalisisView() {
  const { usuario, tiene } = useSesion();
  const { filtros, errorFechas, hoy, cambiar, params } = useFiltrosAnalisis();
  const esAdmin = (usuario?.rol ?? '').toUpperCase() === 'ADMIN';

  const idUrl = params.get('pestana');
  const activa = PESTANAS_ANALISIS.find((p) => p.id === idUrl) ?? PESTANAS_ANALISIS[0];

  const pestanas = useMemo(
    () =>
      PESTANAS_ANALISIS.map((p) => ({
        id: p.id,
        etiqueta: p.etiqueta,
        persistente: false,
        contenido: errorFechas ? null : <p.Componente filtros={filtros} esAdmin={esAdmin} />,
      })),
    [filtros, errorFechas, esAdmin],
  );

  if (!tiene('analisis/ver')) {
    return <EstadoVacio titulo="Sin acceso" descripcion="Análisis es solo para el administrador y el supervisor." />;
  }

  return (
    <div className="an">
      <FiltrosAnalisis filtros={filtros} extras={activa.filtros} errorFechas={errorFechas} hoy={hoy} alCambiar={cambiar} />
      <Pestanas etiqueta="Temas de análisis" pestanas={pestanas} pestanaActiva={activa.id} alCambiarPestana={(id) => cambiar({ pestana: id })} />
    </div>
  );
}

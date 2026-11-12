import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pestanas } from '../../comun/ModalConPestanas';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { useSesion } from '../../comun/sesion';
import { aprendizajesApi } from './aprendizajesApi';
import { PorRevisar } from './PorRevisar';
import { Conocimiento } from './Conocimiento';
import { Noches } from './Noches';
import './aprendizajes.css';

/** Aprendizajes del bot: revisar lo que propone aprender cada noche. Ver = aprendizajes/ver; actuar = aprendizajes/aprobar. */
export default function AprendizajesView() {
  const { tiene } = useSesion();
  const [pendientes, setPendientes] = useState<number | null>(null);
  const puedeVer = tiene('aprendizajes/ver');
  const puedeAprobar = tiene('aprendizajes/aprobar');

  const contar = useCallback(() => { aprendizajesApi.resumen().then((r) => setPendientes(r.pendientes), () => {}); }, []);
  useEffect(() => { if (puedeVer) contar(); }, [puedeVer, contar]);

  const pestanas = useMemo(() => [
    { id: 'revisar', etiqueta: 'Por revisar', insignia: pendientes || null, persistente: false, contenido: <PorRevisar puedeAprobar={puedeAprobar} alCambiar={contar} /> },
    { id: 'sabe', etiqueta: 'Lo que sabe el bot', persistente: false, contenido: <Conocimiento puedeAprobar={puedeAprobar} /> },
    { id: 'noches', etiqueta: 'Noches', persistente: false, contenido: <Noches puedeAprobar={puedeAprobar} alCambiar={contar} /> },
  ], [pendientes, puedeAprobar, contar]);

  if (!puedeVer) return <EstadoVacio titulo="Sin acceso" descripcion="Aprendizajes es solo para el administrador." />;
  return <div className="ap"><Pestanas etiqueta="Aprendizajes del bot" pestanas={pestanas} /></div>;
}

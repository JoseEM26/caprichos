import { Insignia } from '../../comun/Insignia';
import type { SolicitudTurno } from './turnosApi';

/** Chips «Supervisión ✓ Nombre» / «Administración: falta» del avance de la doble aprobación. */
export function ChipsAprobacion({ s }: { s: SolicitudTurno }) {
  const a = s.aprobacion;
  if (!a || (s.estado !== 'PENDIENTE_APRUEBA' && s.estado !== 'APROBADA')) return null;
  return (
    <span className="tu-chips" aria-label="Avance de aprobación">
      <Insignia variante={a.supervision ? 'exito' : 'aviso'}>{a.supervision ? `Supervisión ✓ ${a.supervision.nombre}` : 'Supervisión: falta'}</Insignia>
      <Insignia variante={a.administracion ? 'exito' : 'aviso'}>{a.administracion ? `Administración ✓ ${a.administracion.nombre}` : 'Administración: falta'}</Insignia>
    </span>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { Insignia } from '../../comun/Insignia';
import { PagoHistorial, SueldoHistorial, ETIQUETA_CATEGORIA, obtenerSueldo, soles } from './planillaApi';
import type { CtlPlanilla } from './PlanillaPersonaTipos';

const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima' });

/** Pestaña «Historial»: pagos anteriores, cambios de sueldo («Vigente desde») y las correcciones y aprobaciones que quedan auditadas. */
export function PestanaHistorial({ c, pagos, errorPagos, reintentarPagos, abrirPeriodo }: {
  c: CtlPlanilla; pagos: PagoHistorial[] | null; errorPagos: boolean; reintentarPagos: () => void; abrirPeriodo: (desde: string) => void;
}) {
  const { d } = c;
  const [sueldos, setSueldos] = useState<SueldoHistorial[] | null>(null);
  const [errorSueldo, setErrorSueldo] = useState(false);
  const cargarSueldos = useCallback(() => {
    setErrorSueldo(false);
    obtenerSueldo(d.partyId).then((r) => setSueldos(r.historial ?? [])).catch(() => setErrorSueldo(true));
  }, [d.partyId]);
  useEffect(() => { cargarSueldos(); }, [cargarSueldos]);

  const anulados = d.ajustes.filter((a) => a.anulado);
  const extras = d.dias.filter((x) => x.extraAprobada && x.extraAprobadaEn);
  return (
    <div className="pp-seccion" data-testid="historial-planilla">
      <section aria-label="Pagos anteriores" className="pp-bloque">
        <h3 className="as-sub">Pagos anteriores</h3>
        {errorPagos ? (
          <div role="alert" className="as-aviso as-aviso--error">No pudimos cargar los pagos anteriores. <Boton type="button" variante="secundario" tamano="pequeno" onClick={reintentarPagos}>Reintentar</Boton></div>
        ) : !pagos ? <Cargando mensaje="Cargando pagos anteriores" /> : pagos.length === 0 ? <p className="as-ayuda">Todavía no tiene pagos registrados.</p> : (
          <ul className="pl-filas">
            {pagos.map((p) => (
              <li key={p.id} className="pl-fila" style={{ display: 'grid', justifyItems: 'stretch' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span>
                    <Insignia variante={p.estado === 'PAGADO' ? 'exito' : 'aviso'}>{p.estado === 'PAGADO' ? 'Pagado' : 'Reabierto'}</Insignia>{' '}
                    {p.desde} a {p.hasta}
                  </span>
                  <strong>{soles(p.neto)}</strong>
                </div>
                <small className="as-nota">Pagado el {fechaHora(p.pagadoEn)}{p.pagadoPorNombre ? ` por ${p.pagadoPorNombre}` : ''}</small>
                {p.reabiertoEn && <small className="as-nota">Reabierto el {fechaHora(p.reabiertoEn)}: {p.reabiertoMotivo}</small>}
                {p.desde !== d.periodo.desde && <div><Boton type="button" variante="texto" tamano="pequeno" aria-label={`Abrir el período del ${p.desde} al ${p.hasta}`} onClick={() => abrirPeriodo(p.desde)}>Abrir ese período</Boton></div>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Cambios de sueldo" className="pp-bloque">
        <h3 className="as-sub">Cambios de sueldo</h3>
        {errorSueldo ? (
          <div role="alert" className="as-aviso as-aviso--error">No pudimos cargar el historial de sueldo. <Boton type="button" variante="secundario" tamano="pequeno" onClick={cargarSueldos}>Reintentar</Boton></div>
        ) : !sueldos ? <Cargando mensaje="Cargando sueldos" /> : sueldos.length === 0 ? <p className="as-ayuda">Sin cambios registrados.</p> : (
          <ul className="pl-filas">
            {sueldos.map((s, i) => (
              <li key={`${s.vigenteDesde}-${i}`} className="pl-fila">
                <span>Vigente desde {s.vigenteDesde ?? 'siempre'} · {s.modalidad === 'SEMANAL' ? 'semanal' : 'mensual'}</span>
                <span className="as-num">{soles(s.modalidad === 'SEMANAL' ? s.semanal : s.mensual)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Correcciones y aprobaciones" className="pp-bloque">
        <h3 className="as-sub">Correcciones y aprobaciones de este período</h3>
        {anulados.length === 0 && extras.length === 0 ? <p className="as-ayuda">No hay ajustes anulados ni horas extra aprobadas en este período.</p> : (
          <ul className="pl-filas">
            {extras.map((x) => <li key={`x${x.jornada}`} className="pl-fila"><span>Horas extra del {x.jornada} aprobadas el {fechaHora(x.extraAprobadaEn!)}</span></li>)}
            {anulados.map((a) => <li key={`a${a.id}`} className="pl-fila"><span>{a.tipo === 'ADELANTO' ? 'Adelanto' : a.tipo === 'BONO' ? 'Bono' : `Descuento · ${ETIQUETA_CATEGORIA[a.categoria ?? 'OTRO'] ?? 'Otro'}`} de {soles(a.monto)} ({a.fecha}) anulado: {a.anuladoMotivo}</span></li>)}
          </ul>
        )}
        <small className="as-nota">Las correcciones de marcas (cambio de hora, marca agregada) se ven día por día en la pestaña Asistencia, «Ver detalle».</small>
      </section>
    </div>
  );
}

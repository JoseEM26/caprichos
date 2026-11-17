import { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Insignia } from '../../comun/Insignia';
import { jornadaActual } from './jornada';
import { Plegable } from './Plegable';
import { PrestamosPersona, ServiciosExtraPersona } from './PrestamosPersona';
import { CATEGORIAS_DESCUENTO, DetallePlanilla, ETIQUETA_CATEGORIA, ETIQUETA_PERIODICIDAD, TipoSeleccion, anularAjuste, claveSeleccion, crearAjuste, soles } from './planillaApi';
import { resumenCalculo, textoFuera } from './planillaExplicacion';
import type { CtlPlanilla } from './PlanillaPersonaTipos';

type Tipo = 'ADELANTO' | 'DESCUENTO' | 'BONO';

/**
 * Pestaña «Descuentos y créditos». Arriba lo que se descuenta este período (cada check se guarda al instante);
 * abajo, los formularios para registrar algo nuevo, plegados y cerrados por defecto.
 */
export function PestanaDescuentos({ c }: { c: CtlPlanilla }) {
  const { d, pagado, ocupado } = c;
  const [aj, setAj] = useState({ tipo: 'DESCUENTO' as 'ADELANTO' | 'DESCUENTO' | 'BONO', categoria: 'OTRO', fecha: jornadaActual(), monto: '', motivo: '' });
  const [anulando, setAnulando] = useState<{ id: number; motivo: string } | null>(null);
  const res = resumenCalculo(d);
  const adelantos = d.ajustes.filter((a) => a.tipo === 'ADELANTO');
  const descuentos = d.ajustes.filter((a) => a.tipo !== 'ADELANTO');
  const cuotas = d.cuotas ?? [];
  const recurrentes = d.recurrentes ?? [];
  const fuera = d.recurrentesFueraDePeriodo ?? [];
  const enCurso = (tipo: TipoSeleccion, id: string) => c.guardando === claveSeleccion(tipo, id);
  const marcar = (tipo: TipoSeleccion, id: string, activo: boolean) => void c.seleccionar(tipo, id, activo);

  const formAjuste = (tipos: Tipo[]) => !pagado && (
    <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'grid', gap: 10 }}>
      <legend className="as-ayuda">{tipos[0] === 'ADELANTO' ? 'Nuevo adelanto' : 'Nuevo descuento (producto dañado, merma o responsabilidad) o bono'}</legend>
      <div className="as-form">
        {tipos.length > 1 && (
          <label className="as-campo">Tipo
            <select value={aj.tipo} onChange={(e) => setAj({ ...aj, tipo: e.target.value as 'DESCUENTO' | 'BONO' })}>
              <option value="DESCUENTO">Descuento</option>
              <option value="BONO">Bono (adicional)</option>
            </select>
          </label>
        )}
        {tipos.length > 1 && aj.tipo === 'DESCUENTO' && (
          <label className="as-campo">Etiqueta
            <select value={aj.categoria} onChange={(e) => setAj({ ...aj, categoria: e.target.value })}>
              {CATEGORIAS_DESCUENTO.filter((x) => x !== 'CONSUMO').map((x) => <option key={x} value={x}>{ETIQUETA_CATEGORIA[x]}</option>)}
            </select>
          </label>
        )}
        <label className="as-campo">Fecha <input type="date" value={aj.fecha} min={d.periodo.desde} max={d.periodo.hasta} onChange={(e) => setAj({ ...aj, fecha: e.target.value })} /></label>
        <label className="as-campo">Monto (S/) <input type="number" min="0.01" step="0.01" inputMode="decimal" value={aj.monto} onChange={(e) => setAj({ ...aj, monto: e.target.value })} /></label>
      </div>
      <label className="as-campo">{tipos[0] === 'ADELANTO' || aj.tipo === 'BONO' ? 'Nota' : 'Motivo'}
        <textarea style={{ minHeight: 56 }} placeholder="Mínimo 3 caracteres" value={aj.motivo} onChange={(e) => setAj({ ...aj, motivo: e.target.value })} />
      </label>
      <div className="as-acciones">
        <Boton
          type="button"
          disabled={ocupado || !(Number(aj.monto) > 0) || aj.motivo.trim().length < 3 || !aj.fecha}
          onClick={() => {
            const tipo = tipos.length === 1 ? tipos[0] : aj.tipo;
            void c.ejecutar(async () => { await crearAjuste(tipo, { partyId: d.partyId, fecha: aj.fecha, monto: Number(aj.monto), motivo: aj.motivo.trim(), ...(tipo === 'DESCUENTO' ? { categoria: aj.categoria } : {}) }); setAj({ ...aj, monto: '', motivo: '' }); }, tipo === 'ADELANTO' ? 'Adelanto registrado.' : tipo === 'BONO' ? 'Bono registrado.' : 'Descuento registrado.');
          }}
        >
          Registrar {tipos[0] === 'ADELANTO' ? 'adelanto' : aj.tipo === 'BONO' ? 'bono' : 'descuento'}
        </Boton>
      </div>
    </fieldset>
  );

  const listaAjustes = (lista: DetallePlanilla['ajustes'], vacio: string) => lista.length === 0 ? <small className="as-nota">{vacio}</small> : (
    <ul className="pl-filas">
      {lista.map((a) => (
        <li key={a.id} className="pl-fila" style={{ display: 'grid', justifyItems: 'stretch', opacity: a.anulado ? 0.6 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span><Insignia variante={a.tipo === 'ADELANTO' ? 'neutro' : a.tipo === 'BONO' ? 'exito' : 'aviso'}>{a.tipo === 'ADELANTO' ? 'Adelanto' : a.tipo === 'BONO' ? 'Bono' : `Descuento · ${ETIQUETA_CATEGORIA[a.categoria ?? 'OTRO'] ?? 'Otro'}`}</Insignia> {a.fecha}</span>
            <strong style={{ textDecoration: a.anulado ? 'line-through' : 'none' }}>{soles(a.monto)}</strong>
          </div>
          <div>{a.motivo}</div>
          {a.anulado && <small className="as-nota">Anulado: {a.anuladoMotivo}</small>}
          {!a.anulado && !pagado && (
            anulando?.id === a.id ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <label className="as-campo">Motivo de la anulación
                  <input value={anulando.motivo} onChange={(e) => setAnulando({ id: a.id, motivo: e.target.value })} />
                </label>
                <div className="as-acciones">
                  <Boton type="button" variante="secundario" tamano="pequeno" onClick={() => setAnulando(null)}>Cancelar</Boton>
                  <Boton type="button" variante="peligro" tamano="pequeno" disabled={ocupado || anulando.motivo.trim().length < 3} onClick={() => void c.ejecutar(async () => { await anularAjuste(a.id, anulando.motivo.trim()); setAnulando(null); }, 'Ajuste anulado.')}>Anular</Boton>
                </div>
              </div>
            ) : <div><Boton type="button" variante="texto" tamano="pequeno" onClick={() => setAnulando({ id: a.id, motivo: '' })}>Anular</Boton></div>
          )}
        </li>
      ))}
    </ul>
  );

  const filaConsumo = (x: DetallePlanilla['consumos'][number]) => {
    const tipo: TipoSeleccion = x.anterior ? 'CONSUMO_ANTERIOR_INCLUIDO' : 'CONSUMO_EXCLUIDO';
    return (
      <label key={x.id} className="pp-consumo">
        <input type="checkbox" checked={x.cobrar} disabled={pagado || ocupado || enCurso(tipo, x.id)} aria-label={`Cobrar en este pago el consumo ${x.pedido}`}
          onChange={(e) => marcar(tipo, x.id, x.anterior ? e.target.checked : !e.target.checked)} />
        <span style={{ flex: 1, minWidth: 0 }}>
          {x.pedido} · {x.fecha}
          {x.productos && x.productos.length > 0 && <small className="as-nota" style={{ display: 'block' }}>{x.productos.join(', ')}</small>}
        </span>
        <strong>{soles(x.monto)}</strong>
      </label>
    );
  };
  const delPeriodo = d.consumos.filter((x) => !x.anterior);
  const anteriores = d.consumos.filter((x) => x.anterior);

  return (
    <div className="pp-seccion">
      {c.antSinCobrar.length > 0 && (
        <div role="alert" className="as-aviso as-aviso--alerta" data-testid="aviso-creditos-anteriores">
          <strong>Tiene {c.antSinCobrar.length} {c.antSinCobrar.length === 1 ? 'crédito sin cerrar' : 'créditos sin cerrar'} de días anteriores por {soles(c.antTotal)}.</strong>
          {' '}No entran solos en «Consumos cobrados» de esta planilla: marca abajo los que quieres descontar en este pago o confirma pagar sin descontarlos.
          <ul style={{ margin: '4px 0', paddingLeft: 18 }}>{c.antSinCobrar.map((x) => <li key={x.id}>{x.fecha} · {x.pedido} · {soles(x.monto)}</li>)}</ul>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }}>
            <input type="checkbox" checked={c.sinDescontarAnt} onChange={(e) => c.setSinDescontarAnt(e.target.checked)} aria-label="Confirmo pagar sin descontar los créditos anteriores" />
            Confirmo pagar sin descontar estos créditos (siguen pendientes en Créditos).
          </label>
        </div>
      )}

      <section aria-label="Lo que se descuenta este período" className="pp-bloque" data-testid="lo-que-se-descuenta">
        <strong data-testid="total-descontar">Total a descontar este período: {soles(res.totalRestas)}</strong>
        <small className="as-nota">Incluye tardanza, consumos, adelantos, préstamos y descuentos personalizados. Cada check se guarda al instante y se aplica al cálculo y al pago.</small>

        <h4 className="as-sub">Consumos del personal</h4>
        {d.consumos.length > 0 ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <p className="as-ayuda">Mismos consumos que Admin › Créditos. Los del período vienen marcados; los que dejes sin marcar pasan al siguiente. Al marcar pagado quedan como «Cobrado» en Créditos.</p>
            {delPeriodo.map(filaConsumo)}
            {anteriores.length > 0 && (
              <>
                <strong style={{ fontSize: 13 }}>Consumos de períodos anteriores sin cobrar · {soles(anteriores.reduce((a, x) => a + x.monto, 0))}</strong>
                <small className="as-nota">Marca los que también quieres descontar en este pago.</small>
                {anteriores.map(filaConsumo)}
              </>
            )}
          </div>
        ) : <small className="as-nota">No tiene consumos del personal por cobrar.</small>}

        <h4 className="as-sub">Préstamos</h4>
        {cuotas.length > 0 ? (
          <div style={{ display: 'grid', gap: 4 }}>
            <small className="as-nota">Cuotas de este pago. Desmarca una para saltarla: pasa al final del plan.</small>
            {cuotas.map((x) => (
              <label key={`c${x.id}`} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}>
                <input type="checkbox" checked={x.cobrar} disabled={pagado || ocupado || enCurso('CUOTA_OMITIDA', x.id)} aria-label={`Cobrar la cuota ${x.numero} del préstamo`} onChange={(e) => marcar('CUOTA_OMITIDA', x.id, !e.target.checked)} />
                <span style={{ flex: 1 }}>Cuota {x.numero} de {x.numCuotas}{(x.interesCuota ?? x.interes) ? <small className="as-nota">capital {soles(x.capitalCuota ?? x.capital)} + interés {soles(x.interesCuota ?? x.interes)}</small> : null}</span>
                <strong>{soles(x.monto)}</strong>
              </label>
            ))}
          </div>
        ) : <small className="as-nota">Sin cuota de préstamo este pago.</small>}

        <h4 className="as-sub">Descuentos y bonos personalizados</h4>
        {recurrentes.length > 0 && (
          <div style={{ display: 'grid', gap: 4 }}>
            <small className="as-nota">Desmarca para no cobrarlo solo esta vez.</small>
            {recurrentes.map((x) => (
              <label key={`r${x.id}`} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}>
                <input type="checkbox" checked={x.cobrar} disabled={pagado || ocupado || enCurso('RECURRENTE_OMITIDO', x.id)} aria-label={`Cobrar ${x.nombre} en este pago`} onChange={(e) => marcar('RECURRENTE_OMITIDO', x.id, !e.target.checked)} />
                <span style={{ flex: 1 }}>{x.nombre}{x.signo === 'BONO' ? ' (bono)' : ''}<small className="as-nota" style={{ display: 'block' }}>{x.valorTipo === 'PORCENTAJE' ? `${x.valor} % del sueldo · ` : ''}{x.periodicidad ? ETIQUETA_PERIODICIDAD[x.periodicidad] : ''}</small></span>
                <strong>{x.signo === 'BONO' ? '+ ' : '− '}{soles(x.monto)}</strong>
              </label>
            ))}
          </div>
        )}
        {fuera.length > 0 && (
          <ul className="pl-filas" data-testid="personalizados-fuera">
            {fuera.map((x) => <li key={`f${x.id}`} className="as-nota">{textoFuera(x)}</li>)}
          </ul>
        )}
        {recurrentes.length === 0 && fuera.length === 0 && <small className="as-nota">No hay descuentos ni bonos personalizados para esta persona.</small>}

        <h4 className="as-sub">Adelantos de este período</h4>
        {listaAjustes(adelantos, 'En este período no hay adelantos.')}
        <h4 className="as-sub">Descuentos y bonos registrados</h4>
        {listaAjustes(descuentos, 'En este período no hay descuentos ni bonos.')}
      </section>

      <section aria-label="Registrar algo nuevo" className="pp-bloque" style={{ display: 'grid', gap: 8 }}>
        <h4 className="as-sub">Registrar</h4>
        {!pagado && (
          <Plegable titulo="＋ Registrar adelanto" resumen={res.totalAdelantos > 0 ? `${soles(res.totalAdelantos)} este período` : undefined}>
            {formAjuste(['ADELANTO'])}
          </Plegable>
        )}
        {!pagado && (
          <Plegable titulo="＋ Registrar descuento o bono" resumen="Merma, daño, responsabilidad o bono">
            {formAjuste(['DESCUENTO', 'BONO'])}
          </Plegable>
        )}
        <Plegable titulo="＋ Registrar préstamo" resumen="Plan de cuotas">
          {(vista) => vista && <PrestamosPersona partyId={d.partyId} alCambiar={() => void c.cargar()} />}
        </Plegable>
        <Plegable titulo="＋ Agregar descuento o bono personalizado" resumen="Netflix u otro, por semana, mes o una vez">
          {(vista) => vista && <ServiciosExtraPersona partyId={d.partyId} alCambiar={() => void c.cargar()} />}
        </Plegable>
      </section>
    </div>
  );
}

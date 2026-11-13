import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import './cuadre-caja.css';
import {
  DENOMINACIONES_LISTA,
  type AjusteMedio,
  type ClaveDigital,
  type DevolucionTurno,
  type MedioAjustable,
  type MontosEsperados,
  type RepartidorPorLiquidar,
} from './cierreApi';
import { ListaCorrecciones } from './CorreccionesMedios';
import {
  MEDIOS_DIGITALES_CUADRE,
  difFila,
  difTotal,
  estadoDif,
  guardarBorrador,
  borrarBorrador,
  borradorVacio,
  hayDiferencias,
  leerBorrador,
  leyendaDifTotal,
  limpiarMontoTexto,
  parseMonto,
  redondear,
  soles,
  solesConSigno,
  sumaDenominaciones,
  textoDif,
  type BorradorCuadre,
  type EstadoDif,
  type FilaCuadre,
  type ModoEfectivo,
} from './cuadre.util';

export interface CierrePayload {
  conteo?: Record<string, number>;
  efectivoTotal?: number;
  medios: Partial<Record<ClaveDigital, number>>;
  nota?: string;
  /** Solo el administrador: justifica cerrar con pedidos entregados sin cobrar */
  motivoEntregadosSinCobrar?: string;
  /** Solo el administrador: justifica cerrar con pedidos sin terminar */
  motivoPedidosSinTerminar?: string;
}

export interface CuadreCajaProps {
  esperado: MontosEsperados;
  /** Fecha de la caja (AAAA-MM-DD) y si es de un día anterior */
  fecha: string;
  diaAnterior?: boolean;
  cajero: string;
  pendientesCount: number;
  /** Motivo con el que el administrador justifica los entregados sin cobrar: deja cerrar con ellos */
  motivoSinCobro?: string;
  /** Panel de pedidos sin cobrar (se abre en la misma pantalla con «resolver») */
  pendientesPanel?: ReactNode;
  /** Pedidos ni entregados ni anulados (pagados o no): impiden cerrar; el ADMIN los justifica con un motivo */
  sinTerminarCount?: number;
  motivoSinTerminar?: string;
  sinTerminarPanel?: ReactNode;
  /** «Antes de cerrar, revisa esto» (ayuda sin montos de diferencia) */
  guiaPanel?: ReactNode;
  repartidores: RepartidorPorLiquidar[];
  onRecibirRepartidor: (r: RepartidorPorLiquidar) => void;
  ajustesMedio?: AjusteMedio[];
  /** Devoluciones del día (informativo: ya están descontadas del esperado) */
  devoluciones?: DevolucionTurno[];
  onCorregir?: (medio: MedioAjustable, clave: ClaveDigital) => void;
  cerrando?: boolean;
  error?: string;
  /** Devuelve true si la caja quedó cerrada */
  onCerrar: (p: CierrePayload) => Promise<boolean>;
  onVolver: () => void;
}

const ICONO: Record<EstadoDif, string> = { cuadra: '✓', sobra: '▲', falta: '▼' };

/** Semáforo con texto, ícono y color (nunca solo color). */
function Semaforo({ valor, vacio }: { valor: number | null; vacio?: string }) {
  if (valor === null) return <span className="cc-sem cc-sem-vacio">{vacio ?? 'Sin ingresar'}</span>;
  const e = estadoDif(valor);
  return (
    <span className={`cc-sem cc-sem-${e}`} data-estado={e}>
      <span aria-hidden="true">{ICONO[e]}</span> {textoDif(valor)}
    </span>
  );
}

const fechaLarga = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

export function CuadreCaja({
  esperado,
  fecha,
  diaAnterior = false,
  cajero,
  pendientesCount,
  motivoSinCobro,
  pendientesPanel,
  sinTerminarCount = 0,
  motivoSinTerminar,
  sinTerminarPanel,
  guiaPanel,
  repartidores,
  onRecibirRepartidor,
  ajustesMedio = [],
  devoluciones = [],
  onCorregir,
  cerrando = false,
  error = '',
  onCerrar,
  onVolver,
}: CuadreCajaProps) {
  const cajaId = esperado.cajaId;
  const [borrador, setBorrador] = useState<BorradorCuadre>(() => leerBorrador(cajaId));
  const [verPendientes, setVerPendientes] = useState(false);
  const [lineaAbierta, setLineaAbierta] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const refNo = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    guardarBorrador(cajaId, borrador);
  }, [cajaId, borrador]);

  useEffect(() => {
    if (confirmando) refNo.current?.focus();
  }, [confirmando]);

  const cambiar = (parche: Partial<BorradorCuadre>) => setBorrador((b) => ({ ...b, ...parche }));

  // ---------- Lo que deberia haber ----------
  const d = esperado.desglose;
  const apertura = d.apertura ?? esperado.apertura;
  const cobrosEfectivo = d.cobrosEfectivo ?? redondear(d.ventasEfectivo + (d.propinas?.efectivo ?? 0));
  const deRepartidores = d.liquidadoRepartidores ?? 0;
  const deberia = esperado.efectivoEsperado;
  const movVigentes = (esperado.movimientos ?? []).filter((m) => !m.anulado_en);
  const cobrosConEfectivo = (esperado.cobrados ?? []).filter((c) => c.medios.includes('EFECTIVO'));

  // ---------- Lo contado ----------
  const sumaDenom = useMemo(() => sumaDenominaciones(borrador.cantidades), [borrador.cantidades]);
  const efectivoTocado =
    borrador.modo === 'total'
      ? parseMonto(borrador.totalDirecto) !== null
      : Object.values(borrador.cantidades).some((v) => v !== '');
  const efectivoContado = borrador.modo === 'total' ? (parseMonto(borrador.totalDirecto) ?? 0) : sumaDenom;

  const filas: FilaCuadre[] = [
    { clave: 'efectivo', etiqueta: 'Efectivo', sistema: deberia, visto: efectivoTocado ? efectivoContado : null },
    ...MEDIOS_DIGITALES_CUADRE.map((m) => ({
      clave: m.clave,
      etiqueta: m.etiqueta,
      sistema: esperado.medios[m.clave],
      visto: parseMonto(borrador.vistos[m.clave]),
    })),
  ];
  const difEfectivo = difFila(filas[0]);
  const total = difTotal(filas);
  const conDiferencias = hayDiferencias(filas);
  const estadoTotal = estadoDif(total);

  const pendientesRepartidor = repartidores.filter((r) => r.pendiente > 0);
  const sinTerminarBloquea = sinTerminarCount > 0 && !motivoSinTerminar;
  const bloqueado = (pendientesCount > 0 && !motivoSinCobro) || sinTerminarBloquea || pendientesRepartidor.length > 0;

  // ---------- Acciones del conteo ----------
  const fijarCantidad = (clave: string, valor: string) =>
    cambiar({ cantidades: { ...borrador.cantidades, [clave]: valor.replace(/\D/g, '').slice(0, 5) } });
  const sumarCantidad = (clave: string, delta: number) => {
    const actual = parseInt(borrador.cantidades[clave] || '0', 10) || 0;
    fijarCantidad(clave, String(Math.max(0, actual + delta)));
  };
  const cambiarModo = (modo: ModoEfectivo) => {
    if (modo === borrador.modo) return;
    // Al pasar a «total directo» se arranca con lo ya contado por billetes, para que ambos modos sean coherentes
    if (modo === 'total' && borrador.totalDirecto === '' && sumaDenom > 0) {
      cambiar({ modo, totalDirecto: String(sumaDenom) });
    } else cambiar({ modo });
  };
  const limpiar = () => {
    cambiar({ cantidades: borradorVacio().cantidades, totalDirecto: '' });
  };
  const siguienteCampo = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const campos = Array.from(document.querySelectorAll<HTMLInputElement>('[data-cc-campo]'));
    const i = campos.indexOf(e.currentTarget);
    campos[i + 1]?.focus();
  };

  // ---------- Cerrar ----------
  const armarPayload = (): CierrePayload => {
    const medios: Partial<Record<ClaveDigital, number>> = {};
    for (const m of MEDIOS_DIGITALES_CUADRE) {
      const v = parseMonto(borrador.vistos[m.clave]);
      if (v !== null) medios[m.clave] = v;
    }
    const base: CierrePayload = { medios, nota: borrador.nota.trim() || undefined };
    if (motivoSinCobro && pendientesCount > 0) base.motivoEntregadosSinCobrar = motivoSinCobro;
    if (motivoSinTerminar && sinTerminarCount > 0) base.motivoPedidosSinTerminar = motivoSinTerminar;
    if (borrador.modo === 'total') {
      if (efectivoTocado) base.efectivoTotal = efectivoContado;
    } else {
      const conteo: Record<string, number> = {};
      for (const [k, v] of Object.entries(borrador.cantidades)) {
        const n = parseInt(v || '0', 10);
        if (n > 0) conteo[k] = n;
      }
      base.conteo = conteo;
    }
    return base;
  };

  const confirmarCierre = async () => {
    if (cerrando) return;
    const ok = await onCerrar(armarPayload());
    if (ok) {
      borrarBorrador(cajaId);
      setConfirmando(false);
    }
  };

  const etiquetaBoton = bloqueado
    ? 'Resuelve los pendientes para cerrar'
    : !conDiferencias && efectivoTocado
      ? 'Cerrar caja'
      : !efectivoTocado
        ? `Cerrar caja sin contar el efectivo (falta ${soles(deberia)})`
        : estadoTotal === 'cuadra'
          ? 'Cerrar caja con diferencias que se compensan'
          : `Cerrar caja con diferencia de ${solesConSigno(total)}`;
  const claseBoton = bloqueado ? 'cc-bloq' : !conDiferencias && efectivoTocado ? 'cc-ok' : 'cc-dif';

  return (
    <div className="cc" data-testid="cuadre-caja">
      <header className="cc-enc">
        <div>
          <h2 className="cc-h">Cuadre de caja</h2>
          <div className="cc-sub">
            Caja del {fechaLarga(fecha)}
            {diaAnterior ? ' (día anterior sin cerrar)' : ''} · apertura {soles(apertura)} · {cajero}
          </div>
        </div>
        <button type="button" className="cc-btn cc-sec" onClick={onVolver}>
          Volver
        </button>
      </header>

      {guiaPanel}

      {/* Estado de la caja y pendientes (lo único que de verdad bloquea el cierre) */}
      <section className="cc-card" aria-label="Estado de la caja" data-testid="cc-estado">
        {bloqueado ? (
          <div className="cc-aviso cc-aviso-bloq" role="status">
            {pendientesCount > 0 && (
              <div className="cc-fila-aviso">
                <span>
                  <b>
                    {pendientesCount} {pendientesCount === 1 ? 'pedido sin cobrar' : 'pedidos sin cobrar'}
                  </b>{' '}
                  · hay que cobrarlos o anularlos para cerrar
                </span>
                <button type="button" className="cc-btn cc-sec" aria-expanded={verPendientes} onClick={() => setVerPendientes((v) => !v)}>
                  {verPendientes ? 'Ocultar' : 'Resolver'}
                </button>
              </div>
            )}
            {sinTerminarCount > 0 && (
              <div className="cc-fila-aviso">
                <span>
                  <b>
                    {sinTerminarCount} {sinTerminarCount === 1 ? 'pedido sin terminar' : 'pedidos sin terminar'}
                  </b>{' '}
                  · hay que entregarlos o anularlos para cerrar
                </span>
              </div>
            )}
            {pendientesRepartidor.map((r) => (
              <div key={r.repartidorPartyId} className="cc-fila-aviso">
                <span>
                  <b>{r.nombre}</b> debe entregar {soles(r.pendiente)} en efectivo · liquidación pendiente
                </span>
                <button type="button" className="cc-btn cc-sec" onClick={() => onRecibirRepartidor(r)}>
                  Recibir el efectivo
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="cc-aviso cc-aviso-ok" role="status">
            <span aria-hidden="true">✓</span>{' '}
            {motivoSinCobro && pendientesCount > 0
              ? 'Cierre con pedidos entregados sin cobrar justificados por el administrador.'
              : 'Sin pendientes: no hay pedidos sin cobrar ni repartidores por liquidar.'}
          </div>
        )}
        {sinTerminarCount > 0 && <div className="cc-pendientes">{sinTerminarPanel}</div>}
        {verPendientes && pendientesCount > 0 && <div className="cc-pendientes">{pendientesPanel}</div>}
        {devoluciones.length > 0 && (
          <p className="cc-peq" data-testid="cc-devoluciones">
            {devoluciones.length} {devoluciones.length === 1 ? 'devolución' : 'devoluciones'} del día ({devoluciones.map((x) => `${x.pedidoCodigo} ${soles(x.montoDevuelto)} ${x.medio}`).join(', ')}): ya están descontadas del esperado.
          </p>
        )}
        <p className="cc-nota-ciega">El conteo a ciegas ya no se usa: ves lo que debería haber mientras cuentas.</p>
      </section>

      {/* 1. RESUMEN: deberia / contado / diferencia */}
      <section className="cc-resumen" aria-label="Resumen del efectivo">
        <div className="cc-card cc-num" data-testid="cc-deberia">
          <div className="cc-etq">Efectivo que debería haber</div>
          <div className="cc-grande">{soles(deberia)}</div>
          <ul className="cc-desglose" aria-label="De dónde sale">
            <LineaDesglose id="apertura" signo="" texto="Apertura de caja" monto={apertura} abierta={lineaAbierta} alternar={setLineaAbierta}>
              Dinero con el que se abrió la caja.
            </LineaDesglose>
            <LineaDesglose id="cobros" signo="+" texto="Cobros en efectivo" monto={cobrosEfectivo} abierta={lineaAbierta} alternar={setLineaAbierta}>
              {(d.vueltos ?? 0) > 0 && <p className="cc-peq">Ya descontados los vueltos entregados ({soles(d.vueltos ?? 0)}).</p>}
              {(d.propinas?.efectivo ?? 0) > 0 && <p className="cc-peq">Incluye {soles(d.propinas?.efectivo ?? 0)} de propinas en efectivo.</p>}
              {cobrosConEfectivo.length === 0 ? (
                <p className="cc-peq">Todavía no hay cobros en efectivo.</p>
              ) : (
                <ul className="cc-detalle">
                  {cobrosConEfectivo.map((c) => (
                    <li key={c.pedidoId}>
                      <span>{c.codigo}{c.cliente ? ` · ${c.cliente}` : ''}{c.medios.length > 1 ? ' (pago mixto)' : ''}</span>
                      <b>{soles(c.total)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </LineaDesglose>
            {deRepartidores > 0 && (
              <LineaDesglose id="repartidores" signo="+" texto="Efectivo recibido de repartidores" monto={deRepartidores} abierta={lineaAbierta} alternar={setLineaAbierta}>
                Lo cobrado en la puerta del cliente y ya entregado a la caja.
              </LineaDesglose>
            )}
            <LineaDesglose id="ingresos" signo="+" texto="Ingresos extra" monto={d.ingresos} abierta={lineaAbierta} alternar={setLineaAbierta}>
              <ListaMovimientos movs={movVigentes.filter((m) => m.tipo === 'INGRESO')} vacio="No hay ingresos extra." />
            </LineaDesglose>
            <LineaDesglose id="egresos" signo="−" texto="Egresos y gastos" monto={d.egresos} abierta={lineaAbierta} alternar={setLineaAbierta}>
              <ListaMovimientos movs={movVigentes.filter((m) => m.tipo === 'EGRESO')} vacio="No hay egresos." />
            </LineaDesglose>
          </ul>
          <div className="cc-total-fila">
            <span>= Total que debería haber</span>
            <b>{soles(deberia)}</b>
          </div>
        </div>

        <div className="cc-card cc-num" data-testid="cc-contado">
          <div className="cc-etq">Efectivo contado</div>
          <div className="cc-grande">{efectivoTocado ? soles(efectivoContado) : '—'}</div>
          <div className="cc-peq">{efectivoTocado ? 'Lo que has ingresado, en vivo.' : 'Cuenta abajo los billetes y monedas.'}</div>
        </div>

        <div className={`cc-card cc-num cc-dif-${difEfectivo === null ? 'vacio' : estadoDif(difEfectivo)}`} data-testid="cc-diferencia" aria-live="polite">
          <div className="cc-etq">Diferencia del efectivo</div>
          <div className="cc-grande">
            <Semaforo valor={difEfectivo} vacio="Cuenta el efectivo" />
          </div>
          <div className="cc-peq">Contado − lo que debería haber.</div>
        </div>
      </section>

      {/* Diferencia total del día */}
      <section className={`cc-card cc-total cc-dif-${filas.every((f) => f.visto === null) ? 'vacio' : estadoTotal}`} data-testid="cc-total-dia" aria-live="polite">
        <div className="cc-etq">Diferencia total del día (efectivo + Yape + Plin + Transferencia + Tarjeta)</div>
        <div className="cc-grande">
          {filas.every((f) => f.visto === null) ? '—' : <Semaforo valor={total} />}
        </div>
        <div className="cc-peq">
          {filas.every((f) => f.visto === null)
            ? 'Ingresa lo que contaste para ver la diferencia.'
            : `${leyendaDifTotal(total)}${conDiferencias && estadoTotal === 'cuadra' ? ' (hay diferencias que se compensan entre medios)' : ''}.`}
        </div>
        <ul className="cc-progreso" aria-label="Avance del conteo" data-testid="cc-progreso">
          {filas.map((f) => (
            <li key={f.clave} className={f.visto === null ? 'cc-pend' : 'cc-hecho'}>
              {f.etiqueta.replace(' / POS', '')} {f.visto === null ? '·' : '✓'}
            </li>
          ))}
        </ul>
      </section>

      {/* 2. CONTEO DE EFECTIVO */}
      <section className="cc-card" aria-label="Conteo de efectivo">
        <div className="cc-fila-enc">
          <h3 className="cc-h3">Conteo de efectivo</h3>
          <div className="cc-modos" role="group" aria-label="Cómo ingresar el efectivo">
            <button type="button" className={`cc-modo${borrador.modo === 'denominaciones' ? ' cc-act' : ''}`} aria-pressed={borrador.modo === 'denominaciones'} onClick={() => cambiarModo('denominaciones')}>
              Por billetes y monedas
            </button>
            <button type="button" className={`cc-modo${borrador.modo === 'total' ? ' cc-act' : ''}`} aria-pressed={borrador.modo === 'total'} onClick={() => cambiarModo('total')}>
              Ingresar total directo
            </button>
          </div>
        </div>

        {borrador.modo === 'total' ? (
          <div className="cc-total-directo">
            <label htmlFor="cc-total-directo" className="cc-lbl">
              Total de efectivo contado (S/)
            </label>
            <input
              id="cc-total-directo"
              data-cc-campo
              className="cc-input cc-input-grande"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={borrador.totalDirecto}
              onChange={(e) => cambiar({ totalDirecto: limpiarMontoTexto(e.target.value) })}
            />
            {sumaDenom > 0 && <p className="cc-peq">Por billetes y monedas llevabas {soles(sumaDenom)}.</p>}
          </div>
        ) : (
          <div className="cc-denoms">
            {DENOMINACIONES_LISTA.map((den) => {
              const cant = parseInt(borrador.cantidades[den.clave] || '0', 10) || 0;
              const nombre = `${den.tipo === 'billete' ? 'billetes' : 'monedas'} de S/ ${den.valor >= 1 ? den.valor.toFixed(den.tipo === 'moneda' ? 2 : 0) : den.valor.toFixed(2)}`;
              return (
                <div key={den.clave} className="cc-den" data-testid={`den-${den.clave}`}>
                  <div className="cc-den-nom">
                    {den.tipo === 'billete' ? 'Billete' : 'Moneda'} {den.etiqueta}
                  </div>
                  <div className="cc-stepper">
                    <button type="button" className="cc-mas" aria-label={`Quitar uno de ${nombre}`} onClick={() => sumarCantidad(den.clave, -1)} disabled={cant <= 0}>
                      −
                    </button>
                    <input
                      data-cc-campo
                      className="cc-input cc-cant"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      placeholder="0"
                      aria-label={`Cantidad de ${nombre}`}
                      value={borrador.cantidades[den.clave] ?? ''}
                      onChange={(e) => fijarCantidad(den.clave, e.target.value)}
                      onKeyDown={siguienteCampo}
                    />
                    <button type="button" className="cc-mas" aria-label={`Agregar uno de ${nombre}`} onClick={() => sumarCantidad(den.clave, 1)}>
                      +
                    </button>
                  </div>
                  <div className="cc-sub-den" data-testid={`sub-${den.clave}`}>
                    {soles(cant * den.valor)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="cc-conteo-pie">
          <div className="cc-total-vivo" data-testid="total-efectivo-vivo" aria-live="polite">
            Total contado: <b>{soles(efectivoContado)}</b>
          </div>
          <button type="button" className="cc-btn cc-sec" onClick={limpiar}>
            Limpiar
          </button>
        </div>
      </section>

      {/* 3. MEDIOS DIGITALES */}
      <section className="cc-card" aria-label="Medios digitales">
        <h3 className="cc-h3">Medios digitales</h3>
        <p className="cc-peq">Escribe lo que ves en tu app o POS. Si lo dejas vacío, ese medio no suma diferencia.</p>
        <div className="cc-digitales">
          {MEDIOS_DIGITALES_CUADRE.map((m) => {
            const sistema = esperado.medios[m.clave];
            const visto = parseMonto(borrador.vistos[m.clave]);
            const dif = visto === null ? null : redondear(visto - sistema);
            return (
              <div key={m.clave} className="cc-dig" data-testid={`digital-${m.clave}`}>
                <div className="cc-dig-nom">{m.etiqueta}</div>
                <div className="cc-dig-sis">
                  Sistema <b>{soles(sistema)}</b>
                </div>
                <label className="cc-lbl" htmlFor={`cc-dig-${m.clave}`}>
                  Lo que veo en mi app/POS
                </label>
                <input
                  id={`cc-dig-${m.clave}`}
                  data-cc-campo
                  className="cc-input"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="Sin ingresar"
                  value={borrador.vistos[m.clave] ?? ''}
                  onChange={(e) => cambiar({ vistos: { ...borrador.vistos, [m.clave]: limpiarMontoTexto(e.target.value) } })}
                  onKeyDown={siguienteCampo}
                />
                <div aria-live="polite" className="cc-dig-dif">
                  <Semaforo valor={dif} />
                </div>
                <div className="cc-dig-acc">
                  <button
                    type="button"
                    className="cc-btn cc-sec"
                    aria-label={`Coincide con el sistema: ${m.etiqueta.replace(" / POS", "")}`}
                    onClick={() => cambiar({ vistos: { ...borrador.vistos, [m.clave]: String(sistema) } })}
                  >
                    Coincide con el sistema
                  </button>
                  {onCorregir && (
                    <button type="button" className="cc-btn cc-enlace" aria-label={`Corregir ${m.etiqueta.replace(" / POS", "")}`} onClick={() => onCorregir(m.medio, m.clave)}>
                      Corregir
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {ajustesMedio.length > 0 && <ListaCorrecciones ajustes={ajustesMedio} />}
      </section>

      {/* 4. Pie fijo: diferencia total + cerrar */}
      <div className="cc-pie" data-testid="cc-pie">
        <div className="cc-pie-dif" aria-live="polite">
          <span className="cc-pie-etq">Diferencia total</span>
          {filas.every((f) => f.visto === null) ? <span className="cc-sem cc-sem-vacio">Sin contar</span> : <Semaforo valor={total} />}
        </div>
        <button
          type="button"
          className={`cc-cerrar ${claseBoton}`}
          disabled={bloqueado || cerrando}
          aria-disabled={bloqueado || cerrando}
          onClick={() => setConfirmando(true)}
        >
          {etiquetaBoton}
        </button>
      </div>

      {/* Confirmación Sí/No: resumen, nota opcional y advertencia */}
      {confirmando && (
        <>
          <div className="cc-fondo" onClick={() => !cerrando && setConfirmando(false)} />
          <div role="dialog" aria-modal="true" aria-labelledby="cc-conf-t" className="cc-modal">
            <h3 id="cc-conf-t" className="cc-h3">
              {conDiferencias || !efectivoTocado ? `¿Cerrar la caja con diferencia de ${solesConSigno(total)}?` : '¿Cerrar la caja cuadrada?'}
            </h3>
            {!efectivoTocado && <p className="cc-peq cc-rust">No contaste el efectivo: se registrará S/ 0.00 contado.</p>}
            <table className="cc-tabla" aria-label="Resumen por medio">
              <thead>
                <tr>
                  <th scope="col">Medio</th>
                  <th scope="col">Sistema</th>
                  <th scope="col">Contado</th>
                  <th scope="col">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const dif = f.clave === 'efectivo' ? redondear((efectivoTocado ? efectivoContado : 0) - f.sistema) : difFila(f);
                  return (
                    <tr key={f.clave}>
                      <th scope="row">{f.etiqueta}</th>
                      <td>{soles(f.sistema)}</td>
                      <td>{f.clave === 'efectivo' ? soles(efectivoTocado ? efectivoContado : 0) : f.visto === null ? 'Sin ingresar' : soles(f.visto)}</td>
                      <td><Semaforo valor={dif} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <label htmlFor="cc-nota" className="cc-lbl">
              Nota: explica la diferencia (recomendado, no es obligatorio)
            </label>
            <textarea
              id="cc-nota"
              className="cc-input cc-textarea"
              rows={3}
              value={borrador.nota}
              onChange={(e) => cambiar({ nota: e.target.value })}
              placeholder="Ej.: faltó el sencillo de un vuelto"
            />
            <p className="cc-advertencia">El cierre queda registrado con esta diferencia y no se puede editar después.</p>
            {error && (
              <div role="alert" className="cc-error">
                {error}
              </div>
            )}
            <div className="cc-modal-acc">
              <button type="button" ref={refNo} className="cc-btn cc-sec" disabled={cerrando} onClick={() => setConfirmando(false)}>
                No, volver
              </button>
              <button type="button" className={`cc-btn ${conDiferencias || !efectivoTocado ? 'cc-dif' : 'cc-ok'}`} disabled={cerrando} onClick={confirmarCierre}>
                {cerrando ? 'Cerrando…' : 'Sí, cerrar caja'}
              </button>
            </div>
          </div>
        </>
      )}
      {!confirmando && error && (
        <div role="alert" className="cc-error cc-error-pie">
          {error}
        </div>
      )}
    </div>
  );
}

function LineaDesglose({
  id,
  signo,
  texto,
  monto,
  abierta,
  alternar,
  children,
}: {
  id: string;
  signo: '' | '+' | '−';
  texto: string;
  monto: number;
  abierta: string | null;
  alternar: (id: string | null) => void;
  children?: ReactNode;
}) {
  const abierto = abierta === id;
  return (
    <li className="cc-linea">
      <button type="button" className="cc-linea-btn" aria-expanded={abierto} onClick={() => alternar(abierto ? null : id)}>
        <span>
          {signo && <span aria-hidden="true">{signo} </span>}
          {texto}
        </span>
        <b>{soles(monto)}</b>
      </button>
      {abierto && <div className="cc-linea-det">{children}</div>}
    </li>
  );
}

function ListaMovimientos({ movs, vacio }: { movs: Array<{ id: string; monto: number; motivo: string }>; vacio: string }) {
  if (movs.length === 0) return <p className="cc-peq">{vacio}</p>;
  return (
    <ul className="cc-detalle">
      {movs.map((m) => (
        <li key={m.id}>
          <span>{m.motivo}</span>
          <b>{soles(m.monto)}</b>
        </li>
      ))}
    </ul>
  );
}

export default CuadreCaja;

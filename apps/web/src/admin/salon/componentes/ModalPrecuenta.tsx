import { useEffect, useState } from 'react';
import '../salon.css';
import '../precuenta.css';
import { Confirmar } from '../../../comun/Confirmar';
import { SubirVoucherMozo } from '../../vouchers/SubirVoucherMozo';
import { vouchersApi } from '../../vouchers/vouchersApi';
import type { PlanPagoItem } from '../../pedidos/planPago';
import {
  MEDIOS_PLAN,
  ajustarPlan,
  aPlan,
  errorPlan,
  medioPrincipalPlan,
  montoDigitalPlan,
  nombreMedio,
  planInicial,
  type FilaPlan,
  type MedioPlan,
} from '../../pedidos/planPago';
import { PlanPagoEditor } from './PlanPagoEditor';

export interface LineaPrecuenta {
  cantidad: number;
  nombre: string;
  detalle: string;
  /** Subtotal de la línea en soles. Si falta, la fila no muestra precio. */
  precio?: number;
}

export interface ModalPrecuentaProps {
  abierto: boolean;
  alCerrar: () => void;
  mesa: string;
  lineas: LineaPrecuenta[];
  total: number;
  subtotal?: number;
  descuento?: number;
  /** Pago dividido ya guardado: se precarga en el editor de Enviar a Caja y se muestra en el desglose. */
  plan?: Array<{ medio: string; monto: number | string }>;
  mozo?: string | null;
  copias?: number;
  alImprimir?: () => Promise<void> | void;
  /** Con pedido, el mozo puede enviar el cobro a Caja (no lo cobra él). */
  pedidoId?: string | number;
  /** Medio con el que se creó el pedido: sin plan guardado, la precuenta arranca con este medio. */
  pagoMetodo?: string | null;
  /** Vouchers ya subidos por medio (mozo, Caja o WhatsApp): no se vuelven a pedir. */
  vouchersPorMedio?: Array<{ medio: string; monto: number; subido: boolean; voucherId?: string | null }>;
  /** Si el mozo aún puede reemplazar un voucher ya subido. */
  puedeCambiarVoucher?: boolean;
}

const DIGITALES = ['YAPE', 'PLIN', 'TRANSFERENCIA'];

/** Filas iniciales: el plan guardado; sin plan, el medio del pedido (si es digital) o efectivo, por el total. */
const filasIniciales = (plan: ModalPrecuentaProps['plan'], total: number, pagoMetodo?: string | null): FilaPlan[] => {
  const guardadas = (plan ?? [])
    .filter((f) => Number(f.monto) > 0 && MEDIOS_PLAN.some((m) => m.id === f.medio))
    .map((f) => ({ medio: f.medio as MedioPlan, monto: Number(f.monto).toFixed(2) }));
  if (guardadas.length > 0) return guardadas;
  const m = String(pagoMetodo ?? '').toUpperCase();
  return planInicial(DIGITALES.includes(m) ? (m as MedioPlan) : 'EFECTIVO', total);
};

const soles = (n: number | string | null | undefined) => `S/ ${Number(n || 0).toFixed(2)}`;

const horaAhora = () =>
  new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });

export function ModalPrecuenta({
  abierto,
  alCerrar,
  mesa,
  lineas,
  total,
  subtotal,
  descuento = 0,
  plan,
  mozo,
  copias = 0,
  alImprimir,
  pedidoId,
  pagoMetodo,
  vouchersPorMedio,
  puedeCambiarVoucher = false,
}: ModalPrecuentaProps) {
  const [confirmarImprimir, setConfirmarImprimir] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [copiasLocales, setCopiasLocales] = useState(copias);

  // Envío del cobro a Caja: el mozo reparte el pago (uno o varios medios) y, si hay parte digital, puede subir el voucher
  const [filas, setFilas] = useState<FilaPlan[]>(() => filasIniciales(plan, total, pagoMetodo));
  const [pagaCon, setPagaCon] = useState<string>('');
  // Una captura por medio digital del plan: si cada una se lee
  const [legibles, setLegibles] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((vouchersPorMedio ?? []).filter((v) => v.subido).map((v) => [v.medio, true])),
  );
  // Vouchers ya subidos: de la prop o, si el llamador no los informa, del historial del pedido
  const [vpm, setVpm] = useState(vouchersPorMedio);
  useEffect(() => {
    if (vouchersPorMedio !== undefined || pedidoId === undefined || !abierto) return;
    let vivo = true;
    Promise.resolve()
      .then(() => vouchersApi.historialPedido(pedidoId))
      .then((r) => {
        const vigentes = (r?.items ?? []).filter((v) => v.estado === 'VIGENTE' && v.legible);
        // Un voucher sin medio (Caja o WhatsApp) cubre cualquier medio digital
        const medios = vigentes.some((v) => !v.medio) ? DIGITALES : vigentes.map((v) => v.medio as string);
        if (!vivo || medios.length === 0) return;
        setVpm(medios.map((medio) => ({ medio, monto: 0, subido: true })));
        setLegibles((prev) => ({ ...prev, ...Object.fromEntries(medios.map((m) => [m, true])) }));
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [abierto, pedidoId, vouchersPorMedio]);
  // Medios cuyo voucher el mozo decidió reemplazar (muestra el selector en vez de la línea verde)
  const [cambiando, setCambiando] = useState<Record<string, boolean>>({});
  const [confirmarEnvio, setConfirmarEnvio] = useState<boolean>(false);
  const [enviando, setEnviando] = useState<boolean>(false);
  const [enviado, setEnviado] = useState<boolean>(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  if (!abierto) return null;

  const planConMonto = (plan ?? []).filter((f) => Number(f.monto) > 0);
  const filasVigentes = ajustarPlan(total, filas);
  const planEnvio = aPlan(filasVigentes);
  const errorPlanEnvio = total > 0 ? errorPlan(total, filasVigentes) : 'El pedido no tiene total';
  const planListo = errorPlanEnvio === null;
  const medioPrincipal = planEnvio.length > 0 ? medioPrincipalPlan(planEnvio) : 'EFECTIVO';
  // Voucher: solo por la parte digital del plan (el de mayor monto digital), y compara contra ese monto
  const montoDigital = montoDigitalPlan(planEnvio);
  const hayDigital = montoDigital > 0;
  // Un voucher por medio digital del plan, cada uno comparado contra el monto de su medio
  const digitalesPlan = planEnvio.filter((f) => ['YAPE', 'PLIN', 'TRANSFERENCIA'].includes(f.medio) && f.monto > 0);
  const faltanVouchers = digitalesPlan.filter((f) => legibles[f.medio] !== true).map((f) => nombreMedio(f.medio));
  const voucherOk = hayDigital && faltanVouchers.length === 0;
  const subidoAntes = (medio: string) => (vpm ?? []).some((v) => v.medio === medio && v.subido);
  // El plan se guarda antes de cada captura: el servidor compara contra el monto de ese medio
  const guardarPlan = async () => {
    if (pedidoId !== undefined) await vouchersApi.guardarPlanPago(pedidoId, planEnvio as PlanPagoItem[]);
  };
  const desgloseEnvio = planEnvio.map((f) => `${nombreMedio(f.medio)} S/ ${f.monto.toFixed(2)}`).join(' · ');

  const handleConfirmarImpresion = async () => {
    try {
      setImprimiendo(true);
      if (alImprimir) {
        await alImprimir();
      }
      setCopiasLocales((c) => c + 1);
    } finally {
      setImprimiendo(false);
      setConfirmarImprimir(false);
    }
  };

  // El mozo no cierra el cobro: Caja revisa el voucher y es quien cobra
  const handleEnviarCaja = async () => {
    if (pedidoId === undefined || !planListo) return;
    try {
      setEnviando(true);
      setErrorEnvio(null);
      await vouchersApi.enviarACaja(pedidoId, medioPrincipal, planEnvio);
      setEnviado(true);
    } catch (err: any) {
      setErrorEnvio(err?.message || 'No se pudo enviar a Caja. Intenta de nuevo.');
    } finally {
      setEnviando(false);
      setConfirmarEnvio(false);
    }
  };

  const mensajeEnvio = [
    `Caja cobrará S/ ${Number(total || 0).toFixed(2)} (${desgloseEnvio}).`,
    hayDigital
      ? voucherOk
        ? `Caja revisará los vouchers ya subidos (${digitalesPlan.map((f) => nombreMedio(f.medio)).join(', ')}).`
        : `Falta foto legible de ${faltanVouchers.join(', ')}: Caja pedirá la foto o resolverá el cobro.`
      : null,
    'Tú no cierras el cobro.',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div role="dialog" aria-modal="true" aria-label="Precuenta" className="salon-overlay pc-overlay">
        <div onClick={alCerrar} className="pc-fondo" />
        <div className="salon-panel pc-panel">
          <header className="pc-cabecera">
            <div className="pc-titulo">Precuenta</div>
            <div className="pc-meta">
              <span>{mesa || 'Mesa'}</span>
              <span>{horaAhora()}</span>
              {mozo && <span>Mozo: {mozo}</span>}
            </div>
          </header>

          <div className="pc-cuerpo">
            <ul className="pc-lineas" aria-label="Productos">
              {lineas.map((l, i) => (
                <li key={i} className="pc-linea">
                  <span className="pc-cant">{l.cantidad}</span>
                  <span className="pc-nombre">
                    <span>{l.nombre}</span>
                    {l.detalle && <span className="pc-detalle">{l.detalle}</span>}
                  </span>
                  {l.precio !== undefined && <span className="pc-precio">{soles(l.precio)}</span>}
                </li>
              ))}
            </ul>

            <div className="pc-totales">
              {subtotal !== undefined && (
                <div className="pc-fila">
                  <span>Subtotal</span>
                  <span>{soles(subtotal)}</span>
                </div>
              )}
              {Number(descuento) > 0 && (
                <div className="pc-fila">
                  <span>Descuento</span>
                  <span>- {soles(descuento)}</span>
                </div>
              )}
              <div className="pc-total">
                <span>TOTAL</span>
                <span>{soles(total)}</span>
              </div>
              {planConMonto.length > 0 && (
                <div className="pc-plan">
                  {planConMonto.map((f) => `${nombreMedio(f.medio)} ${soles(Number(f.monto))}`).join(' · ')}
                </div>
              )}
            </div>

            <section className="pc-como-pagar" aria-label="Cómo pagar">
              <h3>Cómo pagar</h3>
              <div className="pc-tarjetas">
                <div className="pc-tarjeta">
                  <div className="pc-tarjeta-titulo">Yape o Plin</div>
                  <div className="pc-tarjeta-texto">Paga al 9XX XXX XXX. Caja cobra y emite el comprobante.</div>
                </div>
                <div className="pc-tarjeta">
                  <div className="pc-tarjeta-titulo">Efectivo</div>
                  <div className="pc-tarjeta-texto">Entrega el efectivo al mozo. Caja cobra y da el vuelto.</div>
                </div>
              </div>
            </section>

            {copiasLocales > 0 && <div className="pc-copias">Copias impresas: {copiasLocales}</div>}

            {/* Envío del cobro a Caja: el mozo toma la foto y Caja revisa y cobra */}
            {pedidoId !== undefined && (
              <div data-testid="seccion-envio-caja-mozo" className="pc-envio">
                {/* Un medio = caso simple; «Agregar medio» = pago dividido. Mismo editor que el alta de mesa */}
                {!enviado && (
                  <PlanPagoEditor
                    total={total}
                    filas={filas}
                    onChange={setFilas}
                    pagaCon={pagaCon}
                    onPagaCon={setPagaCon}
                  />
                )}

                {/* Digital: la foto se lee al instante; el mozo solo ve si se lee o no. Opcional: se puede subir después */}
                {digitalesPlan.map((f) => {
                  const yaSubido = subidoAntes(f.medio) && legibles[f.medio] === true && !cambiando[f.medio];
                  return (
                    <div key={f.medio} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div className="pc-nota-envio">
                        Voucher {nombreMedio(f.medio)} por S/ {f.monto.toFixed(2)}
                      </div>
                      {yaSubido ? (
                        <>
                          <div
                            role="status"
                            data-testid={`voucher-ya-subido-${f.medio}`}
                            style={{ color: 'var(--cp-ok, #1b7f3b)', fontWeight: 600 }}
                          >
                            Voucher de {nombreMedio(f.medio)} ya subido
                          </div>
                          {puedeCambiarVoucher && !enviado && (
                            <button
                              type="button"
                              data-testid={`btn-cambiar-voucher-${f.medio}`}
                              className="pc-btn pc-btn-secundario"
                              style={{ minHeight: 44 }}
                              onClick={() => setCambiando((prev) => ({ ...prev, [f.medio]: true }))}
                            >
                              Cambiar voucher
                            </button>
                          )}
                        </>
                      ) : (
                        <SubirVoucherMozo
                          pedidoId={pedidoId}
                          medio={f.medio as 'YAPE' | 'PLIN' | 'TRANSFERENCIA'}
                          bloqueado={enviado}
                          opcional
                          antesDeSubir={guardarPlan}
                          quitable
                          alQuitado={() => setLegibles((prev) => ({ ...prev, [f.medio]: false }))}
                          alVoucherValido={(info) => setLegibles((prev) => ({ ...prev, [f.medio]: info.legible }))}
                        />
                      )}
                    </div>
                  );
                })}

                {!hayDigital && (
                  <div data-testid="aviso-efectivo-caja" className="pc-nota-envio">
                    Efectivo: no hace falta foto. Caja cobra y da el vuelto.
                  </div>
                )}

                {hayDigital && !voucherOk && (
                  <div className="pc-nota-envio">Si no hay foto o no se lee, Caja lo revisa y resuelve el cobro.</div>
                )}
                {voucherOk && digitalesPlan.every((f) => subidoAntes(f.medio)) && (
                  <div className="pc-nota-envio">Caja revisará los vouchers ya subidos.</div>
                )}

                {!enviado && (
                  <button
                    type="button"
                    disabled={enviando || !planListo}
                    onClick={() => setConfirmarEnvio(true)}
                    data-testid="btn-enviar-caja"
                    className="pc-btn-enviar"
                  >
                    Enviar a Caja
                  </button>
                )}

                {enviado && (
                  <div role="status" data-testid="aviso-enviado-caja" className="pc-enviado">
                    Enviado a Caja, ellos lo revisan.
                  </div>
                )}

                {errorEnvio && (
                  <div role="alert" className="pc-error">
                    {errorEnvio}
                  </div>
                )}
              </div>
            )}

            <p className="pc-aviso">La precuenta no es un comprobante de pago.</p>
          </div>

          <footer className="pc-pie">
            <button type="button" onClick={() => setConfirmarImprimir(true)} className="pc-btn pc-btn-primario">
              Imprimir precuenta
            </button>
            <button type="button" onClick={alCerrar} className="pc-btn pc-btn-secundario">
              Cerrar
            </button>
          </footer>
        </div>
      </div>

      <Confirmar
        abierto={confirmarImprimir}
        titulo="¿Imprimir precuenta?"
        mensaje={`¿Imprimir la precuenta de ${mesa}? Sale en la ticketera de salón. No es un comprobante.`}
        textoConfirmar="Sí, imprimir"
        textoNo="No, cancelar"
        cargando={imprimiendo}
        alConfirmar={handleConfirmarImpresion}
        alCancelar={() => setConfirmarImprimir(false)}
      />

      <Confirmar
        abierto={confirmarEnvio}
        titulo={`¿Enviar a Caja el cobro de ${mesa}?`}
        mensaje={mensajeEnvio}
        textoConfirmar="Sí, enviar a Caja"
        textoNo="No, cancelar"
        cargando={enviando}
        alConfirmar={handleEnviarCaja}
        alCancelar={() => setConfirmarEnvio(false)}
      />
    </>
  );
}

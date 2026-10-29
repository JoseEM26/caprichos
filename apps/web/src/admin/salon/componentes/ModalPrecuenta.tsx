import { useState } from 'react';
import '../salon.css';
import '../precuenta.css';
import { Confirmar } from '../../../comun/Confirmar';
import { SubirVoucherMozo } from '../../vouchers/SubirVoucherMozo';
import { vouchersApi } from '../../vouchers/vouchersApi';
import { nombreMedio } from '../../pedidos/planPago';

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
  /** Pago dividido: monto por medio. Sin plan se muestra solo el total. */
  plan?: Array<{ medio: string; monto: number | string }>;
  mozo?: string | null;
  copias?: number;
  alImprimir?: () => Promise<void> | void;
  /** Con pedido, el mozo puede enviar el cobro a Caja (no lo cobra él). */
  pedidoId?: string | number;
}

type MedioEnvio = 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TRANSFERENCIA';

const MEDIOS_ENVIO: ReadonlyArray<{ id: MedioEnvio; nombre: string }> = [
  { id: 'EFECTIVO', nombre: 'Efectivo' },
  { id: 'YAPE', nombre: 'Yape' },
  { id: 'PLIN', nombre: 'Plin' },
  { id: 'TRANSFERENCIA', nombre: 'Transferencia' },
];

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
}: ModalPrecuentaProps) {
  const [confirmarImprimir, setConfirmarImprimir] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [copiasLocales, setCopiasLocales] = useState(copias);

  // Envío del cobro a Caja: el mozo elige el medio y, si es digital, toma la foto del voucher
  const [medio, setMedio] = useState<MedioEnvio>('EFECTIVO');
  const [voucherLegible, setVoucherLegible] = useState<boolean>(false);
  const [confirmarEnvio, setConfirmarEnvio] = useState<boolean>(false);
  const [enviando, setEnviando] = useState<boolean>(false);
  const [enviado, setEnviado] = useState<boolean>(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  if (!abierto) return null;

  const esDigital = medio !== 'EFECTIVO';
  const nombreMedioEnvio = MEDIOS_ENVIO.find((m) => m.id === medio)?.nombre ?? medio;
  const planConMonto = (plan ?? []).filter((f) => Number(f.monto) > 0);

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
    if (pedidoId === undefined) return;
    try {
      setEnviando(true);
      setErrorEnvio(null);
      await vouchersApi.enviarACaja(pedidoId, medio);
      setEnviado(true);
    } catch (err: any) {
      setErrorEnvio(err?.message || 'No se pudo enviar a Caja. Intenta de nuevo.');
    } finally {
      setEnviando(false);
      setConfirmarEnvio(false);
    }
  };

  const mensajeEnvio = !esDigital
    ? `Caja cobrará S/ ${Number(total || 0).toFixed(2)} en efectivo. Tú no cierras el cobro.`
    : voucherLegible
      ? `Caja revisará la foto del voucher de ${nombreMedioEnvio} y cobrará S/ ${Number(total || 0).toFixed(2)}. Tú no cierras el cobro.`
      : `No hay foto legible de ${nombreMedioEnvio}: Caja pedirá la foto o resolverá el cobro.`;

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
                <div className="pc-envio-titulo">Medio de pago en mesa:</div>
                <div className="pc-medios">
                  {MEDIOS_ENVIO.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={medio === m.id}
                      disabled={enviado}
                      onClick={() => {
                        setMedio(m.id);
                        setVoucherLegible(false);
                      }}
                      className="pc-medio"
                    >
                      {m.nombre}
                    </button>
                  ))}
                </div>

                {/* Digital: la foto se lee al instante; el mozo solo ve si se lee o no */}
                {esDigital && (
                  <SubirVoucherMozo
                    key={medio}
                    pedidoId={pedidoId}
                    medio={medio as 'YAPE' | 'PLIN' | 'TRANSFERENCIA'}
                    bloqueado={enviado}
                    alVoucherValido={(info) => setVoucherLegible(info.legible)}
                  />
                )}

                {!esDigital && (
                  <div data-testid="aviso-efectivo-caja" className="pc-nota-envio">
                    Efectivo: no hace falta foto. Caja cobra y da el vuelto.
                  </div>
                )}

                {esDigital && !voucherLegible && (
                  <div className="pc-nota-envio">Si no hay foto o no se lee, Caja lo revisa y resuelve el cobro.</div>
                )}

                {!enviado && (
                  <button
                    type="button"
                    disabled={enviando}
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

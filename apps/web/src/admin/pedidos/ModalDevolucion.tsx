import { useEffect, useId, useState } from 'react';
import { CampoCodigoSupervisor } from '../../comun/CampoCodigoSupervisor';
import { ErrorApi } from '../../comun/api';
import { hayAutorizacionSupervisor, limpiarAutorizacionSupervisor } from '../../comun/autorizacionSupervisor';
import { usePideCodigo } from '../../comun/usePideCodigo';
import { pedidosApi, type NoEntregado, type RegistroDevolucion, type SugerenciaDevolucion } from './pedidosApi';

/** Medios en los que se devuelve. El efectivo sale de la caja de hoy; los digitales piden código de operación. */
const MEDIOS: Array<{ valor: string; texto: string }> = [
  { valor: 'EFECTIVO', texto: 'Efectivo (sale de la caja de hoy)' },
  { valor: 'YAPE', texto: 'Yape' },
  { valor: 'PLIN', texto: 'Plin' },
  { valor: 'TRANSFERENCIA', texto: 'Transferencia' },
  { valor: 'TARJETA', texto: 'Tarjeta' },
];

/** Comprobante que ya quedó dado de baja: no hay nada que anular. */
const BAJA_HECHA = ['ACEPTADA', 'SOLICITADA', 'PENDIENTE_RESUMEN'];

const soles = (v: number) => `S/ ${v.toFixed(2)}`;

/** Monto válido: más de 0, como máximo dos decimales y no más que lo pagado. */
function montoValido(texto: string, pagado: number): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  const n = Number(limpio);
  if (!(n > 0) || n > pagado + 1e-9) return null;
  return n;
}

const estiloCampo = {
  width: '100%',
  boxSizing: 'border-box' as const,
  minHeight: 44,
  padding: '8px 12px',
  borderRadius: 10,
  border: '1.5px solid var(--cp-line, #E3D6C6)',
  fontSize: 15,
  color: 'var(--cp-navy, #0B2C3E)',
  background: 'var(--cp-white, #FFFFFF)',
};

const estiloEtiqueta = { fontSize: 13, fontWeight: 800, color: 'var(--cp-navy, #0B2C3E)' };

export interface ModalDevolucionProps {
  pedido: NoEntregado;
  alCerrar: () => void;
  alRegistrar: (resultado: RegistroDevolucion) => void;
}

export function ModalDevolucion({ pedido, alCerrar, alRegistrar }: ModalDevolucionProps) {
  const idTitulo = useId();
  const [sugerencia, setSugerencia] = useState<SugerenciaDevolucion | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [monto, setMonto] = useState('');
  const [medio, setMedio] = useState('EFECTIVO');
  const [codigoOperacion, setCodigoOperacion] = useState('');
  const [motivo, setMotivo] = useState('');
  const [codigoSupervisor, setCodigoSupervisor] = useState('');
  const [autorizado, setAutorizado] = useState<boolean>(() => hayAutorizacionSupervisor());
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const pideCodigo = usePideCodigo();

  useEffect(() => {
    let vivo = true;
    pedidosApi
      .sugerenciaDevolucion(pedido.id)
      .then((s) => {
        if (!vivo) return;
        setSugerencia(s);
        setMonto(s.montoSugerido.toFixed(2));
        setMedio(s.medioOriginal ?? 'EFECTIVO');
      })
      .catch((err: any) => {
        if (vivo) setErrorCarga(err?.message || 'No se pudo cargar la devolución del pedido');
      });
    return () => {
      vivo = false;
    };
  }, [pedido.id]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !enviando) alCerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [alCerrar, enviando]);

  const pagado = sugerencia?.montoPagado ?? 0;
  const montoNum = montoValido(monto, pagado);
  const cambiaMonto = sugerencia !== null && montoNum !== null && Math.abs(montoNum - sugerencia.montoSugerido) > 0.001;
  const esDigital = medio !== 'EFECTIVO';
  const comprobante = sugerencia?.comprobante ?? null;
  const yaDadoDeBaja = comprobante !== null && BAJA_HECHA.includes(comprobante.bajaEstado ?? '');

  const enviar = async () => {
    if (!sugerencia) return;
    setError('');
    if (montoNum === null) {
      setError(`Escribe un monto entre S/ 0.01 y ${soles(pagado)}, con hasta dos decimales.`);
      return;
    }
    if (esDigital && !codigoOperacion.trim()) {
      setError('Escribe el código de operación de la devolución.');
      return;
    }
    if (cambiaMonto && motivo.trim().length < 10) {
      setError('Explica por qué devuelves otro monto (mínimo 10 letras).');
      return;
    }
    const codigoSup = codigoSupervisor.trim();
    if (pideCodigo && !autorizado && !/^\d{6}$/.test(codigoSup)) {
      setError('El código del supervisor tiene 6 dígitos.');
      return;
    }

    setEnviando(true);
    try {
      const resultado = await pedidosApi.registrarDevolucion(
        pedido.id,
        {
          montoDevuelto: montoNum,
          medio,
          ...(esDigital ? { codigoOperacion: codigoOperacion.trim() } : {}),
          ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
        },
        pideCodigo && !autorizado ? codigoSup : undefined,
      );
      setCodigoSupervisor('');
      alRegistrar(resultado);
    } catch (err: any) {
      setCodigoSupervisor('');
      if (err instanceof ErrorApi && (err.codigo === 'CODIGO_INVALIDO' || err.codigo === 'PIN_INVALIDO')) {
        if (autorizado) {
          limpiarAutorizacionSupervisor();
          setAutorizado(false);
          setError('La autorización del supervisor venció. Escribe el código otra vez.');
        } else {
          setError(err.message || 'Código del supervisor inválido. Pídelo nuevamente a la supervisora.');
        }
      } else if (err instanceof ErrorApi && err.codigo === 'CODIGO_BLOQUEADO') {
        setError('Demasiados intentos con el código. Espera 1 minuto.');
      } else {
        setError(err?.message || 'No se pudo registrar la devolución');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div
        onClick={() => !enviando && alCerrar()}
        style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(11, 44, 62, 0.55)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        data-testid="modal-devolucion"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 61,
          width: 'min(440px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          background: 'var(--cp-white, #FFFFFF)',
          borderRadius: 16,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxSizing: 'border-box',
        }}
      >
        <h2 id={idTitulo} style={{ margin: 0, fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--cp-navy, #0B2C3E)' }}>
          Devolver pedido {pedido.codigo}
        </h2>

        {errorCarga && (
          <div role="alert" style={{ fontSize: 14, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
            {errorCarga}
          </div>
        )}

        {!sugerencia && !errorCarga && <div style={{ fontSize: 14, color: 'var(--cp-soft, #2C4C5D)' }}>Cargando datos del pago...</div>}

        {sugerencia && (
          <>
            <dl
              aria-label="Resumen del pago"
              style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px', fontSize: 14, color: 'var(--cp-navy, #0B2C3E)' }}
            >
              <dt>Pagado</dt>
              <dd style={{ margin: 0, fontWeight: 700 }}>{soles(sugerencia.montoPagado)}</dd>
              <dt>Envío (el repartidor ya salió)</dt>
              <dd style={{ margin: 0, fontWeight: 700 }}>{soles(sugerencia.montoEnvio)}</dd>
              <dt>Sugerido a devolver</dt>
              <dd style={{ margin: 0, fontWeight: 800 }}>{soles(sugerencia.montoSugerido)}</dd>
            </dl>

            {comprobante && (
              <div
                data-testid="aviso-comprobante"
                style={{ fontSize: 13, lineHeight: '18px', padding: 10, borderRadius: 10, background: 'var(--cp-sand, #EDE1D1)', color: 'var(--cp-navy, #0B2C3E)' }}
              >
                {yaDadoDeBaja
                  ? `El comprobante ${comprobante.numero} ya está dado de baja.`
                  : `Al devolver se dará de baja el comprobante ${comprobante.numero} ante SUNAT.`}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor={`${idTitulo}-monto`} style={estiloEtiqueta}>
                Monto a devolver (S/)
              </label>
              <input
                id={`${idTitulo}-monto`}
                type="text"
                inputMode="decimal"
                autoFocus
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                style={estiloCampo}
                aria-invalid={monto !== '' && montoNum === null}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor={`${idTitulo}-medio`} style={estiloEtiqueta}>
                Cómo se devuelve
              </label>
              <select id={`${idTitulo}-medio`} value={medio} onChange={(e) => setMedio(e.target.value)} style={estiloCampo}>
                {MEDIOS.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.texto}
                  </option>
                ))}
              </select>
            </div>

            {esDigital && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label htmlFor={`${idTitulo}-operacion`} style={estiloEtiqueta}>
                  Código de operación de la devolución
                </label>
                <input
                  id={`${idTitulo}-operacion`}
                  type="text"
                  autoComplete="off"
                  value={codigoOperacion}
                  onChange={(e) => setCodigoOperacion(e.target.value)}
                  style={estiloCampo}
                />
              </div>
            )}

            {cambiaMonto && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label htmlFor={`${idTitulo}-motivo`} style={estiloEtiqueta}>
                  ¿Por qué cambia el monto? (obligatorio)
                </label>
                <textarea
                  id={`${idTitulo}-motivo`}
                  rows={2}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  style={{ ...estiloCampo, resize: 'vertical' }}
                />
              </div>
            )}

            {pideCodigo && !autorizado && (
              <CampoCodigoSupervisor
                id={`${idTitulo}-supervisor`}
                valor={codigoSupervisor}
                onChange={setCodigoSupervisor}
                etiqueta="Código de la supervisora (6 dígitos)"
                ayuda="Lo ve la supervisora en su pantalla y cambia cada 30 segundos"
              />
            )}

            {error && (
              <div role="alert" style={{ fontSize: 14, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={alCerrar}
                disabled={enviando}
                style={{
                  minHeight: 44,
                  padding: '0 16px',
                  borderRadius: 12,
                  border: '1.5px solid var(--cp-navy, #0B2C3E)',
                  background: 'var(--cp-white, #FFFFFF)',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={enviar}
                disabled={enviando}
                style={{
                  minHeight: 44,
                  padding: '0 16px',
                  borderRadius: 12,
                  border: 0,
                  background: 'var(--cp-navy, #0B2C3E)',
                  color: 'var(--cp-white, #FFFFFF)',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: enviando ? 'wait' : 'pointer',
                }}
              >
                {enviando ? 'Registrando...' : `Registrar devolución de ${soles(montoNum ?? 0)}`}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

import React, { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { CampoCodigoSupervisor } from '../../comun/CampoCodigoSupervisor';
import {
  cierreApi,
  DENOMINACIONES_LISTA,
  calcularTotalEfectivo,
  ArqueoRespuesta,
} from './cierreApi';
import { ErrorApi } from '../../comun/api';

interface ArqueoCiegoFormProps {
  alCerrarCajaExitoso?: () => void;
}

export function ArqueoCiegoForm({ alCerrarCajaExitoso }: ArqueoCiegoFormProps) {
  // Conteo de billetes y monedas por clave de denominación
  const [conteo, setConteo] = useState<Record<string, string>>({
    '200': '',
    '100': '',
    '50': '',
    '20': '',
    '10': '',
    '5': '',
    '2': '',
    '1': '',
    '0.5': '',
    '0.2': '',
    '0.1': '',
  });

  // Medios digitales vistos en celulares/terminales
  const [yape, setYape] = useState<string>('');
  const [plin, setPlin] = useState<string>('');
  const [transferencia, setTransferencia] = useState<string>('');
  const [tarjeta, setTarjeta] = useState<string>('');

  // Resultado de arqueo
  const [resultadoArqueo, setResultadoArqueo] = useState<ArqueoRespuesta | null>(null);
  const [intentosFallidos, setIntentosFallidos] = useState<number>(0);
  const [requierePin, setRequierePin] = useState<boolean>(false);

  // PIN del supervisor (NUNCA guardado persistentemente, limpiado tras uso)
  const [pinSupervisor, setPinSupervisor] = useState<string>('');

  // Observación/nota de cierre
  const [nota, setNota] = useState<string>('');

  // Estados de carga y mensajes
  const [revisando, setRevisando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [errorArqueo, setErrorArqueo] = useState<string | null>(null);
  const [errorCierre, setErrorCierre] = useState<string | null>(null);
  const [cierreExitoso, setCierreExitoso] = useState<string | null>(null);

  // Modal de confirmación para cerrar caja
  const [mostrarConfirmarCierre, setMostrarConfirmarCierre] = useState(false);

  // Total en efectivo contado en pantalla
  const totalEfectivoContado = calcularTotalEfectivo(conteo);

  const handleCambiarConteo = (clave: string, valor: string) => {
    // Solo enteros positivos para conteo de piezas
    const limpio = valor.replace(/\D/g, '');
    setConteo((prev) => ({ ...prev, [clave]: limpio }));
  };

  const prepararDatosArqueo = () => {
    const conteoNumerico: Record<string, number> = {};
    for (const [k, v] of Object.entries(conteo)) {
      const n = parseInt(v || '0', 10);
      if (n > 0) conteoNumerico[k] = n;
    }

    const medios = {
      yape: parseFloat(yape) || 0,
      plin: parseFloat(plin) || 0,
      transferencia: parseFloat(transferencia) || 0,
      tarjeta: parseFloat(tarjeta) || 0,
    };

    return { conteo: conteoNumerico, medios };
  };

  const handleRevisarArqueo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorArqueo(null);
    setErrorCierre(null);
    setRevisando(true);

    try {
      const dto = prepararDatosArqueo();
      const pinAEnviar = pinSupervisor.trim() || undefined;

      const res = await cierreApi.realizarArqueo(dto, pinAEnviar);
      setResultadoArqueo(res);

      if (res.resultado === 'NO_CUADRA') {
        // Solo los arqueos que no cuadran suman para el PIN; un arqueo que cuadra no suma
        const nuevosIntentos = intentosFallidos + 1;
        setIntentosFallidos(nuevosIntentos);
        if (nuevosIntentos >= 3) {
          setRequierePin(true);
        }
      } else {
        // Cuadra
        setRequierePin(false);
      }
    } catch (err: any) {
      if (err instanceof ErrorApi) {
        if (err.codigo === 'PIN_REQUERIDO' || err.codigo === 'CODIGO_REQUERIDO') {
          setRequierePin(true);
          setErrorArqueo(
            err.message || 'Se requiere el código de supervisor para continuar con el arqueo.',
          );
        } else if (err.codigo === 'CODIGO_INVALIDO' || err.codigo === 'PIN_INVALIDO') {
          setErrorArqueo('Código de supervisor inválido. Pídelo a la supervisora.');
        } else if (err.codigo === 'CODIGO_BLOQUEADO' || err.codigo === 'PIN_BLOQUEADO') {
          setErrorArqueo(err.message || 'Demasiados intentos con el código del supervisor. Espera 1 min o pide al administrador que lo desbloquee.');
        } else if (err.codigo === 'SUPERVISOR_SIN_CONFIGURAR') {
          setErrorArqueo('El local aún no tiene configurado el código de supervisor. El administrador debe generarlo desde su pantalla.');
        } else {
          setErrorArqueo(err.message || 'Error al procesar el arqueo');
        }
      } else {
        setErrorArqueo('Error inesperado al conectar con el servidor');
      }
    } finally {
      // Limpiar el código del estado por seguridad tras el envío
      setPinSupervisor('');
      setRevisando(false);
    }
  };

  const handleIntentarCerrarCaja = () => {
    setErrorCierre(null);

    // Si ya van 3 arqueos que no cuadraron o la API exige código, validar que el supervisor haya puesto código y nota >= 3
    const exigePinSupervisor = intentosFallidos >= 3 || requierePin;
    if (exigePinSupervisor) {
      if (!pinSupervisor.trim()) {
        setErrorCierre('Se alcanzó el límite de intentos: se requiere el código de 6 dígitos del supervisor.');
        return;
      }
      if (!nota.trim() || nota.trim().length < 3) {
        setErrorCierre('Se requiere una nota explicativa de al menos 3 caracteres para cerrar la caja con diferencias.');
        return;
      }
    }

    setMostrarConfirmarCierre(true);
  };

  const handleConfirmarCerrarCaja = async () => {
    setCerrando(true);
    setErrorCierre(null);

    try {
      const dto = prepararDatosArqueo();
      const pinAEnviar = pinSupervisor.trim() || undefined;

      const res = await cierreApi.cerrarCaja(
        {
          conteo: dto.conteo,
          medios: dto.medios,
          nota: nota.trim() || undefined,
        },
        pinAEnviar,
      );

      setMostrarConfirmarCierre(false);
      setCierreExitoso(`Caja #${res.cajaId} cerrada exitosamente. Resultado: ${res.resultado}.`);
      // Limpiar PIN
      setPinSupervisor('');
      alCerrarCajaExitoso?.();
    } catch (err: any) {
      setMostrarConfirmarCierre(false);
      // Limpiar PIN de inmediato si falla
      setPinSupervisor('');
      if (err instanceof ErrorApi) {
        if (err.codigo === 'COBROS_EN_CURSO') {
          setErrorCierre(err.message || 'No se puede cerrar la caja: hay cobros en curso o por confirmar.');
        } else if (err.codigo === 'REPARTIDORES_SIN_LIQUIDAR') {
          setErrorCierre(err.message || 'No se puede cerrar la caja: falta liquidar repartidores.');
        } else if (err.codigo === 'PIN_REQUERIDO' || err.codigo === 'PIN_INVALIDO') {
          setRequierePin(true);
          setErrorCierre(err.message || 'PIN de supervisor inválido o requerido.');
        } else {
          setErrorCierre(err.message || 'Error al cerrar la caja');
        }
      } else {
        setErrorCierre('Error al cerrar la caja');
      }
    } finally {
      setCerrando(false);
    }
  };

  return (
    <div
      style={{
        background: 'var(--cp-white)',
        border: '1px solid var(--cp-line)',
        borderRadius: '16px',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div>
        <h2
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '18px',
            color: 'var(--cp-navy)',
            margin: 0,
          }}
        >
          Arqueo ciego de caja
        </h2>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--cp-soft)' }}>
          Cuenta el efectivo por denominación y anota lo que ves en cada medio digital sin ver los montos esperados del sistema.
        </p>
      </div>

      {cierreExitoso && (
        <div
          role="status"
          style={{
            background: 'var(--cp-greenbg, #DEF7EC)',
            border: '1.5px solid var(--cp-green, #2F7A45)',
            color: '#1F5C33',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: 800,
          }}
        >
          {cierreExitoso}
        </div>
      )}

      <form onSubmit={handleRevisarArqueo} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Paso 1: Conteo de billetes y monedas */}
        <div
          style={{
            border: '1.5px solid var(--cp-navy)',
            borderRadius: '14px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--cp-navy)' }}>
              1. Conteo de efectivo por denominación
            </span>
            <span
              data-testid="total-efectivo-contado"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                fontSize: '16px',
                color: 'var(--cp-rust)',
              }}
            >
              Total efectivo: S/ {totalEfectivoContado.toFixed(2)}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '14px',
            }}
          >
            {/* Columna Billetes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--cp-soft)', textTransform: 'uppercase' }}>
                Billetes
              </span>
              {DENOMINACIONES_LISTA.filter((d) => d.tipo === 'billete').map((d) => {
                const cant = parseInt(conteo[d.clave] || '0', 10);
                const subtotal = cant * d.valor;
                return (
                  <div
                    key={d.clave}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'var(--cp-cream)',
                      borderRadius: '10px',
                      padding: '6px 10px',
                    }}
                  >
                    <label
                      htmlFor={`den-${d.clave}`}
                      style={{ width: '64px', fontWeight: 800, fontSize: '13px', color: 'var(--cp-navy)' }}
                    >
                      {d.etiqueta}
                    </label>
                    <input
                      id={`den-${d.clave}`}
                      type="text"
                      inputMode="numeric"
                      value={conteo[d.clave] || ''}
                      onChange={(e) => handleCambiarConteo(d.clave, e.target.value)}
                      placeholder="0"
                      aria-label={`Cantidad de billetes de ${d.etiqueta}`}
                      style={{
                        width: '70px',
                        minHeight: '38px',
                        boxSizing: 'border-box',
                        borderRadius: '8px',
                        border: '1.5px solid var(--cp-line)',
                        background: 'var(--cp-white)',
                        textAlign: 'center',
                        fontSize: '14px',
                        fontWeight: 700,
                      }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--cp-soft)', fontWeight: 600, flex: 1, textAlign: 'right' }}>
                      = S/ {subtotal.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Columna Monedas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--cp-soft)', textTransform: 'uppercase' }}>
                Monedas
              </span>
              {DENOMINACIONES_LISTA.filter((d) => d.tipo === 'moneda').map((d) => {
                const cant = parseInt(conteo[d.clave] || '0', 10);
                const subtotal = cant * d.valor;
                return (
                  <div
                    key={d.clave}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'var(--cp-cream)',
                      borderRadius: '10px',
                      padding: '6px 10px',
                    }}
                  >
                    <label
                      htmlFor={`den-${d.clave}`}
                      style={{ width: '64px', fontWeight: 800, fontSize: '13px', color: 'var(--cp-navy)' }}
                    >
                      {d.etiqueta}
                    </label>
                    <input
                      id={`den-${d.clave}`}
                      type="text"
                      inputMode="numeric"
                      value={conteo[d.clave] || ''}
                      onChange={(e) => handleCambiarConteo(d.clave, e.target.value)}
                      placeholder="0"
                      aria-label={`Cantidad de monedas de ${d.etiqueta}`}
                      style={{
                        width: '70px',
                        minHeight: '38px',
                        boxSizing: 'border-box',
                        borderRadius: '8px',
                        border: '1.5px solid var(--cp-line)',
                        background: 'var(--cp-white)',
                        textAlign: 'center',
                        fontSize: '14px',
                        fontWeight: 700,
                      }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--cp-soft)', fontWeight: 600, flex: 1, textAlign: 'right' }}>
                      = S/ {subtotal.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Paso 2: Medios digitales vistos */}
        <div
          style={{
            border: '1.5px solid var(--cp-navy)',
            borderRadius: '14px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div>
            <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--cp-navy)' }}>
              2. Billeteras digitales y tarjetas (conteo ciego)
            </span>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--cp-soft)' }}>
              Anota el saldo que observas en tu teléfono o en el POS de tarjeta. No se muestra lo esperado por el sistema.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            <div>
              <label
                htmlFor="medio-yape"
                style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)', marginBottom: '4px' }}
              >
                Yape (S/)
              </label>
              <input
                id="medio-yape"
                type="number"
                step="0.01"
                min="0"
                value={yape}
                onChange={(e) => setYape(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 12px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="medio-plin"
                style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)', marginBottom: '4px' }}
              >
                Plin (S/)
              </label>
              <input
                id="medio-plin"
                type="number"
                step="0.01"
                min="0"
                value={plin}
                onChange={(e) => setPlin(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 12px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="medio-transf"
                style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)', marginBottom: '4px' }}
              >
                Transferencia bancaria (S/)
              </label>
              <input
                id="medio-transf"
                type="number"
                step="0.01"
                min="0"
                value={transferencia}
                onChange={(e) => setTransferencia(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 12px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="medio-tarjeta"
                style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)', marginBottom: '4px' }}
              >
                Tarjeta / POS (S/)
              </label>
              <input
                id="medio-tarjeta"
                type="number"
                step="0.01"
                min="0"
                value={tarjeta}
                onChange={(e) => setTarjeta(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--cp-line)',
                  padding: '0 12px',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>
        </div>

        {/* Botón de Arqueo y Resultado */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Boton
            type="submit"
            variante="oscuro"
            cargando={revisando}
            style={{ minHeight: '48px', fontSize: '15px', fontWeight: 800 }}
          >
            Revisar arqueo ciego
          </Boton>

          {resultadoArqueo && (
            <div
              data-testid="resultado-arqueo"
              role="status"
              style={{
                borderRadius: '12px',
                padding: '14px',
                textAlign: 'center',
                background:
                  resultadoArqueo.resultado === 'CUADRA' ? 'var(--cp-greenbg, #DEF7EC)' : '#FDE8E8',
                border: `2px solid ${resultadoArqueo.resultado === 'CUADRA' ? 'var(--cp-green, #2F7A45)' : 'var(--cp-rust, #B2500F)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <span
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: '22px',
                  color:
                    resultadoArqueo.resultado === 'CUADRA'
                      ? 'var(--cp-green, #2F7A45)'
                      : 'var(--cp-rust, #B2500F)',
                }}
              >
                {resultadoArqueo.resultado === 'CUADRA' ? 'Cuadra' : 'No cuadra'}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--cp-soft)', fontWeight: 700 }}>
                Intento #{resultadoArqueo.intento}
              </span>
            </div>
          )}

          {errorArqueo && (
            <div
              role="alert"
              style={{
                background: '#FDE8E8',
                border: '1.5px solid var(--cp-rust)',
                color: 'var(--cp-rust)',
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              {errorArqueo}
            </div>
          )}
        </div>

        {/* Sección de Código de Supervisor (se muestra si van 3 arqueos que no cuadraron o si la API lo pide) */}
        {(requierePin || intentosFallidos >= 3) && (
          <div
            data-testid="seccion-pin-supervisor"
            style={{
              background: '#FFF6E3',
              border: '1.5px solid var(--cp-gold)',
              borderRadius: '14px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div>
              <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--cp-navy)' }}>
                Autorización de supervisor requerida
              </span>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--cp-soft)' }}>
                {intentosFallidos >= 3
                  ? 'Se alcanzaron 3 arqueos que no cuadraron. Se exige código de supervisor para cerrar.'
                  : 'Si el arqueo no cuadra, el cierre requiere código de supervisor y una nota explicativa.'}
              </p>
            </div>

            <CampoCodigoSupervisor
              id="pin-supervisor-input"
              dataTestId="pin-supervisor-input"
              valor={pinSupervisor}
              onChange={setPinSupervisor}
              etiqueta="Código del supervisor (6 dígitos)"
              ayuda="Pídelo a la supervisora: lo ve en su pantalla y cambia cada 30 segundos"
            />
          </div>
        )}

        {/* Paso 3: Observaciones y Cierre final */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <label
              htmlFor="cierre-obs"
              style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--cp-navy)', marginBottom: '4px' }}
            >
              Observaciones del cierre (opcional salvo si no cuadra)
            </label>
            <textarea
              id="cierre-obs"
              rows={2}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Indica cualquier incidencia ocurrida durante el turno..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: '10px',
                border: '1.5px solid var(--cp-line)',
                padding: '8px 12px',
                fontSize: '14px',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {errorCierre && (
            <div
              role="alert"
              style={{
                background: '#FDE8E8',
                border: '1.5px solid var(--cp-rust)',
                color: 'var(--cp-rust)',
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              {errorCierre}
            </div>
          )}

          <Boton
            type="button"
            variante="primario"
            onClick={handleIntentarCerrarCaja}
            cargando={cerrando}
            style={{
              minHeight: '52px',
              fontSize: '16px',
              fontWeight: 800,
            }}
          >
            Cerrar caja
          </Boton>
        </div>
      </form>

      {/* Modal de confirmación para cierre definitivo */}
      <Confirmar
        abierto={mostrarConfirmarCierre}
        titulo="¿Cerrar la caja del día?"
        mensaje="Esta acción es inmutable y registrará el cierre en el historial. No se podrá revertir ni modificar."
        textoSi="Sí, cerrar caja"
        textoNo="No, revisar"
        peligro
        cargando={cerrando}
        alConfirmar={handleConfirmarCerrarCaja}
        alCancelar={() => setMostrarConfirmarCierre(false)}
      />
    </div>
  );
}

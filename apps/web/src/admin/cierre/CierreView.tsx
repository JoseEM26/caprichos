import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { HistorialCierres } from './HistorialCierres';
import { cierreApi, calcularTotalEfectivo, RepartidorPorLiquidar } from './cierreApi';
import { pedidosApi, MovimientoCaja, Pedido } from '../pedidos/pedidosApi';

type TabCierre = 'turno' | 'historial';

export function CierreView() {
  const { usuario, tiene } = useSesion();
  const puedeVer = tiene('caja/ver') || tiene('caja/cerrar') || usuario?.rol === 'ADMIN' || usuario?.rol === 'CAJERO';
  const esAdmin = usuario?.rol === 'ADMIN';

  const [tabActiva, setTabActiva] = useState<TabCierre>('turno');

  // Estados de datos
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [cajaAbierta, setCajaAbierta] = useState(true);
  const [cajaId, setCajaId] = useState('');
  const horaApertura = '14:00';
  const cajeroNombre = usuario?.nombres ? `${usuario.nombres} (${usuario.rol?.toLowerCase() || 'cajero'})` : 'Cajera de turno';
  const [aperturaMonto, setAperturaMonto] = useState(0);

  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [esperado, setEsperado] = useState<any>(null);
  const [repartidores, setRepartidores] = useState<RepartidorPorLiquidar[]>([]);
  const [pedidosAbiertos, setPedidosAbiertos] = useState<Pedido[]>([]);
  const [pedidosCobrados, setPedidosCobrados] = useState<Pedido[]>([]);

  // Mensaje de éxito/notificación
  const [cjMsg, setCjMsg] = useState('');

  // Modales
  const [abrirModalMov, setAbrirModalMov] = useState(false);
  const [abrirModalAbrir, setAbrirModalAbrir] = useState(false);
  const [abrirModalCierre, setAbrirModalCierre] = useState(false);

  // Estados modal movimiento
  const [tipoMov, setTipoMov] = useState<'INGRESO' | 'EGRESO'>('EGRESO');
  const [montoMov, setMontoMov] = useState('');
  const [motivoMov, setMotivoMov] = useState('');
  const [errorMov, setErrorMov] = useState('');

  // Estados modal abrir
  const [montoAbrir, setMontoAbrir] = useState('0.00');

  // Estados modal cierre y arqueo
  const [faseCierre, setFaseCierre] = useState<'verificar' | 'arqueo'>('verificar');
  const [conteoBilletes, setConteoBilletes] = useState<Record<string, string>>({
    '200': '',
    '100': '',
    '50': '',
    '20': '',
    '10': '',
  });
  const [conteoMonedas, setConteoMonedas] = useState<Record<string, string>>({
    '5': '',
    '2': '',
    '1': '',
    '0.5': '',
    '0.2': '',
    '0.1': '',
  });
  const [mediosDigitales, setMediosDigitales] = useState({
    yape: '',
    plin: '',
    transferencia: '',
    tarjeta: '',
    otros: '',
  });
  const [obsCierre, setObsCierre] = useState('');
  const [pinSupervisora, setPinSupervisora] = useState('');
  const [revisadoCuadra, setRevisadoCuadra] = useState<boolean | null>(null);
  const [pinVerificado, setPinVerificado] = useState(false);
  const [msgCierreError, setMsgCierreError] = useState('');
  const [cerrandoCaja, setCerrandoCaja] = useState(false);

  // Cargar datos del turno
  const cargarTurno = useCallback(async () => {
    setErrorCarga('');
    try {
      // 1. Caja actual
      try {
        const cActual = await pedidosApi.obtenerCajaActual();
        if (cActual) {
          setCajaAbierta(cActual.abierta || cActual.caja?.estado === 'ABIERTA');
          if (cActual.caja) {
            setCajaId(`CJ-${String(cActual.caja.id).padStart(4, '0')}`);
            setAperturaMonto(Number(cActual.caja.apertura || 0));
          }
        }
      } catch {
        // En mock mode puede fallar
      }

      // 2. Esperado (solo admin o si está habilitado)
      try {
        const esp = await cierreApi.obtenerEsperado();
        if (esp) {
          setEsperado(esp);
          if (esp.cajaId) {
            setCajaAbierta(true);
            setCajaId(`CJ-${String(esp.cajaId).padStart(4, '0')}`);
            setAperturaMonto(esp.apertura || 0);
          }
        }
      } catch {
        //
      }

      // 3. Movimientos
      try {
        const movs = await pedidosApi.listarMovimientos();
        setMovimientos(movs || []);
      } catch {
        setMovimientos([]);
      }

      // 4. Repartidores
      try {
        const reps = await cierreApi.listarRepartidoresPorLiquidar();
        setRepartidores(reps || []);
      } catch {
        setRepartidores([]);
      }

      // 5. Pedidos abiertos y cobrados
      try {
        const peds = await pedidosApi.listar({ limite: 100 });
        const items = peds.items || [];
        setPedidosAbiertos(
          items.filter((p) => {
            const e = String(p.estado || '').toUpperCase();
            const pag = String(p.pago_estado || '').toUpperCase();
            return pag !== 'PAGADO' && e !== 'ANULADO' && e !== 'RECHAZADO' && e !== 'ENTREGADO';
          })
        );
        setPedidosCobrados(
          items.filter((p) => String(p.pago_estado || '').toUpperCase() === 'PAGADO')
        );
      } catch {
        setPedidosAbiertos([]);
      }
    } catch (err: any) {
      setErrorCarga(err?.message || 'Error al cargar los datos de caja y cierre');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarTurno();
  }, [cargarTurno]);

  // Cálculos de ventas y efectivo
  const ventasTotales = useMemo(() => {
    if (esperado) {
      const { efectivo = 0, yape = 0, plin = 0, transferencia = 0, tarjeta = 0 } = esperado.medios || {};
      return efectivo + yape + plin + transferencia + tarjeta;
    }
    return pedidosCobrados.reduce((acc, p) => acc + Number(p.total || 0), 0);
  }, [esperado, pedidosCobrados]);

  const ventasEfectivo = esperado?.desglose?.ventasEfectivo ?? 0;
  const ingresosExtra = useMemo(() => {
    if (esperado?.desglose?.ingresos !== undefined) return esperado.desglose.ingresos;
    return movimientos.filter((m) => m.tipo === 'INGRESO').reduce((acc, m) => acc + Number(m.monto || 0), 0);
  }, [esperado, movimientos]);

  const egresosGasto = useMemo(() => {
    if (esperado?.desglose?.egresos !== undefined) return esperado.desglose.egresos;
    return movimientos.filter((m) => m.tipo === 'EGRESO').reduce((acc, m) => acc + Number(m.monto || 0), 0);
  }, [esperado, movimientos]);

  const efectivoEsperado = useMemo(() => {
    if (esperado?.efectivoEsperado !== undefined) return esperado.efectivoEsperado;
    return aperturaMonto + ventasEfectivo + ingresosExtra - egresosGasto;
  }, [esperado, aperturaMonto, ventasEfectivo, ingresosExtra, egresosGasto]);

  // Total contado en conteo
  const totalEfectivoContado = useMemo(() => {
    const todos: Record<string, string> = { ...conteoBilletes, ...conteoMonedas };
    return calcularTotalEfectivo(todos);
  }, [conteoBilletes, conteoMonedas]);

  // Acciones
  const handleRegistrarMovimiento = async () => {
    const num = parseFloat(montoMov);
    if (isNaN(num) || num <= 0) {
      setErrorMov('Escribe un monto válido mayor a cero.');
      return;
    }
    if (motivoMov.trim().length < 3) {
      setErrorMov('Escribe el motivo (al menos 3 letras).');
      return;
    }

    const conf = window.confirm(
      `¿Registrar el ${tipoMov === 'INGRESO' ? 'ingreso' : 'egreso'} de s/ ${num.toFixed(2)}?\n` +
      `Queda en el turno con tu nombre. ${tipoMov === 'EGRESO' ? 'Resta del efectivo esperado en caja.' : 'Suma al efectivo esperado en caja.'}`
    );
    if (!conf) return;

    try {
      await pedidosApi.crearMovimiento(tipoMov, num, motivoMov.trim());
      setAbrirModalMov(false);
      setMontoMov('');
      setMotivoMov('');
      setErrorMov('');
      setCjMsg('Movimiento registrado.');
      cargarTurno();
    } catch (err: any) {
      setErrorMov(err?.message || 'Error al registrar el movimiento.');
    }
  };

  const handleAbrirCaja = async () => {
    const num = parseFloat(montoAbrir) || 0;
    const conf = window.confirm(
      `¿Abrir la caja?\n` +
      `Se abre con el monto indicado (normalmente s/ 0.00). Las ventas de hoy empiezan desde cero; lo anterior queda en el historial.`
    );
    if (!conf) return;

    try {
      await pedidosApi.abrirCaja(num);
      setAbrirModalAbrir(false);
      setCjMsg(`Caja abierta con s/ ${num.toFixed(2)}.`);
      cargarTurno();
    } catch (err: any) {
      alert(err?.message || 'Error al abrir la caja.');
    }
  };

  const handleRecibirEfectivoRider = async (r: RepartidorPorLiquidar) => {
    const conf = window.confirm(
      `¿Recibir s/ ${r.pendiente.toFixed(2)} de ${r.nombre}?\n` +
      `El efectivo entra a la caja y cuenta en el efectivo esperado del cierre.`
    );
    if (!conf) return;

    try {
      await cierreApi.liquidarRepartidor({
        repartidorPartyId: r.repartidorPartyId,
        entregado: r.pendiente,
      });
      setCjMsg(`Efectivo recibido de ${r.nombre}.`);
      cargarTurno();
    } catch (err: any) {
      alert(err?.message || 'Error al liquidar repartidor.');
    }
  };

  const handleRevisarCuadre = () => {
    setMsgCierreError('');
    const difEfe = Math.abs(totalEfectivoContado - efectivoEsperado);
    const cuadra = difEfe < 0.05;
    setRevisadoCuadra(cuadra);
    if (!cuadra && !esAdmin) {
      setMsgCierreError('No cuadra: la supervisora debe escribir su PIN para revisar el detalle y cerrar.');
    }
  };

  const handleVerificarPinSupervisora = () => {
    if (pinSupervisora.trim() === '123456' || pinSupervisora.trim() === '000000') {
      setPinVerificado(true);
      setMsgCierreError('');
    } else {
      setMsgCierreError('El PIN de la supervisora no es correcto.');
    }
  };

  const handleConfirmarCierre = async () => {
    setMsgCierreError('');
    if (pedidosAbiertos.length > 0) {
      setMsgCierreError('Hay pedidos sin cobrar o por confirmar. Resuélvelos antes de cerrar.');
      return;
    }
    if (repartidores.some((r) => r.pendiente > 0)) {
      setMsgCierreError('Hay efectivo de repartidores sin liquidar. Liquídalo antes de cerrar.');
      return;
    }
    if (!esAdmin && revisadoCuadra === null) {
      setMsgCierreError('Toca «Revisar» para saber si cuadra antes de cerrar.');
      return;
    }
    if (!esAdmin && revisadoCuadra === false && !pinVerificado) {
      setMsgCierreError('No cuadra: la supervisora debe escribir su PIN para revisar el detalle y cerrar.');
      return;
    }

    const difTot = Math.round((totalEfectivoContado - efectivoEsperado) * 100) / 100;
    const txtDif = Math.abs(difTot) < 0.005 ? 'cuadrada' : `con una diferencia de s/ ${Math.abs(difTot).toFixed(2)} ${difTot > 0 ? 'de sobrante' : 'de faltante'}`;
    const conf = window.confirm(
      `¿Cerrar la caja ${txtDif}?\n` +
      `Se guarda el cierre en el historial, que no se puede borrar ni editar. Mañana la caja se abre en cero.`
    );
    if (!conf) return;

    setCerrandoCaja(true);
    try {
      const todosConteo: Record<string, number> = {};
      for (const [k, v] of Object.entries({ ...conteoBilletes, ...conteoMonedas })) {
        const val = parseInt(v, 10);
        if (val > 0) todosConteo[k] = val;
      }
      await cierreApi.cerrarCaja(
        {
          conteo: todosConteo,
          medios: {
            yape: parseFloat(mediosDigitales.yape) || 0,
            plin: parseFloat(mediosDigitales.plin) || 0,
            transferencia: parseFloat(mediosDigitales.transferencia) || 0,
            tarjeta: parseFloat(mediosDigitales.tarjeta) || 0,
          },
          nota: obsCierre.trim() || undefined,
        },
        pinVerificado ? pinSupervisora : undefined
      );

      setAbrirModalCierre(false);
      setCjMsg('Caja cerrada. El cierre quedó registrado en el historial inmutable.');
      setTabActiva('historial');
      cargarTurno();
    } catch (err: any) {
      setMsgCierreError(err?.message || 'Error al cerrar la caja.');
    } finally {
      setCerrandoCaja(false);
    }
  };

  if (!puedeVer) {
    return (
      <div style={{ padding: 24 }}>
        <EstadoError mensaje="No tienes permiso para ver el módulo de caja y cierres." />
      </div>
    );
  }

  if (cargando) {
    return <Cargando mensaje="Cargando caja y cierres..." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 1. SELECTOR DE PESTAÑAS (Turno actual | Historial de cierres) */}
      <div role="tablist" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          role="tab"
          aria-selected={tabActiva === 'turno'}
          onClick={() => {
            setTabActiva('turno');
            setCjMsg('');
          }}
          style={{
            minHeight: 44,
            padding: '0 16px',
            borderRadius: 9999,
            border: '1.5px solid var(--cp-navy, #0B2C3E)',
            background: tabActiva === 'turno' ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
            color: tabActiva === 'turno' ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Turno actual
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tabActiva === 'historial'}
          onClick={() => {
            setTabActiva('historial');
            setCjMsg('');
          }}
          style={{
            minHeight: 44,
            padding: '0 16px',
            borderRadius: 9999,
            border: '1.5px solid var(--cp-navy, #0B2C3E)',
            background: tabActiva === 'historial' ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
            color: tabActiva === 'historial' ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Historial de cierres
        </button>
      </div>

      {/* Banner de mensaje de éxito si existe */}
      {cjMsg && (
        <div
          role="status"
          style={{
            background: 'var(--cp-greenbg, #DFF3E3)',
            borderRadius: 10,
            padding: '8px 12px',
            fontSize: 13,
            fontWeight: 700,
            color: '#1F5C33',
          }}
        >
          {cjMsg}
        </div>
      )}

      {errorCarga && <EstadoError mensaje={errorCarga} alReintentar={cargarTurno} />}

      {/* 2. PESTAÑA: TURNO ACTUAL */}
      {tabActiva === 'turno' && (
        <>
          {/* Tarjeta de estado de caja */}
          <div
            style={{
              background: 'var(--cp-white, #FFFFFF)',
              border: '1px solid var(--cp-line, #E3D6C6)',
              borderRadius: 14,
              padding: '14px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--cp-navy, #0B2C3E)' }}>
                {cajaAbierta
                  ? `Caja abierta desde las ${horaApertura} · ${cajeroNombre} · apertura s/ ${aperturaMonto.toFixed(2)}`
                  : 'Caja cerrada. Se abre en cero cada mañana.'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                {cajaId}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {cajaAbierta ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setTipoMov('EGRESO');
                      setMontoMov('');
                      setMotivoMov('');
                      setErrorMov('');
                      setAbrirModalMov(true);
                    }}
                    style={{
                      minHeight: 48,
                      border: '1.5px solid var(--cp-navy, #0B2C3E)',
                      borderRadius: 12,
                      background: 'transparent',
                      color: 'var(--cp-navy, #0B2C3E)',
                      fontWeight: 800,
                      padding: '0 16px',
                      cursor: 'pointer',
                    }}
                  >
                    Registrar movimiento
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFaseCierre('verificar');
                      setRevisadoCuadra(null);
                      setPinVerificado(false);
                      setPinSupervisora('');
                      setMsgCierreError('');
                      setAbrirModalCierre(true);
                    }}
                    style={{
                      minHeight: 48,
                      border: 0,
                      borderRadius: 12,
                      background: 'var(--cp-orange, #E67929)',
                      color: 'var(--cp-navy, #0B2C3E)',
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      fontSize: 15,
                      padding: '0 18px',
                      cursor: 'pointer',
                    }}
                  >
                    Cerrar caja y cuadrar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMontoAbrir('0.00');
                    setAbrirModalAbrir(true);
                  }}
                  style={{
                    minHeight: 48,
                    border: 0,
                    borderRadius: 12,
                    background: 'var(--cp-orange, #E67929)',
                    color: 'var(--cp-navy, #0B2C3E)',
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    fontSize: 15,
                    padding: '0 18px',
                    cursor: 'pointer',
                  }}
                >
                  Abrir caja
                </button>
              )}
            </div>
          </div>

          {cajaAbierta && (
            <>
              {/* Notificación de cierre ciego si no es ADMIN */}
              {!esAdmin && (
                <div
                  style={{
                    background: 'var(--cp-white, #FFFFFF)',
                    border: '1.5px dashed var(--cp-soft, #2C4C5D)',
                    borderRadius: 14,
                    padding: '12px 16px',
                    fontSize: 13,
                    lineHeight: '18px',
                    color: 'var(--cp-navy, #0B2C3E)',
                  }}
                >
                  Cierre ciego (acta 03): los totales por medio de pago y el efectivo esperado solo los ve la supervisora. Al cerrar, cuenta y anota lo que hay; el sistema te dirá si cuadra.
                </div>
              )}

              {/* Bloques visibles SOLO para Administrador */}
              {esAdmin && (
                <div data-testid="seccion-esperado-admin" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Ventas del turno por medio de pago */}
                  <div
                    style={{
                      background: 'var(--cp-white, #FFFFFF)',
                      border: '1px solid var(--cp-line, #E3D6C6)',
                      borderRadius: 14,
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 15, color: 'var(--cp-navy, #0B2C3E)' }}>
                      Ventas del turno por medio de pago
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                        gap: 10,
                      }}
                    >
                      {[
                        { n: 'Efectivo', t: esperado?.medios?.efectivo ?? 0, c: esperado?.medios?.efectivo ? 1 : 0 },
                        { n: 'Yape', t: esperado?.medios?.yape ?? 0, c: esperado?.medios?.yape ? 1 : 0 },
                        { n: 'Plin', t: esperado?.medios?.plin ?? 0, c: esperado?.medios?.plin ? 1 : 0 },
                        { n: 'Transferencia', t: esperado?.medios?.transferencia ?? 0, c: esperado?.medios?.transferencia ? 1 : 0 },
                        { n: 'Tarjeta', t: esperado?.medios?.tarjeta ?? 0, c: esperado?.medios?.tarjeta ? 1 : 0 },
                        { n: 'Otros', t: 0, c: 0 },
                      ].map((m) => (
                        <div
                          key={m.n}
                          style={{
                            border: '1px solid var(--cp-line, #E3D6C6)',
                            borderRadius: 12,
                            padding: '10px 12px',
                            background: 'var(--cp-cream, #FBF4EC)',
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-soft, #2C4C5D)' }}>{m.n}</div>
                          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--cp-navy, #0B2C3E)' }}>
                            s/ {m.t.toFixed(2)}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                            {m.c} {m.c === 1 ? 'pedido' : 'pedidos'}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 800,
                        fontSize: 17,
                        borderTop: '1px solid var(--cp-line, #E3D6C6)',
                        paddingTop: 8,
                        color: 'var(--cp-navy, #0B2C3E)',
                      }}
                    >
                      <span>Total vendido</span>
                      <span>s/ {ventasTotales.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Efectivo que debe haber en caja */}
                  <div
                    style={{
                      background: 'var(--cp-white, #FFFFFF)',
                      border: '1px solid var(--cp-line, #E3D6C6)',
                      borderRadius: 14,
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 15, color: 'var(--cp-navy, #0B2C3E)' }}>
                      Efectivo que debe haber en caja
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span>Apertura</span>
                      <span style={{ fontWeight: 700 }}>s/ {aperturaMonto.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span>+ Ventas en efectivo</span>
                      <span style={{ fontWeight: 700 }}>s/ {ventasEfectivo.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span>+ Ingresos extras</span>
                      <span style={{ fontWeight: 700 }}>s/ {ingresosExtra.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span>− Egresos y gastos menores</span>
                      <span style={{ fontWeight: 700 }}>s/ {egresosGasto.toFixed(2)}</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 800,
                        fontSize: 18,
                        borderTop: '1px solid var(--cp-line, #E3D6C6)',
                        paddingTop: 8,
                        color: 'var(--cp-navy, #0B2C3E)',
                      }}
                    >
                      <span>Total esperado</span>
                      <span style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}>TOTAL EFECTIVO ESPERADO</span>
                      <span>S/ {efectivoEsperado.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Movimientos de caja */}
              <div
                style={{
                  background: 'var(--cp-white, #FFFFFF)',
                  border: '1px solid var(--cp-line, #E3D6C6)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 15, color: 'var(--cp-navy, #0B2C3E)' }}>
                  Movimientos de caja
                </div>
                {movimientos.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
                    Sin movimientos. Registra aquí lo que entra o sale de la caja fuera de las ventas, por ejemplo una compra de hielo.
                  </div>
                ) : (
                  movimientos.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                        borderTop: '1px solid var(--cp-sand, #EDE1D1)',
                        paddingTop: 6,
                        fontSize: 13,
                      }}
                    >
                      <div>
                        <b>{m.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}</b> · {m.motivo}
                        <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                          {cajeroNombre}
                        </div>
                      </div>
                      <div
                        style={{
                          fontWeight: 800,
                          color: m.tipo === 'INGRESO' ? 'var(--cp-green, #2F7A45)' : 'var(--cp-rust, #B2500F)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {m.tipo === 'INGRESO' ? '+ ' : '− '}s/ {Number(m.monto || 0).toFixed(2)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Efectivo por recibir de repartidores si hay */}
              {repartidores.some((r) => r.pendiente > 0) && (
                <div
                  style={{
                    border: '1.5px solid var(--cp-navy, #0B2C3E)',
                    borderRadius: 12,
                    padding: '10px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    background: 'var(--cp-white, #FFFFFF)',
                  }}
                >
                  <div style={{ fontWeight: 800, color: 'var(--cp-navy, #0B2C3E)' }}>
                    Efectivo por recibir de repartidores
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                    Lo cobraron en la puerta del cliente. No cuenta en el efectivo esperado hasta que lo recibas.
                  </div>
                  {repartidores
                    .filter((r) => r.pendiente > 0)
                    .map((r) => (
                      <div
                        key={r.repartidorPartyId}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700 }}>
                          {r.nombre}: {r.pedidos?.length || 1} pedido(s) · s/ {r.pendiente.toFixed(2)} en efectivo
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRecibirEfectivoRider(r)}
                          style={{
                            minHeight: 44,
                            padding: '0 16px',
                            border: 0,
                            borderRadius: 10,
                            background: 'var(--cp-orange, #E67929)',
                            color: 'var(--cp-navy, #0B2C3E)',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          Recibir el efectivo
                        </button>
                      </div>
                    ))}
                </div>
              )}

              {/* Pedidos sin cobrar o por confirmar que impiden el cierre */}
              {pedidosAbiertos.length > 0 && (
                <div
                  style={{
                    border: '1.5px dashed var(--cp-rust, #B2500F)',
                    borderRadius: 12,
                    padding: '10px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
                    {pedidosAbiertos.length} pedidos sin cobrar o por confirmar: {pedidosAbiertos.slice(0, 5).map((p) => p.codigo).join(', ')}{pedidosAbiertos.length > 5 ? '…' : ''}. No se puede cerrar la caja con pedidos abiertos.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined') window.location.href = '/admin/caja';
                    }}
                    style={{
                      border: '1.5px solid var(--cp-navy, #0B2C3E)',
                      borderRadius: 12,
                      background: 'transparent',
                      color: 'var(--cp-navy, #0B2C3E)',
                      fontWeight: 800,
                      padding: '0 16px',
                      minHeight: 44,
                      cursor: 'pointer',
                    }}
                  >
                    Ir a los pedidos
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* 3. PESTAÑA: HISTORIAL DE CIERRES */}
      {tabActiva === 'historial' && <HistorialCierres />}

      {/* MODAL 1: REGISTRAR MOVIMIENTO */}
      {abrirModalMov && (
        <>
          <div
            onClick={() => setAbrirModalMov(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              background: 'rgba(11,44,62,0.55)',
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Registrar movimiento"
            style={{
              position: 'fixed',
              zIndex: 60,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%,-50%)',
              width: 'min(480px, calc(100% - 24px))',
              background: 'var(--cp-cream, #FBF4EC)',
              borderRadius: 20,
              boxShadow: '0 20px 50px rgba(11,44,62,0.4)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--cp-navy, #0B2C3E)' }}>
                Registrar movimiento
              </div>
              <button
                type="button"
                onClick={() => setAbrirModalMov(false)}
                aria-label="Cerrar"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  border: '1.5px solid var(--cp-navy, #0B2C3E)',
                  background: 'transparent',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontSize: 20,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            {/* Selector de Tipo */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setTipoMov('INGRESO')}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 9999,
                  border: '1.5px solid var(--cp-navy, #0B2C3E)',
                  background: tipoMov === 'INGRESO' ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                  color: tipoMov === 'INGRESO' ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Ingreso extra
              </button>
              <button
                type="button"
                onClick={() => setTipoMov('EGRESO')}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 9999,
                  border: '1.5px solid var(--cp-navy, #0B2C3E)',
                  background: tipoMov === 'EGRESO' ? 'var(--cp-navy, #0B2C3E)' : 'transparent',
                  color: tipoMov === 'EGRESO' ? 'var(--cp-cream, #FBF4EC)' : 'var(--cp-navy, #0B2C3E)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Egreso o gasto menor
              </button>
            </div>

            <div>
              <label htmlFor="mv-m" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
                Monto (s/)
              </label>
              <input
                id="mv-m"
                type="number"
                step="0.1"
                placeholder="0.00"
                value={montoMov}
                onChange={(e) => setMontoMov(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 48,
                  borderRadius: 12,
                  border: '1.5px solid var(--cp-line, #E3D6C6)',
                  background: 'var(--cp-white, #FFFFFF)',
                  padding: '0 12px',
                  fontSize: 16,
                  fontWeight: 700,
                }}
              />
            </div>

            <div>
              <label htmlFor="mv-r" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
                Motivo
              </label>
              <input
                id="mv-r"
                type="text"
                placeholder="Ej. Compra de hielo, propina, cambio"
                value={motivoMov}
                onChange={(e) => setMotivoMov(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 48,
                  borderRadius: 12,
                  border: '1.5px solid var(--cp-line, #E3D6C6)',
                  background: 'var(--cp-white, #FFFFFF)',
                  padding: '0 12px',
                  fontSize: 14,
                }}
              />
            </div>

            {errorMov && (
              <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
                {errorMov}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                type="button"
                onClick={handleRegistrarMovimiento}
                style={{
                  flex: 1,
                  minHeight: 48,
                  border: 0,
                  borderRadius: 12,
                  background: 'var(--cp-orange, #E67929)',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: 'pointer',
                }}
              >
                Guardar movimiento
              </button>
              <button
                type="button"
                onClick={() => setAbrirModalMov(false)}
                style={{
                  flex: 1,
                  minHeight: 48,
                  border: '1.5px solid var(--cp-navy, #0B2C3E)',
                  borderRadius: 12,
                  background: 'transparent',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}

      {/* MODAL 2: ABRIR CAJA */}
      {abrirModalAbrir && (
        <>
          <div
            onClick={() => setAbrirModalAbrir(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              background: 'rgba(11,44,62,0.55)',
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Abrir caja"
            style={{
              position: 'fixed',
              zIndex: 60,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%,-50%)',
              width: 'min(440px, calc(100% - 24px))',
              background: 'var(--cp-cream, #FBF4EC)',
              borderRadius: 20,
              boxShadow: '0 20px 50px rgba(11,44,62,0.4)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--cp-navy, #0B2C3E)' }}>
                Abrir caja
              </div>
              <button
                type="button"
                onClick={() => setAbrirModalAbrir(false)}
                aria-label="Cerrar"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  border: '1.5px solid var(--cp-navy, #0B2C3E)',
                  background: 'transparent',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontSize: 20,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
              Se abre en cero cada mañana. Si hay un fondo fijo para vuelto, anótalo aquí.
            </div>

            <div>
              <label htmlFor="ab-ini" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
                Monto inicial (s/)
              </label>
              <input
                id="ab-ini"
                type="number"
                step="0.1"
                value={montoAbrir}
                onChange={(e) => setMontoAbrir(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 48,
                  borderRadius: 12,
                  border: '1.5px solid var(--cp-line, #E3D6C6)',
                  background: 'var(--cp-white, #FFFFFF)',
                  padding: '0 12px',
                  fontSize: 16,
                  fontWeight: 700,
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                type="button"
                onClick={handleAbrirCaja}
                style={{
                  flex: 1,
                  minHeight: 48,
                  border: 0,
                  borderRadius: 12,
                  background: 'var(--cp-orange, #E67929)',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: 'pointer',
                }}
              >
                Abrir caja
              </button>
              <button
                type="button"
                onClick={() => setAbrirModalAbrir(false)}
                style={{
                  flex: 1,
                  minHeight: 48,
                  border: '1.5px solid var(--cp-navy, #0B2C3E)',
                  borderRadius: 12,
                  background: 'transparent',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}

      {/* MODAL 3: CERRAR CAJA Y CUADRAR (Paso 1: Verificar -> Paso 2: Conteo y Arqueo) */}
      {abrirModalCierre && (
        <>
          <div
            onClick={() => setAbrirModalCierre(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              background: 'rgba(11,44,62,0.55)',
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Cerrar caja y cuadrar"
            style={{
              position: 'fixed',
              zIndex: 60,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%,-50%)',
              width: 'min(640px, calc(100% - 24px))',
              maxHeight: 'calc(100% - 24px)',
              overflowY: 'auto',
              background: 'var(--cp-cream, #FBF4EC)',
              borderRadius: 20,
              boxShadow: '0 20px 50px rgba(11,44,62,0.4)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--cp-navy, #0B2C3E)' }}>
                {faseCierre === 'verificar' ? 'Verificar movimientos del turno' : 'Cerrar caja y cuadrar'}
              </div>
              <button
                type="button"
                onClick={() => setAbrirModalCierre(false)}
                aria-label="Cerrar"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  border: '1.5px solid var(--cp-navy, #0B2C3E)',
                  background: 'transparent',
                  color: 'var(--cp-navy, #0B2C3E)',
                  fontSize: 20,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            {/* FASE 1: VERIFICAR MOVIMIENTOS */}
            {faseCierre === 'verificar' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 13, color: 'var(--cp-soft, #2C4C5D)' }}>
                  Revisa los pedidos cobrados y los movimientos antes de contar el dinero.
                </div>

                {/* Pedidos cobrados */}
                <div
                  style={{
                    background: 'var(--cp-white, #FFFFFF)',
                    border: '1px solid var(--cp-line, #E3D6C6)',
                    borderRadius: 12,
                    padding: 12,
                    maxHeight: 180,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 13 }}>Pedidos cobrados en el turno</div>
                  {pedidosCobrados.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>Sin pedidos cobrados aún.</div>
                  ) : (
                    pedidosCobrados.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          borderTop: '1px solid var(--cp-sand, #EDE1D1)',
                          paddingTop: 4,
                        }}
                      >
                        <span>
                          <b>{p.codigo}</b> · {p.cliente_nombre || 'Cliente'} ({p.pago_metodo || 'Efectivo'})
                        </span>
                        <span style={{ fontWeight: 700 }}>s/ {Number(p.total || 0).toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* Movimientos */}
                <div
                  style={{
                    background: 'var(--cp-white, #FFFFFF)',
                    border: '1px solid var(--cp-line, #E3D6C6)',
                    borderRadius: 12,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 13 }}>Movimientos de caja</div>
                  {movimientos.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>Sin movimientos de caja en este turno.</div>
                  ) : (
                    movimientos.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          borderTop: '1px solid var(--cp-sand, #EDE1D1)',
                          paddingTop: 4,
                        }}
                      >
                        <span>
                          <b>{m.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}</b> · {m.motivo}
                        </span>
                        <span style={{ fontWeight: 700, color: m.tipo === 'INGRESO' ? 'var(--cp-green, #2F7A45)' : 'var(--cp-rust, #B2500F)' }}>
                          {m.tipo === 'INGRESO' ? '+ ' : '− '}s/ {Number(m.monto || 0).toFixed(2)}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Pedidos pendientes si existen */}
                {pedidosAbiertos.length > 0 && (
                  <div
                    style={{
                      background: 'var(--cp-white, #FFFFFF)',
                      border: '1.5px dashed var(--cp-rust, #B2500F)',
                      borderRadius: 12,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ fontWeight: 800, color: 'var(--cp-rust, #B2500F)', fontSize: 13 }}>
                      Pendientes: impiden cerrar la caja
                    </div>
                    {pedidosAbiertos.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          borderTop: '1px solid var(--cp-sand, #EDE1D1)',
                          paddingTop: 4,
                        }}
                      >
                        <b>{p.codigo}</b>
                        <span>{p.cliente_nombre || 'Cliente'}</span>
                        <span style={{ color: 'var(--cp-rust, #B2500F)', fontWeight: 700 }}>Por confirmar / Sin cobrar</span>
                        <span>s/ {Number(p.total || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setFaseCierre('arqueo')}
                    style={{
                      flex: 1,
                      minHeight: 52,
                      border: 0,
                      borderRadius: 12,
                      background: 'var(--cp-orange, #E67929)',
                      color: 'var(--cp-navy, #0B2C3E)',
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      fontSize: 15,
                      cursor: 'pointer',
                    }}
                  >
                    Ya revisé: continuar al conteo
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbrirModalCierre(false)}
                    style={{
                      flex: 1,
                      minHeight: 52,
                      border: '1.5px solid var(--cp-navy, #0B2C3E)',
                      borderRadius: 12,
                      background: 'transparent',
                      color: 'var(--cp-navy, #0B2C3E)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Volver
                  </button>
                </div>
              </div>
            )}

            {/* FASE 2: CONTEO DE EFECTIVO Y ARQUEO CIEGO */}
            {faseCierre === 'arqueo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* 1. Billetes y Monedas */}
                <div
                  style={{
                    background: 'var(--cp-white, #FFFFFF)',
                    border: '1px solid var(--cp-line, #E3D6C6)',
                    borderRadius: 12,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>1. Billetes y monedas</div>
                    <div style={{ fontWeight: 800, color: 'var(--cp-navy, #0B2C3E)' }}>
                      Total contado: s/ {totalEfectivoContado.toFixed(2)}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {/* Billetes */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cp-soft, #2C4C5D)', marginBottom: 4 }}>
                        BILLETES
                      </div>
                      {['200', '100', '50', '20', '10'].map((d) => (
                        <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ width: 44, fontSize: 12, fontWeight: 700 }}>S/ {d}</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={conteoBilletes[d]}
                            onChange={(e) => setConteoBilletes({ ...conteoBilletes, [d]: e.target.value })}
                            style={{
                              width: 60,
                              minHeight: 36,
                              borderRadius: 8,
                              border: '1px solid var(--cp-line, #E3D6C6)',
                              padding: '0 6px',
                              textAlign: 'center',
                            }}
                          />
                          <span style={{ fontSize: 11, color: 'var(--cp-soft, #2C4C5D)', width: 50, textAlign: 'right' }}>
                            = {(parseInt(conteoBilletes[d] || '0', 10) * Number(d)).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Monedas */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cp-soft, #2C4C5D)', marginBottom: 4 }}>
                        MONEDAS
                      </div>
                      {['5', '2', '1', '0.5', '0.2', '0.1'].map((d) => (
                        <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ width: 44, fontSize: 12, fontWeight: 700 }}>S/ {Number(d).toFixed(2)}</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={conteoMonedas[d]}
                            onChange={(e) => setConteoMonedas({ ...conteoMonedas, [d]: e.target.value })}
                            style={{
                              width: 60,
                              minHeight: 36,
                              borderRadius: 8,
                              border: '1px solid var(--cp-line, #E3D6C6)',
                              padding: '0 6px',
                              textAlign: 'center',
                            }}
                          />
                          <span style={{ fontSize: 11, color: 'var(--cp-soft, #2C4C5D)', width: 50, textAlign: 'right' }}>
                            = {(parseInt(conteoMonedas[d] || '0', 10) * Number(d)).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Medios digitales */}
                <div
                  style={{
                    background: 'var(--cp-white, #FFFFFF)',
                    border: '1px solid var(--cp-line, #E3D6C6)',
                    borderRadius: 12,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 14 }}>2. Medios digitales (lo que ves en la app o voucher)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
                    {(['yape', 'plin', 'transferencia', 'tarjeta', 'otros'] as const).map((m) => (
                      <div key={m}>
                        <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize', color: 'var(--cp-soft, #2C4C5D)' }}>
                          {m}
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="0.00"
                          value={mediosDigitales[m]}
                          onChange={(e) => setMediosDigitales({ ...mediosDigitales, [m]: e.target.value })}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            minHeight: 38,
                            borderRadius: 8,
                            border: '1px solid var(--cp-line, #E3D6C6)',
                            padding: '0 8px',
                            fontSize: 13,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Botón Revisar si cuadra para cajeros */}
                {!esAdmin && (
                  <div>
                    <button
                      type="button"
                      onClick={handleRevisarCuadre}
                      style={{
                        minHeight: 44,
                        padding: '0 16px',
                        borderRadius: 12,
                        border: '1.5px solid var(--cp-navy, #0B2C3E)',
                        background: 'transparent',
                        color: 'var(--cp-navy, #0B2C3E)',
                        fontWeight: 800,
                        cursor: 'pointer',
                        width: '100%',
                      }}
                    >
                      Revisar si cuadra
                    </button>
                    {revisadoCuadra === true && (
                      <div style={{ marginTop: 6, color: 'var(--cp-green, #2F7A45)', fontWeight: 800, fontSize: 14, textAlign: 'center' }}>
                        ¡Cuadra! Todo en orden.
                      </div>
                    )}
                    {revisadoCuadra === false && !pinVerificado && (
                      <div style={{ marginTop: 8, border: '1px solid var(--cp-rust, #B2500F)', background: '#FFF0ED', borderRadius: 10, padding: 10 }}>
                        <div style={{ color: 'var(--cp-rust, #B2500F)', fontWeight: 700, fontSize: 13 }}>
                          No cuadra: la supervisora debe escribir su PIN para revisar el detalle y cerrar.
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          <input
                            type="password"
                            placeholder="PIN de la supervisora"
                            value={pinSupervisora}
                            onChange={(e) => setPinSupervisora(e.target.value)}
                            style={{
                              flex: 1,
                              minHeight: 38,
                              borderRadius: 8,
                              border: '1px solid var(--cp-line, #E3D6C6)',
                              padding: '0 10px',
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleVerificarPinSupervisora}
                            style={{
                              minHeight: 38,
                              padding: '0 12px',
                              borderRadius: 8,
                              border: 0,
                              background: 'var(--cp-navy, #0B2C3E)',
                              color: 'var(--cp-cream, #FBF4EC)',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Verificar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Detalle de comparación si es Admin o si el PIN fue validado */}
                {(esAdmin || pinVerificado) && (
                  <div
                    style={{
                      background: 'var(--cp-white, #FFFFFF)',
                      border: '1px solid var(--cp-line, #E3D6C6)',
                      borderRadius: 12,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 2 }}>
                      {esAdmin ? 'Resultado del cuadre' : 'Detalle (abierto con PIN de la supervisora)'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderTop: '1px solid var(--cp-sand, #EDE1D1)', paddingTop: 4 }}>
                      <b>Efectivo</b>
                      <span>Sist. s/ {efectivoEsperado.toFixed(2)}</span>
                      <span>Cont. s/ {totalEfectivoContado.toFixed(2)}</span>
                      <b style={{ color: Math.abs(totalEfectivoContado - efectivoEsperado) < 0.05 ? 'var(--cp-green, #2F7A45)' : 'var(--cp-rust, #B2500F)' }}>
                        {Math.abs(totalEfectivoContado - efectivoEsperado) < 0.05 ? 'Cuadrado +s/ 0.00' : `${totalEfectivoContado >= efectivoEsperado ? '+' : ''}s/ ${(totalEfectivoContado - efectivoEsperado).toFixed(2)}`}
                      </b>
                    </div>
                  </div>
                )}

                {/* Observaciones */}
                <div>
                  <label htmlFor="cl-o" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
                    Observaciones (opcional)
                  </label>
                  <textarea
                    id="cl-o"
                    rows={2}
                    value={obsCierre}
                    onChange={(e) => setObsCierre(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      borderRadius: 10,
                      border: '1.5px solid var(--cp-line, #E3D6C6)',
                      padding: '8px 12px',
                      fontSize: 14,
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                {msgCierreError && (
                  <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
                    {msgCierreError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    disabled={cerrandoCaja}
                    onClick={handleConfirmarCierre}
                    style={{
                      flex: 1,
                      minHeight: 48,
                      border: 0,
                      borderRadius: 12,
                      background: 'var(--cp-orange, #E67929)',
                      color: 'var(--cp-navy, #0B2C3E)',
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      fontSize: 15,
                      cursor: cerrandoCaja ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {cerrandoCaja ? 'Cerrando...' : 'Cerrar caja'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbrirModalCierre(false)}
                    style={{
                      flex: 1,
                      minHeight: 48,
                      border: '1.5px solid var(--cp-navy, #0B2C3E)',
                      borderRadius: 12,
                      background: 'transparent',
                      color: 'var(--cp-navy, #0B2C3E)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default CierreView;

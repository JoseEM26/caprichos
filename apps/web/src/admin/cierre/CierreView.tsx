import { useState, useEffect, useCallback, useMemo } from 'react';
import { useConfirmarAsync } from '../../comun/useConfirmarAsync';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { HistorialCierres } from './HistorialCierres';
import {
  cierreApi,
  AjusteMedio,
  ClaveDigital,
  DevolucionTurno,
  DigitalesCaja,
  MedioAjustable,
  PendienteCobro,
  RepartidorPorLiquidar,
} from './cierreApi';
import { DialogoCorregirMedio, ETIQUETA_MEDIO } from './CorreccionesMedios';
import { CuadreCaja, type CierrePayload } from './CuadreCaja';
import { PendientesCobroCierre } from './PendientesCobroCierre';
import { VentasTurno } from './VentasTurno';
import { pedidosApi, MovimientoCaja, CobroTurno } from '../pedidos/pedidosApi';
import { ErrorApi } from '../../comun/api';
import { SeccionVouchersCierre } from '../vouchers/SeccionVouchersCierre';
import { BannerCajaCerrada } from '../pedidos/BannerCajaCerrada';
import { tieneRolUsuario } from '../../comun/rolesUsuario';

type TabCierre = 'turno' | 'historial';

// Monto en soles: solo dígitos y un punto, máximo dos decimales (sin negativos ni letras)
const limpiarMonto = (v: string) => v.replace(/[^\d.]/g, '').replace(/^(\d*\.?\d{0,2}).*$/, '$1');


// Hoy en Lima como AAAA-MM-DD, para comparar con la fecha de la caja
const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

export function CierreView() {
  const { usuario, tiene } = useSesion();
  const { confirmar, dialogo } = useConfirmarAsync();
  const puedeVer = tiene('caja/ver') || tiene('caja/cerrar') || usuario?.rol === 'ADMIN' || tieneRolUsuario(usuario, 'CAJERO');
  const esAdmin = usuario?.rol === 'ADMIN';

  const [tabActiva, setTabActiva] = useState<TabCierre>('turno');

  // Estados de datos
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [cajaAbierta, setCajaAbierta] = useState(false);
  // Caja de un día anterior que nunca se cerró (no es la de hoy)
  const [cajaPendiente, setCajaPendiente] = useState<{ fecha: string } | null>(null);
  const [cajaId, setCajaId] = useState('');
  const cajeroNombre = usuario?.nombres ? `${usuario.nombres} (${usuario.rol?.toLowerCase() || 'cajero'})` : 'Cajera de turno';
  const [aperturaMonto, setAperturaMonto] = useState(0);

  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [esperado, setEsperado] = useState<any>(null);
  const [repartidores, setRepartidores] = useState<RepartidorPorLiquidar[]>([]);
  const [pedidosAbiertos, setPedidosAbiertos] = useState<PendienteCobro[]>([]);
  const [errorPendientes, setErrorPendientes] = useState(false);
  const [pedidosCobrados, setPedidosCobrados] = useState<CobroTurno[]>([]);
  // Fecha (AAAA-MM-DD) de la caja que se cierra: la abierta, sea de hoy o de un día anterior
  const [fechaTurno, setFechaTurno] = useState(hoyLima());

  // Mensaje de éxito/notificación y error de la pantalla
  const [cjMsg, setCjMsg] = useState('');
  const [cjError, setCjError] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Modales
  const [abrirModalMov, setAbrirModalMov] = useState(false);
  const [abrirModalAbrir, setAbrirModalAbrir] = useState(false);
  const [abrirModalCierre, setAbrirModalCierre] = useState(false);

  // Estados modal movimiento
  const [tipoMov, setTipoMov] = useState<'INGRESO' | 'EGRESO'>('EGRESO');
  const [montoMov, setMontoMov] = useState('');
  const [motivoMov, setMotivoMov] = useState('');
  const [errorMov, setErrorMov] = useState('');
  const [movAnular, setMovAnular] = useState<{ id: string; motivo: string } | null>(null);

  // Estados modal abrir
  const [montoAbrir, setMontoAbrir] = useState('0.00');
  const [errorAbrir, setErrorAbrir] = useState('');

  // Panel «Cuadre de caja» (una pantalla; reemplaza al modal por pasos)
  // Medios digitales: los calcula el sistema (vouchers aprobados). El cajero no los teclea;
  // solo los corrige por excepción, con motivo y autorización (ver DialogoCorregirMedio).
  const [digitales, setDigitales] = useState<DigitalesCaja | null>(null);
  const [ajustesMedio, setAjustesMedio] = useState<AjusteMedio[]>([]);
  const [devolucionesTurno, setDevolucionesTurno] = useState<DevolucionTurno[]>([]);
  const [correccion, setCorreccion] = useState<{ medio: MedioAjustable; clave: ClaveDigital } | null>(null);
  const [msgCierreError, setMsgCierreError] = useState('');
  const [cerrandoCaja, setCerrandoCaja] = useState(false);

  // Montos digitales del sistema y sus correcciones de la caja abierta
  const cargarDigitales = useCallback(async () => {
    try {
      const [d, a, dev] = await Promise.all([
        cierreApi.obtenerDigitales(),
        cierreApi.listarAjustesMedio(),
        cierreApi.listarDevolucionesTurno().catch(() => [] as DevolucionTurno[]),
      ]);
      setDigitales(d);
      setAjustesMedio(a);
      setDevolucionesTurno(dev);
    } catch {
      setDigitales(null);
      setAjustesMedio([]);
    }
  }, []);

  // Cargar datos del turno
  const cargarTurno = useCallback(async () => {
    setErrorCarga('');
    try {
      // 1. Caja actual
      try {
        const cActual = await pedidosApi.obtenerCajaActual();
        if (cActual) {
          setCajaAbierta(cActual.abierta || cActual.caja?.estado === 'ABIERTA');
          // Una caja de otro día sin cerrar también la ve el cajero: no debe leerse como «Caja cerrada»
          setCajaPendiente(cActual.cajaAnteriorAbierta ?? null);
          setFechaTurno(cActual.cajaAnteriorAbierta?.fecha ?? hoyLima());
          setPedidosCobrados(cActual.cobrados ?? []);
          if (cActual.caja) {
            setCajaId(`CJ-${String(cActual.caja.id).padStart(4, '0')}`);
            setAperturaMonto(Number(cActual.caja.apertura || 0));
          }
        }
      } catch {
        // En mock mode puede fallar
      }

      // 2. Esperado: lo ve quien cierra la caja (el conteo a ciegas ya no se usa).
      // Con él llegan también los cobros y movimientos de la MISMA caja abierta (sea de hoy o no).
      let turnoDeCaja = false;
      {
        try {
          const esp = await cierreApi.obtenerEsperado();
          if (esp) {
            setEsperado(esp);
            if (esp.cajaId) {
              turnoDeCaja = true;
              // La fecha de la caja es un día (UTC medianoche): se compara con el día de Lima
              const fechaCaja = String(esp.fecha).slice(0, 10);
              setFechaTurno(fechaCaja);
              setPedidosCobrados(esp.cobrados ?? []);
              setMovimientos(esp.movimientos ?? []);
              if (fechaCaja === hoyLima()) {
                setCajaAbierta(true);
                setCajaId(`CJ-${String(esp.cajaId).padStart(4, '0')}`);
                setAperturaMonto(esp.apertura || 0);
                setCajaPendiente(null);
              } else {
                setCajaPendiente({ fecha: fechaCaja });
              }
            }
          }
        } catch {
          //
        }
      }

      // 3. Movimientos de hoy (sin caja abierta de por medio: si no, salen los de la caja de arriba)
      if (!turnoDeCaja) {
        try {
          const movs = await pedidosApi.listarMovimientos();
          setMovimientos(movs || []);
        } catch {
          setMovimientos([]);
        }
      }

      // 4. Repartidores
      try {
        const reps = await cierreApi.listarRepartidoresPorLiquidar();
        setRepartidores(reps || []);
      } catch {
        setRepartidores([]);
      }

      // 4b. Medios digitales calculados por el sistema (sin efectivo ni esperado)
      await cargarDigitales();

      // 5. Pedidos sin cobrar de cualquier día (los que bloquean el cierre)
      try {
        setPedidosAbiertos(await cierreApi.listarPendientesDeCobro());
        setErrorPendientes(false);
      } catch {
        setPedidosAbiertos([]);
        setErrorPendientes(true);
      }
    } catch (err: any) {
      setErrorCarga(err?.message || 'Error al cargar los datos de caja y cierre');
    } finally {
      setCargando(false);
    }
  }, [cargarDigitales]);

  useEffect(() => {
    cargarTurno();
  }, [cargarTurno]);

  // Ventas por medio: el efectivo es lo vendido en efectivo, no el esperado en caja
  const ventasEfectivo = esperado?.desglose?.ventasEfectivo ?? 0;
  // Propinas del día (van aparte de la venta). Los medios digitales del servidor ya las incluyen (es lo que entró a
  // Yape, Plin, etc.), así que el total vendido las resta; el efectivo esperado sí las suma (están en la caja).
  const propinasEfectivo = esperado?.desglose?.propinas?.efectivo ?? 0;
  const propinasDigital = esperado?.desglose?.propinas?.digital ?? 0;
  const propinasTotal = Math.round((propinasEfectivo + propinasDigital) * 100) / 100;
  const ventasTotales = useMemo(() => {
    if (esperado) {
      const { yape = 0, plin = 0, transferencia = 0, tarjeta = 0 } = esperado.medios || {};
      return Math.round((ventasEfectivo + yape + plin + transferencia + tarjeta - propinasDigital) * 100) / 100;
    }
    return pedidosCobrados.reduce((acc, p) => acc + p.total, 0);
  }, [esperado, pedidosCobrados, ventasEfectivo, propinasDigital]);

  // Pedidos cobrados por medio (solo para el número de pedidos de cada tarjeta)
  // Cuenta los pedidos que tienen un pago en ese medio (un pedido mixto cuenta en cada medio)
  const pedidosPorMedio = (medio: string) => pedidosCobrados.filter((p) => p.medios.includes(medio)).length;

  const movimientosVigentes = useMemo(() => movimientos.filter((m) => !m.anulado_en), [movimientos]);

  const ingresosExtra = useMemo(() => {
    if (esperado?.desglose?.ingresos !== undefined) return esperado.desglose.ingresos;
    return movimientosVigentes.filter((m) => m.tipo === 'INGRESO').reduce((acc, m) => acc + Number(m.monto || 0), 0);
  }, [esperado, movimientosVigentes]);

  const egresosGasto = useMemo(() => {
    if (esperado?.desglose?.egresos !== undefined) return esperado.desglose.egresos;
    return movimientosVigentes.filter((m) => m.tipo === 'EGRESO').reduce((acc, m) => acc + Number(m.monto || 0), 0);
  }, [esperado, movimientosVigentes]);

  const efectivoEsperado = useMemo(() => {
    if (esperado?.efectivoEsperado !== undefined) return esperado.efectivoEsperado;
    return aperturaMonto + ventasEfectivo + propinasEfectivo + ingresosExtra - egresosGasto;
  }, [esperado, aperturaMonto, ventasEfectivo, propinasEfectivo, ingresosExtra, egresosGasto]);

  // Tras corregir un monto, el panel recalcula la diferencia con el sistema nuevo
  const alCorregirMedio = async (ajuste: AjusteMedio) => {
    setCorreccion(null);
    setMsgCierreError('');
    setCjMsg(`Corrección guardada: ${ETIQUETA_MEDIO[ajuste.medio] ?? ajuste.medio} ahora vale s/ ${ajuste.montoNuevo.toFixed(2)}.`);
    await cargarDigitales();
  };

  const errorDeServidor = (err: unknown, respaldo: string) => (err instanceof ErrorApi ? err.message : respaldo);

  const abrirCierre = () => {
    setMsgCierreError('');
    setAbrirModalCierre(true);
  };

  // Acciones
  const handleRegistrarMovimiento = async () => {
    if (guardando) return;
    const num = Number(limpiarMonto(montoMov));
    if (!montoMov || isNaN(num) || num <= 0) {
      setErrorMov('Escribe un monto válido mayor a cero.');
      return;
    }
    if (motivoMov.trim().length < 3) {
      setErrorMov('Escribe el motivo (al menos 3 letras).');
      return;
    }

    const conf = await confirmar({
      titulo: `¿Registrar el ${tipoMov === 'INGRESO' ? 'ingreso' : 'egreso'} de s/ ${num.toFixed(2)}?`,
      mensaje: `Queda en el turno con tu nombre. ${tipoMov === 'EGRESO' ? 'Resta del efectivo esperado en caja.' : 'Suma al efectivo esperado en caja.'}`,
    });
    if (!conf) return;

    setGuardando(true);
    try {
      await pedidosApi.crearMovimiento(tipoMov, num, motivoMov.trim());
      setAbrirModalMov(false);
      setMontoMov('');
      setMotivoMov('');
      setErrorMov('');
      setCjMsg('Movimiento registrado.');
      cargarTurno();
    } catch (err: any) {
      setErrorMov(errorDeServidor(err, 'Error al registrar el movimiento.'));
    } finally {
      setGuardando(false);
    }
  };

  const handleAnularMovimiento = async () => {
    if (!movAnular || guardando) return;
    if (movAnular.motivo.trim().length < 3) {
      setCjError('Escribe el motivo de la anulación (al menos 3 letras).');
      return;
    }
    const conf = await confirmar({
      titulo: '¿Anular este movimiento?',
      mensaje: 'Deja de contar en el efectivo esperado. Queda en el historial con el motivo.',
    });
    if (!conf) return;

    setGuardando(true);
    try {
      await pedidosApi.anularMovimiento(movAnular.id, movAnular.motivo.trim());
      setMovAnular(null);
      setCjError('');
      setCjMsg('Movimiento anulado.');
      cargarTurno();
    } catch (err: any) {
      setCjError(errorDeServidor(err, 'No se pudo anular el movimiento.'));
    } finally {
      setGuardando(false);
    }
  };

  const handleAbrirCaja = async () => {
    if (guardando) return;
    const num = Number(limpiarMonto(montoAbrir));
    if (montoAbrir === '' || isNaN(num) || num < 0) {
      setErrorAbrir('Escribe un monto válido, cero o mayor.');
      return;
    }
    const conf = await confirmar({
      titulo: `¿Abrir la caja?`,
      mensaje: `Se abre con el monto indicado (normalmente s/ 0.00). Las ventas de hoy empiezan desde cero; lo anterior queda en el historial.`,
    });
    if (!conf) return;

    setGuardando(true);
    try {
      await pedidosApi.abrirCaja(num);
      setAbrirModalAbrir(false);
      setErrorAbrir('');
      setCjMsg(`Caja abierta con s/ ${num.toFixed(2)}.`);
      cargarTurno();
    } catch (err: any) {
      setErrorAbrir(errorDeServidor(err, 'Error al abrir la caja.'));
    } finally {
      setGuardando(false);
    }
  };

  const handleRecibirEfectivoRider = async (r: RepartidorPorLiquidar) => {
    if (guardando) return;
    const conf = await confirmar({
      titulo: `¿Recibir s/ ${r.pendiente.toFixed(2)} de ${r.nombre}?`,
      mensaje: `El efectivo entra a la caja y cuenta en el efectivo esperado del cierre.`,
    });
    if (!conf) return;

    setGuardando(true);
    try {
      await cierreApi.liquidarRepartidor({
        repartidorPartyId: r.repartidorPartyId,
        entregado: r.pendiente,
      });
      setCjError('');
      setCjMsg(`Efectivo recibido de ${r.nombre}.`);
      cargarTurno();
    } catch (err: any) {
      setCjError(errorDeServidor(err, 'Error al liquidar repartidor.'));
    } finally {
      setGuardando(false);
    }
  };

  // Cierra la caja con lo que trae el panel. Nunca se bloquea por diferencia; sí por pendientes (el servidor lo vuelve a validar).
  const handleCerrarCaja = async (p: CierrePayload): Promise<boolean> => {
    if (guardando || cerrandoCaja) return false;
    setMsgCierreError('');
    setCerrandoCaja(true);
    try {
      const res = await cierreApi.cerrarCaja(p);
      setAbrirModalCierre(false);
      const dif = res.diferenciaTotal ?? 0;
      const txt = dif > 0 ? `+S/ ${dif.toFixed(2)}` : `−S/ ${Math.abs(dif).toFixed(2)}`;
      setCjMsg(
        Math.abs(dif) < 0.005
          ? 'Caja cerrada. El cierre quedó registrado en el historial inmutable.'
          : `Caja cerrada con una diferencia de ${txt}. Quedó registrada en el historial inmutable.`,
      );
      if (esAdmin) setTabActiva('historial');
      cargarTurno();
      return true;
    } catch (err: any) {
      setMsgCierreError(errorDeServidor(err, 'Error al cerrar la caja.'));
      return false;
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

  // Si el esperado no cargó no se deja la pantalla muerta: se dice y se puede reintentar
  if (abrirModalCierre && !esperado) {
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <EstadoError mensaje="No se pudo cargar lo que debería haber en caja. Revisa tu conexión e inténtalo otra vez." />
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="cc-btn cc-sec" style={{ minHeight: 44 }} onClick={() => cargarTurno()}>Reintentar</button>
          <button type="button" className="cc-btn cc-sec" style={{ minHeight: 44 }} onClick={() => setAbrirModalCierre(false)}>Volver</button>
        </div>
      </div>
    );
  }

  // Cerrar caja: una sola pantalla «Cuadre de caja» (resumen, conteo, medios digitales y cierre)
  if (abrirModalCierre && esperado) {
    return (
      <div>
        {dialogo}
        {cjMsg && (
          <div role="status" style={{ margin: '8px 12px', padding: '10px 14px', borderRadius: 10, background: '#E8F3EC', color: '#1D5430', border: '1px solid #2F7A45', fontWeight: 700, fontSize: 14 }}>
            {cjMsg}
          </div>
        )}
        <CuadreCaja
          esperado={esperado}
          fecha={fechaTurno}
          diaAnterior={fechaTurno < hoyLima()}
          cajero={cajeroNombre}
          pendientesCount={pedidosAbiertos.length}
          pendientesPanel={
            <PendientesCobroCierre
              pendientes={pedidosAbiertos}
              setPendientes={setPedidosAbiertos}
              alCambiarTurno={cargarTurno}
              errorLista={errorPendientes}
              alReintentar={cargarTurno}
              fechaCaja={fechaTurno}
            />
          }
          repartidores={repartidores}
          onRecibirRepartidor={handleRecibirEfectivoRider}
          ajustesMedio={ajustesMedio}
          devoluciones={devolucionesTurno}
          onCorregir={(medio, clave) => setCorreccion({ medio, clave })}
          cerrando={cerrandoCaja}
          error={msgCierreError}
          onCerrar={handleCerrarCaja}
          onVolver={() => setAbrirModalCierre(false)}
        />
        {correccion && digitales && (
          <DialogoCorregirMedio
            medio={correccion.medio}
            montoSistema={digitales.medios[correccion.clave].sistema}
            montoActual={digitales.medios[correccion.clave].monto}
            alCerrar={() => setCorreccion(null)}
            alGuardado={alCorregirMedio}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <BannerCajaCerrada />
      {dialogo}
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
        {esAdmin && (
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
        )}
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

      {cjError && (
        <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
          {cjError}
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
                  ? `Caja abierta · ${cajeroNombre} · apertura s/ ${aperturaMonto.toFixed(2)}`
                  : cajaPendiente
                  ? `La caja del ${cajaPendiente.fecha.split('-').reverse().join('/')} sigue abierta. Ciérrala antes de abrir la de hoy.`
                  : 'Caja cerrada. Se abre en cero cada mañana.'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                {cajaId}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {cajaAbierta ? (
                <>
                  {tiene('caja/movimientos') && (
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
                  )}
                  {tiene('caja/cerrar') && (
                  <button
                    type="button"
                    onClick={abrirCierre}
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
                  )}
                </>
              ) : (
                <>
                  {/* Una caja de un día anterior sigue abierta: se cierra antes de abrir la de hoy */}
                  {cajaPendiente && tiene('caja/cerrar') && (
                    <button
                      type="button"
                      onClick={abrirCierre}
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
                  )}
                  {!cajaPendiente && tiene('caja/abrir') && (
                    <button
                      type="button"
                      onClick={() => {
                        setMontoAbrir('0.00');
                        setErrorAbrir('');
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
                </>
              )}
            </div>
          </div>

          {cajaAbierta && (
            <>
              {/* Esperado del turno: lo ve quien cierra la caja */}
              {esperado && (
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
                        { n: 'Efectivo', t: ventasEfectivo, c: pedidosPorMedio('EFECTIVO') },
                        { n: 'Yape', t: esperado?.medios?.yape ?? 0, c: pedidosPorMedio('YAPE') },
                        { n: 'Plin', t: esperado?.medios?.plin ?? 0, c: pedidosPorMedio('PLIN') },
                        { n: 'Transferencia', t: esperado?.medios?.transferencia ?? 0, c: pedidosPorMedio('TRANSFERENCIA') },
                        { n: 'Tarjeta', t: esperado?.medios?.tarjeta ?? 0, c: pedidosPorMedio('TARJETA') },
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
                    {propinasDigital > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                        Yape, Plin, transferencia y tarjeta incluyen S/ {propinasDigital.toFixed(2)} de propinas digitales; no son venta y no se suman al total vendido.
                      </div>
                    )}
                  </div>

                  {/* Propinas del día: aparte de la venta (no es ingreso ni sale en comprobantes) */}
                  <div
                    data-testid="cierre-propinas-dia"
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 15, color: 'var(--cp-navy, #0B2C3E)' }}>
                        Propinas del día
                      </span>
                      <span data-testid="cierre-propinas-total" style={{ fontWeight: 800, fontSize: 16, color: 'var(--cp-navy, #0B2C3E)' }}>
                        s/ {propinasTotal.toFixed(2)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>En efectivo (ya suma en el efectivo esperado)</span>
                      <span data-testid="cierre-propinas-efectivo">s/ {propinasEfectivo.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>Digital (ya está en Yape, Plin, transferencia o tarjeta)</span>
                      <span data-testid="cierre-propinas-digital">s/ {propinasDigital.toFixed(2)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--cp-soft, #2C4C5D)' }}>
                      Son del equipo: no son ingreso ni venta, no salen en los comprobantes y no descuadran el cierre. Las devoluciones
                      del día ya están descontadas.
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
                    <div data-testid="esperado-propinas-efectivo" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span>+ Propinas en efectivo (van aparte de la venta)</span>
                      <span style={{ fontWeight: 700 }}>s/ {propinasEfectivo.toFixed(2)}</span>
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
                      <span>S/ {efectivoEsperado.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Ventas del turno: una fila por venta cobrada, en tabla o tarjetas (solo muestra, no calcula) */}
              {esperado && <VentasTurno cobrados={pedidosCobrados} ventas={esperado.ventas} fecha={fechaTurno} />}

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
                        flexDirection: 'column',
                        gap: 6,
                        borderTop: '1px solid var(--cp-sand, #EDE1D1)',
                        paddingTop: 6,
                        fontSize: 13,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div>
                          <b>{m.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}</b> · {m.motivo}
                          {m.anulado_en && (
                            <div style={{ fontSize: 12, color: 'var(--cp-rust, #B2500F)', fontWeight: 700 }}>
                              Anulado{m.motivo_anulacion ? `: ${m.motivo_anulacion}` : ''}
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            fontWeight: 800,
                            color: m.anulado_en
                              ? 'var(--cp-soft, #2C4C5D)'
                              : m.tipo === 'INGRESO'
                              ? 'var(--cp-green, #2F7A45)'
                              : 'var(--cp-rust, #B2500F)',
                            textDecoration: m.anulado_en ? 'line-through' : 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {m.tipo === 'INGRESO' ? '+ ' : '− '}s/ {Number(m.monto || 0).toFixed(2)}
                        </div>
                      </div>
                      {!m.anulado_en && tiene('caja/movimientos') &&
                        (movAnular?.id === m.id ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <input
                              aria-label="Motivo de la anulación"
                              placeholder="Motivo de la anulación"
                              value={movAnular.motivo}
                              onChange={(e) => setMovAnular({ id: m.id, motivo: e.target.value })}
                              style={{
                                flex: '1 1 200px',
                                minHeight: 44,
                                borderRadius: 10,
                                border: '1.5px solid var(--cp-line, #E3D6C6)',
                                padding: '0 10px',
                              }}
                            />
                            <button
                              type="button"
                              disabled={guardando}
                              onClick={handleAnularMovimiento}
                              style={{
                                minHeight: 44,
                                padding: '0 14px',
                                borderRadius: 10,
                                border: 0,
                                background: 'var(--cp-rust, #B2500F)',
                                color: '#FFFFFF',
                                fontWeight: 800,
                                cursor: guardando ? 'not-allowed' : 'pointer',
                              }}
                            >
                              Anular movimiento
                            </button>
                            <button
                              type="button"
                              onClick={() => setMovAnular(null)}
                              style={{
                                minHeight: 44,
                                padding: '0 14px',
                                borderRadius: 10,
                                border: '1.5px solid var(--cp-navy, #0B2C3E)',
                                background: 'transparent',
                                color: 'var(--cp-navy, #0B2C3E)',
                                fontWeight: 800,
                                cursor: 'pointer',
                              }}
                            >
                              Volver
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setMovAnular({ id: m.id, motivo: '' })}
                            style={{
                              alignSelf: 'flex-start',
                              minHeight: 44,
                              padding: '0 14px',
                              borderRadius: 10,
                              border: '1.5px solid var(--cp-rust, #B2500F)',
                              background: 'transparent',
                              color: 'var(--cp-rust, #B2500F)',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            Anular
                          </button>
                        ))}
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

              {/* Vouchers digitales del día (Yape/Plin analizados con IA) */}
              <SeccionVouchersCierre
                fecha={fechaTurno}
                puedeVer={tiene('vouchers/ver') || puedeVer}
              />
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
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={montoMov}
                onChange={(e) => setMontoMov(limpiarMonto(e.target.value))}
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
                disabled={guardando}
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
                type="text"
                inputMode="decimal"
                value={montoAbrir}
                onChange={(e) => setMontoAbrir(limpiarMonto(e.target.value))}
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

            {errorAbrir && (
              <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-rust, #B2500F)' }}>
                {errorAbrir}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                type="button"
                disabled={guardando}
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

      {correccion && digitales && (
        <DialogoCorregirMedio
          medio={correccion.medio}
          montoSistema={digitales.medios[correccion.clave].sistema}
          montoActual={digitales.medios[correccion.clave].monto}
          alCerrar={() => setCorreccion(null)}
          alGuardado={alCorregirMedio}
        />
      )}
    </div>
  );
}

export default CierreView;

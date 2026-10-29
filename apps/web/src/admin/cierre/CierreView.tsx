import { useState, useEffect, useCallback, useMemo } from 'react';
import { useConfirmarAsync } from '../../comun/useConfirmarAsync';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { HistorialCierres } from './HistorialCierres';
import { cierreApi, calcularTotalEfectivo, PendienteCobro, RepartidorPorLiquidar } from './cierreApi';
import { PendientesCobroCierre, AvisoBloqueoCierre, FocoPendientes, GrupoFoco } from './PendientesCobroCierre';
import { pedidosApi, MovimientoCaja, CobroTurno } from '../pedidos/pedidosApi';
import { ErrorApi } from '../../comun/api';
import { SeccionVouchersCierre } from '../vouchers/SeccionVouchersCierre';
import { BannerCajaCerrada } from '../pedidos/BannerCajaCerrada';

type TabCierre = 'turno' | 'historial';

// Monto en soles: solo dígitos y un punto, máximo dos decimales (sin negativos ni letras)
const limpiarMonto = (v: string) => v.replace(/[^\d.]/g, '').replace(/^(\d*\.?\d{0,2}).*$/, '$1');

// Hoy en Lima como AAAA-MM-DD, para comparar con la fecha de la caja
const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

export function CierreView() {
  const { usuario, tiene } = useSesion();
  const { confirmar, dialogo } = useConfirmarAsync();
  const puedeVer = tiene('caja/ver') || tiene('caja/cerrar') || usuario?.rol === 'ADMIN' || usuario?.rol === 'CAJERO';
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
  // Enfoque pedido desde un aviso del cierre hacia el panel de pendientes
  const [foco, setFoco] = useState<FocoPendientes | null>(null);
  const [pedidosCobrados, setPedidosCobrados] = useState<CobroTurno[]>([]);

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
  const [arqueosNoCuadra, setArqueosNoCuadra] = useState(0);
  const [requierePin, setRequierePin] = useState(false);
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
          // Una caja de otro día sin cerrar también la ve el cajero: no debe leerse como «Caja cerrada»
          setCajaPendiente(cActual.cajaAnteriorAbierta ?? null);
          setPedidosCobrados(cActual.cobrados ?? []);
          if (cActual.caja) {
            setCajaId(`CJ-${String(cActual.caja.id).padStart(4, '0')}`);
            setAperturaMonto(Number(cActual.caja.apertura || 0));
          }
        }
      } catch {
        // En mock mode puede fallar
      }

      // 2. Esperado: solo el administrador lo pide. El cajero cuenta a ciegas (DT-61).
      if (esAdmin) {
        try {
          const esp = await cierreApi.obtenerEsperado();
          if (esp) {
            setEsperado(esp);
            if (esp.cajaId) {
              // La fecha de la caja es un día (UTC medianoche): se compara con el día de Lima
              const fechaCaja = String(esp.fecha).slice(0, 10);
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

      // 5. Pedidos sin cobrar de cualquier día (los que bloquean el cierre; el admin los ve de entrada,
      // el cajero los ve con el PIN de supervisor)
      if (esAdmin) {
        try {
          setPedidosAbiertos(await cierreApi.listarPendientesDeCobro());
          setErrorPendientes(false);
        } catch {
          setPedidosAbiertos([]);
          setErrorPendientes(true);
        }
      }
    } catch (err: any) {
      setErrorCarga(err?.message || 'Error al cargar los datos de caja y cierre');
    } finally {
      setCargando(false);
    }
  }, [esAdmin]);

  useEffect(() => {
    cargarTurno();
  }, [cargarTurno]);

  // Ventas por medio: el efectivo es lo vendido en efectivo, no el esperado en caja
  const ventasEfectivo = esperado?.desglose?.ventasEfectivo ?? 0;
  const ventasTotales = useMemo(() => {
    if (esperado) {
      const { yape = 0, plin = 0, transferencia = 0, tarjeta = 0 } = esperado.medios || {};
      return ventasEfectivo + yape + plin + transferencia + tarjeta;
    }
    return pedidosCobrados.reduce((acc, p) => acc + p.total, 0);
  }, [esperado, pedidosCobrados, ventasEfectivo]);

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
    return aperturaMonto + ventasEfectivo + ingresosExtra - egresosGasto;
  }, [esperado, aperturaMonto, ventasEfectivo, ingresosExtra, egresosGasto]);

  // Pedidos cobrados por medio (solo para el número de pedidos de cada tarjeta)
  // Cuenta los pedidos que tienen un pago en ese medio (un pedido mixto cuenta en cada medio)
  const pedidosPorMedio = (medio: string) => pedidosCobrados.filter((p) => p.medios.includes(medio)).length;

  // Total contado en conteo
  const totalEfectivoContado = useMemo(() => {
    const todos: Record<string, string> = { ...conteoBilletes, ...conteoMonedas };
    return calcularTotalEfectivo(todos);
  }, [conteoBilletes, conteoMonedas]);

  // Cada medio contado frente a lo que el sistema espera (el mismo criterio del servidor: 0,005)
  const filasCuadre = esperado
    ? [
        { medio: 'Efectivo', sistema: efectivoEsperado, contado: totalEfectivoContado },
        { medio: 'Yape', sistema: esperado.medios?.yape ?? 0, contado: Number(limpiarMonto(mediosDigitales.yape)) || 0 },
        { medio: 'Plin', sistema: esperado.medios?.plin ?? 0, contado: Number(limpiarMonto(mediosDigitales.plin)) || 0 },
        { medio: 'Transferencia', sistema: esperado.medios?.transferencia ?? 0, contado: Number(limpiarMonto(mediosDigitales.transferencia)) || 0 },
        { medio: 'Tarjeta', sistema: esperado.medios?.tarjeta ?? 0, contado: Number(limpiarMonto(mediosDigitales.tarjeta)) || 0 },
      ].map((f) => ({ ...f, dif: Math.round((f.contado - f.sistema) * 100) / 100 }))
    : [];
  const cuadraEnSistema = filasCuadre.length > 0 && filasCuadre.every((f) => Math.abs(f.dif) < 0.005);
  // El admin ve la diferencia y la supervisora firma con su PIN; el cajero, si el arqueo no cuadra o ya van 3 arqueos que no cuadraron
  const necesitaPin = esAdmin ? !cuadraEnSistema : revisadoCuadra === false || arqueosNoCuadra >= 3 || requierePin;

  const armarConteo = () => {
    const conteo: Record<string, number> = {};
    for (const [k, v] of Object.entries({ ...conteoBilletes, ...conteoMonedas })) {
      const n = parseInt(v || '0', 10);
      if (n > 0) conteo[k] = n;
    }
    return conteo;
  };

  const armarMedios = () => ({
    yape: Number(limpiarMonto(mediosDigitales.yape)) || 0,
    plin: Number(limpiarMonto(mediosDigitales.plin)) || 0,
    transferencia: Number(limpiarMonto(mediosDigitales.transferencia)) || 0,
    tarjeta: Number(limpiarMonto(mediosDigitales.tarjeta)) || 0,
  });

  const errorDeServidor = (err: unknown, respaldo: string) => (err instanceof ErrorApi ? err.message : respaldo);

  const abrirCierre = () => {
    setFaseCierre('verificar');
    setRevisadoCuadra(null);
    setPinVerificado(false);
    setPinSupervisora('');
    setRequierePin(false);
    setMsgCierreError('');
    setAbrirModalCierre(true);
  };

  // Lleva al panel de pendientes (abre el cierre si hace falta) y abre el grupo pedido
  const enfocarPendientes = (grupo: GrupoFoco) => {
    setFaseCierre('verificar');
    if (!abrirModalCierre) abrirCierre();
    setFoco({ grupo, n: Date.now() });
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

  // Cajero: el arqueo lo compara el servidor (todos los medios, mismo criterio) y guarda el intento
  const handleRevisarCuadre = async () => {
    if (guardando) return;
    setMsgCierreError('');
    setGuardando(true);
    try {
      const res = await cierreApi.realizarArqueo(
        { conteo: armarConteo(), medios: armarMedios() },
        requierePin || arqueosNoCuadra >= 3 ? pinSupervisora : undefined,
      );
      setRevisadoCuadra(res.resultado === 'CUADRA');
      setArqueosNoCuadra(res.resultado === 'NO_CUADRA' ? arqueosNoCuadra + 1 : arqueosNoCuadra);
      setRequierePin(false);
    } catch (err: any) {
      if (err instanceof ErrorApi && err.codigo === 'PIN_REQUERIDO') {
        setRequierePin(true);
      }
      setMsgCierreError(errorDeServidor(err, 'No se pudo revisar el arqueo.'));
    } finally {
      setGuardando(false);
    }
  };

  // El código lo valida el servidor; solo si lo acepta se muestra el detalle del cuadre
  const handleVerificarPinSupervisora = async () => {
    if (guardando) return;
    const pin = pinSupervisora.trim();
    if (!/^\d{6}$/.test(pin)) {
      setMsgCierreError('El código de la supervisora tiene 6 dígitos.');
      return;
    }
    setGuardando(true);
    try {
      const datos = await cierreApi.verificarPinSupervisor(pin);
      setEsperado(datos);
      setPinVerificado(true);
      setMsgCierreError('');
    } catch (err: any) {
      setPinVerificado(false);
      if (err instanceof ErrorApi) {
        if (err.codigo === 'CODIGO_INVALIDO' || err.codigo === 'PIN_INVALIDO') {
          setMsgCierreError('Código de supervisor inválido o no proporcionado');
        } else if (err.codigo === 'CODIGO_BLOQUEADO' || err.codigo === 'PIN_BLOQUEADO') {
          setMsgCierreError('Demasiados intentos fallidos. Bloqueado temporalmente por 5 minutos.');
        } else if (err.codigo === 'SUPERVISOR_SIN_CONFIGURAR') {
          setMsgCierreError('El local aún no tiene configurado el código de supervisor. El administrador debe generarlo desde su pantalla.');
        } else {
          setMsgCierreError(errorDeServidor(err, 'No se pudo verificar el código de la supervisora.'));
        }
      } else {
        setMsgCierreError(errorDeServidor(err, 'No se pudo verificar el código de la supervisora.'));
      }
    } finally {
      setGuardando(false);
    }
  };

  const handleConfirmarCierre = async () => {
    if (guardando || cerrandoCaja) return;
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
    if (necesitaPin) {
      if (!esAdmin && !pinVerificado) {
        setMsgCierreError('No cuadra: la supervisora debe escribir su código para revisar el detalle y cerrar.');
        return;
      }
      if (!pinSupervisora.trim()) {
        setMsgCierreError('Escribe el código de la supervisora de 6 dígitos.');
        return;
      }
      if (obsCierre.trim().length < 3) {
        setMsgCierreError('Escribe una nota de al menos 3 caracteres para cerrar con diferencias.');
        return;
      }
    }

    // El cajero no ve la diferencia (cierre ciego): la pregunta es neutra
    let titulo = '¿Cerrar la caja?';
    if (esAdmin) {
      const difTot = Math.round((totalEfectivoContado - efectivoEsperado) * 100) / 100;
      const txtDif = Math.abs(difTot) < 0.005 ? 'cuadrada' : `con una diferencia de s/ ${Math.abs(difTot).toFixed(2)} ${difTot > 0 ? 'de sobrante' : 'de faltante'}`;
      titulo = `¿Cerrar la caja ${txtDif}?`;
    }
    const conf = await confirmar({
      titulo,
      mensaje: `Se guarda el cierre en el historial, que no se puede borrar ni editar. Mañana la caja se abre en cero.`,
    });
    if (!conf) return;

    setCerrandoCaja(true);
    try {
      await cierreApi.cerrarCaja(
        {
          conteo: armarConteo(),
          medios: armarMedios(),
          nota: obsCierre.trim() || undefined,
        },
        necesitaPin ? pinSupervisora.trim() : undefined,
      );

      setAbrirModalCierre(false);
      setCjMsg('Caja cerrada. El cierre quedó registrado en el historial inmutable.');
      setTabActiva('historial');
      setArqueosNoCuadra(0);
      setRequierePin(false);
      cargarTurno();
    } catch (err: any) {
      if (err instanceof ErrorApi && (err.codigo === 'PIN_REQUERIDO' || err.codigo === 'NOTA_REQUERIDA')) {
        setRequierePin(true);
      }
      if (err instanceof ErrorApi && err.codigo === 'PIN_INVALIDO') {
        setPinVerificado(false);
      }
      setMsgCierreError(errorDeServidor(err, 'Error al cerrar la caja.'));
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
                fecha={hoyLima()}
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
                        key={p.pedidoId}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          borderTop: '1px solid var(--cp-sand, #EDE1D1)',
                          paddingTop: 4,
                        }}
                      >
                        <span>
                          <b>{p.codigo}</b> · {p.cliente || 'Cliente'} ({p.medios.join(' + ') || 'Efectivo'})
                        </span>
                        <span style={{ fontWeight: 700 }}>s/ {p.total.toFixed(2)}</span>
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

                {/* Pedidos sin cobrar que impiden el cierre: se cobran o se anulan desde aquí */}
                <PendientesCobroCierre
                  esAdmin={esAdmin}
                  pendientes={pedidosAbiertos}
                  setPendientes={setPedidosAbiertos}
                  alCambiarTurno={cargarTurno}
                  errorLista={errorPendientes}
                  alReintentar={cargarTurno}
                  foco={foco}
                />

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
                            type="text"
                            inputMode="numeric"
                            aria-label={`Cantidad de billetes de S/ ${d}`}
                            placeholder="0"
                            value={conteoBilletes[d]}
                            onChange={(e) => setConteoBilletes({ ...conteoBilletes, [d]: e.target.value.replace(/\D/g, '') })}
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
                            type="text"
                            inputMode="numeric"
                            aria-label={`Cantidad de monedas de S/ ${Number(d).toFixed(2)}`}
                            placeholder="0"
                            value={conteoMonedas[d]}
                            onChange={(e) => setConteoMonedas({ ...conteoMonedas, [d]: e.target.value.replace(/\D/g, '') })}
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
                    {(['yape', 'plin', 'transferencia', 'tarjeta'] as const).map((m) => (
                      <div key={m}>
                        <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize', color: 'var(--cp-soft, #2C4C5D)' }}>
                          {m}
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={`Monto en ${m}`}
                          placeholder="0.00"
                          value={mediosDigitales[m]}
                          onChange={(e) => setMediosDigitales({ ...mediosDigitales, [m]: limpiarMonto(e.target.value) })}
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
                      disabled={guardando}
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
                    {(revisadoCuadra === false || requierePin) && !pinVerificado && (
                      <div style={{ marginTop: 8, border: '1px solid var(--cp-rust, #B2500F)', background: '#FFF0ED', borderRadius: 10, padding: 10 }}>
                        <div style={{ color: 'var(--cp-rust, #B2500F)', fontWeight: 700, fontSize: 13 }}>
                          No cuadra: la supervisora debe escribir su código para revisar el detalle y cerrar.
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                          <input
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            aria-label="Código de la supervisora"
                            placeholder="Código de la supervisora"
                            value={pinSupervisora}
                            onChange={(e) => setPinSupervisora(e.target.value.replace(/\D/g, ''))}
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
                            disabled={guardando}
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

                {/* Detalle de comparación si es Admin o si el código fue validado */}
                {(esAdmin || pinVerificado) && filasCuadre.length > 0 && (
                  <div
                    data-testid="detalle-cuadre"
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
                      {esAdmin ? 'Resultado del cuadre' : 'Detalle (abierto con código del supervisor)'}
                    </div>
                    {filasCuadre.map((f) => (
                      <div
                        key={f.medio}
                        style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, borderTop: '1px solid var(--cp-sand, #EDE1D1)', paddingTop: 4 }}
                      >
                        <b>{f.medio}</b>
                        <span>Sist. s/ {f.sistema.toFixed(2)}</span>
                        <span>Cont. s/ {f.contado.toFixed(2)}</span>
                        <b style={{ color: Math.abs(f.dif) < 0.005 ? 'var(--cp-green, #2F7A45)' : 'var(--cp-rust, #B2500F)' }}>
                          {Math.abs(f.dif) < 0.005 ? 'Cuadra' : `${f.dif > 0 ? '+' : '−'} s/ ${Math.abs(f.dif).toFixed(2)}`}
                        </b>
                      </div>
                    ))}
                  </div>
                )}

                {/* El administrador firma la diferencia con el código rotativo */}
                {esAdmin && necesitaPin && (
                  <div>
                    <label htmlFor="cl-pin" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
                      Código del supervisor (la diferencia se cierra con su código)
                    </label>
                    <input
                      id="cl-pin"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      aria-label="Código de la supervisora"
                      placeholder="Código del supervisor"
                      value={pinSupervisora}
                      onChange={(e) => setPinSupervisora(e.target.value.replace(/\D/g, ''))}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        minHeight: 44,
                        borderRadius: 10,
                        border: '1.5px solid var(--cp-line, #E3D6C6)',
                        padding: '0 10px',
                      }}
                    />
                  </div>
                )}

                {/* Observaciones */}
                <div>
                  <label htmlFor="cl-o" style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 4 }}>
                    {necesitaPin ? 'Nota explicativa (obligatoria, mínimo 3 caracteres)' : 'Observaciones (opcional)'}
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

                {msgCierreError && pedidosAbiertos.length > 0 && (
                  <AvisoBloqueoCierre pedidos={pedidosAbiertos} alVerGrupo={enfocarPendientes} />
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    disabled={cerrandoCaja || guardando}
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
                      cursor: cerrandoCaja || guardando ? 'not-allowed' : 'pointer',
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

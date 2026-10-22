import { useEffect, useState, useTransition } from 'react';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import {
  obtenerResumenCreditos,
  exportarCreditos,
  type RespuestaResumenCreditos,
} from './creditosApi';

export function CreditosView() {
  const { usuario } = useSesion();
  const [, startTransition] = useTransition();

  const [periodoTipo, setPeriodoTipo] = useState<'semana' | 'mes' | 'rango'>('semana');
  const [semanaOffset, setSemanaOffset] = useState<number>(0);
  const [mesOffset, setMesOffset] = useState<number>(0);
  const [desde, setDesde] = useState<string>('');
  const [hasta, setHasta] = useState<string>('');

  const [resumen, setResumen] = useState<RespuestaResumenCreditos | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [filasAbiertas, setFilasAbiertas] = useState<Record<string, boolean>>({});
  const [exportando, setExportando] = useState<boolean>(false);
  const [exportMsg, setExportMsg] = useState<string>('');

  const cargarDatos = async () => {
    try {
      setError('');
      const data = await obtenerResumenCreditos({
        periodo: periodoTipo,
        semanaOffset: periodoTipo === 'semana' ? semanaOffset : undefined,
        mesOffset: periodoTipo === 'mes' ? mesOffset : undefined,
        desde: periodoTipo === 'rango' && desde ? desde : undefined,
        hasta: periodoTipo === 'rango' && hasta ? hasta : undefined,
      });
      setResumen(data);
      if (periodoTipo === 'rango' && (!desde || !hasta)) {
        setDesde(data.periodo.desde);
        setHasta(data.periodo.hasta);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al cargar los créditos del personal');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    startTransition(() => {
      cargarDatos();
    });
  }, [periodoTipo, semanaOffset, mesOffset, desde, hasta]);

  const toggleFila = (partyId: string) => {
    setFilasAbiertas((prev) => ({ ...prev, [partyId]: !prev[partyId] }));
  };

  const handleExportar = async () => {
    setExportando(true);
    setExportMsg('');
    try {
      const { blob, nombreArchivo } = await exportarCreditos({
        periodo: periodoTipo,
        semanaOffset: periodoTipo === 'semana' ? semanaOffset : undefined,
        mesOffset: periodoTipo === 'mes' ? mesOffset : undefined,
        desde: periodoTipo === 'rango' ? desde : undefined,
        hasta: periodoTipo === 'rango' ? hasta : undefined,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportMsg(`Archivo descargado: ${nombreArchivo}`);
    } catch (err: any) {
      alert(err?.message || 'Error al exportar a Excel');
    } finally {
      setExportando(false);
    }
  };

  const esAdmin = (usuario?.rol || '').toUpperCase() === 'ADMIN';

  const tituloCabecera =
    periodoTipo === 'semana'
      ? 'Consumo del personal por semana'
      : periodoTipo === 'mes'
      ? 'Consumo del personal por mes'
      : 'Consumo del personal por período';

  const etiquetaTotal =
    periodoTipo === 'semana'
      ? 'Total de la semana'
      : periodoTipo === 'mes'
      ? 'Total del mes'
      : 'Total del período';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {!esAdmin && (
        <div
          style={{
            background: '#FFF6E3',
            border: '1.5px solid var(--cp-gold)',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          El descuento del crédito lo fija el administrador: {resumen?.descuentoPct ?? 25} %.
        </div>
      )}

      {/* Tarjeta de condiciones y filtros */}
      <div
        style={{
          background: 'var(--cp-white)',
          border: '2px solid var(--cp-orange)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '16px' }}>
          Condiciones del crédito del personal
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 140px', background: 'var(--cp-cream)', borderRadius: '12px', padding: '10px 12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Descuento</div>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '20px' }}>
              {resumen?.descuentoPct ?? 25} %
            </div>
          </div>
        </div>
        <div style={{ fontSize: '13px', lineHeight: '19px', color: 'var(--cp-soft)' }}>
          El descuento se cambia en Configuración del local, sección Operación, y vale para los consumos nuevos. No hay plazo ni abonos: lo que consume cada trabajador se acumula por mes y el administrador lo revisa a fin de mes; el descuento del pago se hace fuera del sistema. El crédito se consume en Pedidos y caja («Cobrar a crédito del personal»), no por la carta virtual.
        </div>

        <div style={{ borderTop: '1px solid var(--cp-line)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Navegación y título de período */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '16px' }}>
              {tituloCabecera}
            </div>
            {periodoTipo !== 'rango' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (periodoTipo === 'semana') setSemanaOffset((o) => o - 1);
                    else setMesOffset((o) => o - 1);
                  }}
                  aria-label="Período anterior"
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '22px',
                    border: '1.5px solid var(--cp-navy)',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 800,
                    fontSize: '18px',
                    cursor: 'pointer',
                  }}
                >
                  ‹
                </button>
                <span
                  style={{
                    minWidth: '140px',
                    textAlign: 'center',
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    fontSize: '15px',
                  }}
                >
                  {resumen?.periodo.etiqueta || 'Cargando…'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (periodoTipo === 'semana') setSemanaOffset((o) => o + 1);
                    else setMesOffset((o) => o + 1);
                  }}
                  aria-label="Período siguiente"
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '22px',
                    border: '1.5px solid var(--cp-navy)',
                    background: 'transparent',
                    color: 'var(--cp-navy)',
                    fontWeight: 800,
                    fontSize: '18px',
                    cursor: 'pointer',
                  }}
                >
                  ›
                </button>
              </div>
            )}
          </div>

          {/* Selector de tipo de período y botón exportar */}
          <div role="group" aria-label="Período" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setPeriodoTipo('semana');
                setSemanaOffset(0);
              }}
              style={{
                minHeight: '44px',
                padding: '0 14px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                background: periodoTipo === 'semana' ? 'var(--cp-navy)' : 'transparent',
                color: periodoTipo === 'semana' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Por semana
            </button>
            <button
              type="button"
              onClick={() => {
                setPeriodoTipo('mes');
                setMesOffset(0);
              }}
              style={{
                minHeight: '44px',
                padding: '0 14px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                background: periodoTipo === 'mes' ? 'var(--cp-navy)' : 'transparent',
                color: periodoTipo === 'mes' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Por mes
            </button>
            <button
              type="button"
              onClick={() => setPeriodoTipo('rango')}
              style={{
                minHeight: '44px',
                padding: '0 14px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                background: periodoTipo === 'rango' ? 'var(--cp-navy)' : 'transparent',
                color: periodoTipo === 'rango' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Rango de fechas
            </button>

            {periodoTipo === 'rango' && (
              <>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>
                  Desde
                  <input
                    type="date"
                    value={desde}
                    onChange={(e) => setDesde(e.target.value)}
                    style={{
                      display: 'block',
                      minHeight: '44px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-line)',
                      padding: '0 8px',
                      background: 'var(--cp-white)',
                      color: 'var(--cp-navy)',
                    }}
                  />
                </label>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>
                  Hasta
                  <input
                    type="date"
                    value={hasta}
                    onChange={(e) => setHasta(e.target.value)}
                    style={{
                      display: 'block',
                      minHeight: '44px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--cp-line)',
                      padding: '0 8px',
                      background: 'var(--cp-white)',
                      color: 'var(--cp-navy)',
                    }}
                  />
                </label>
              </>
            )}

            {esAdmin && (
              <button
                type="button"
                onClick={handleExportar}
                disabled={exportando}
                style={{
                  minHeight: '44px',
                  padding: '0 14px',
                  borderRadius: '12px',
                  border: 0,
                  background: 'var(--cp-navy)',
                  color: 'var(--cp-cream)',
                  fontWeight: 800,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {exportando ? 'Exportando…' : 'Exportar a Excel'}
              </button>
            )}
          </div>

          {exportMsg && (
            <div role="status" style={{ fontSize: '13px', fontWeight: 700, color: '#1F5C33' }}>
              {exportMsg}
            </div>
          )}

          {/* Tarjetas de totales del período */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 150px', background: 'var(--cp-cream)', borderRadius: '12px', padding: '10px 12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>{etiquetaTotal}</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '20px' }}>
                {resumen?.totales.totalFormateado ?? 's/ 0.00'}
              </div>
            </div>
            <div style={{ flex: '1 1 150px', background: 'var(--cp-cream)', borderRadius: '12px', padding: '10px 12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Trabajadores con consumo</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '20px' }}>
                {resumen?.totales.resumenTrabajadores ?? '0 de 0'}
              </div>
            </div>
            <div style={{ flex: '1 1 150px', background: 'var(--cp-cream)', borderRadius: '12px', padding: '10px 12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--cp-soft)' }}>Consumos</div>
              <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '20px' }}>
                {resumen?.totales.totalConsumos ?? 0}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '12px', lineHeight: '17px', color: 'var(--cp-soft)' }}>
            Es lo que el trabajador consumió con su usuario en el período, ya con su descuento. Como el pago es semanal, por defecto se ve la semana (lunes a domingo); el descuento se hace fuera del sistema.
          </div>

          {cargando && <Cargando texto="Cargando consumos del personal…" />}

          {error && (
            <div style={{ padding: '14px', background: '#FDECE8', color: 'var(--cp-rust)', borderRadius: '12px', fontSize: '13px', fontWeight: 700 }}>
              {error}
            </div>
          )}

          {/* Lista de colaboradores desglosada */}
          {!cargando &&
            resumen?.trabajadores.map((w) => {
              const abierta = !!filasAbiertas[w.partyId];
              const op = w.tieneConsumo ? 1 : 0.65;
              const subtexto = `${w.rol} · ${w.tieneConsumo ? `${w.cantidadConsumos} consumo${w.cantidadConsumos === 1 ? '' : 's'}` : 'sin consumo'}`;

              return (
                <div
                  key={w.partyId}
                  style={{
                    border: '1px solid var(--cp-line)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    opacity: op,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleFila(w.partyId)}
                    aria-expanded={abierta}
                    style={{
                      width: '100%',
                      minHeight: '56px',
                      padding: '8px 12px',
                      border: 0,
                      background: 'var(--cp-white)',
                      color: 'var(--cp-navy)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ flex: '1 1 0%', minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 800, fontSize: '14px' }}>
                        {w.nombre}
                      </span>
                      <span style={{ display: 'block', fontSize: '12px', color: 'var(--cp-soft)' }}>
                        {subtexto}
                      </span>
                    </span>
                    <span
                      style={{
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 800,
                        fontSize: '16px',
                        color: w.tieneConsumo ? 'var(--cp-navy)' : 'var(--cp-soft)',
                      }}
                    >
                      {w.totalFormateado}
                    </span>
                    <span style={{ fontSize: '14px' }}>{abierta ? '▴' : '▾'}</span>
                  </button>

                  {abierta && (
                    <div
                      style={{
                        padding: '6px 12px 10px',
                        background: 'var(--cp-cream)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      {!w.tieneConsumo && (
                        <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>
                          No consumió nada este mes.
                        </div>
                      )}

                      {w.tieneConsumo &&
                        w.items.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              borderTop: '1px solid var(--cp-line)',
                              paddingTop: '6px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '13px' }}>
                              <span style={{ fontWeight: 700 }}>
                                {item.fecha} · {item.pedidoCodigo}
                              </span>
                              <span style={{ fontWeight: 700 }}>{item.montoFormateado}</span>
                            </div>
                            {item.lineas.map((linea, idx) => (
                              <div
                                key={idx}
                                style={{
                                  fontSize: '12px',
                                  lineHeight: '16px',
                                  color: 'var(--cp-soft)',
                                }}
                              >
                                • {linea}
                              </div>
                            ))}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Campo } from '../../comun/Campo';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';

export interface ParametroItem {
  clave: string;
  valor: any;
}

interface MetaParametro {
  nombre: string;
  descripcion: string;
  tipo: 'numero' | 'texto' | 'sino' | 'solo_lectura' | 'objeto';
  sufijo?: string;
}

const META_PARAMETROS: Record<string, MetaParametro> = {
  tiempo_prometido_min: {
    nombre: 'Tiempo prometido de entrega (base)',
    descripcion: 'Minutos base de entrega que se anuncian al cliente en la carta y chatbot.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  tiempo_max_min: {
    nombre: 'Tiempo máximo de entrega',
    descripcion: 'Límite superior del tiempo estimado de entrega para el cliente.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  envio_gratis_monto: {
    nombre: 'Monto de envío gratis',
    descripcion: 'Monto total de productos requerido para que el despacho a domicilio no tenga costo.',
    tipo: 'numero',
    sufijo: 'S/',
  },
  envio_gratis_modo: {
    nombre: 'Modo de envío gratis',
    descripcion: 'Aplica desde el monto exacto ("desde") o solo si supera el monto ("mas_de").',
    tipo: 'texto',
  },
  pedido_minimo: {
    nombre: 'Pedido mínimo para delivery',
    descripcion: 'Monto mínimo en compras requerido para poder solicitar envío a domicilio.',
    tipo: 'numero',
    sufijo: 'S/',
  },
  tolerancia_reserva_min: {
    nombre: 'Tolerancia de reserva',
    descripcion: 'Minutos de espera de cortesía antes de liberar una mesa reservada.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  reserva_tolerancia_min: {
    nombre: 'Tolerancia de reserva',
    descripcion: 'Minutos de espera de cortesía antes de liberar una mesa reservada.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  puntos_porcentaje: {
    nombre: 'Porcentaje de puntos',
    descripcion: 'Porcentaje del monto consumido que el cliente acumula en puntos fidelidad.',
    tipo: 'numero',
    sufijo: '%',
  },
  descuento_personal_pct: {
    nombre: 'Descuento para el personal',
    descripcion: 'Porcentaje de descuento para consumos de los colaboradores a crédito.',
    tipo: 'numero',
    sufijo: '%',
  },
  rep_naranja_min: {
    nombre: 'Alerta naranja de reparto (retraso)',
    descripcion: 'Minutos transcurridos para marcar pedidos en alerta naranja en el mapa y en cocina.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  rep_rojo_min: {
    nombre: 'Alerta roja de reparto (crítico)',
    descripcion: 'Minutos transcurridos para marcar pedidos en estado crítico (rojo) en el mapa y en cocina.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
  rep_max_pedidos: {
    nombre: 'Máximo de pedidos por repartidor',
    descripcion: 'Cantidad límite de órdenes simultáneas que puede trasladar un repartidor.',
    tipo: 'numero',
    sufijo: 'pedidos',
  },
  pausa_alta_demanda: {
    nombre: 'Pausa por alta demanda',
    descripcion: 'Detiene temporalmente el ingreso de nuevos pedidos. Solo lectura: la gestiona cocina.',
    tipo: 'solo_lectura',
  },
  alta_demanda_min_base: {
    nombre: 'Minutos base por alta demanda',
    descripcion: 'Tiempo adicional que se suma a las órdenes cuando alta demanda está encendida.',
    tipo: 'numero',
    sufijo: 'minutos',
  },
};

interface ParametrosOperacionTabProps {
  puedeVer: boolean;
  puedeEditar: boolean;
}

export function ParametrosOperacionTab({
  puedeVer,
  puedeEditar,
}: ParametrosOperacionTabProps) {
  const [parametros, setParametros] = useState<ParametroItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Parámetro en edición modal
  const [parametroEditando, setParametroEditando] = useState<ParametroItem | null>(null);
  const [nuevoValorInput, setNuevoValorInput] = useState<string>('');
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  // Confirmación Sí/No antes de guardar
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null);

  const cargarParametros = async () => {
    if (!puedeVer) {
      setCargando(false);
      return;
    }
    setCargando(true);
    setErrorCarga(null);
    try {
      const res = await api.get<ParametroItem[]>('/admin/configuracion');
      // Filtramos datos del local y pagos que tienen su propia pestaña dedicada
      const filtrados = res.filter(
        (p) => p.clave !== 'local_datos' && p.clave !== 'local_pagos',
      );
      setParametros(filtrados);
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'No se pudieron cargar los parámetros de operación';
      setErrorCarga(msg);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarParametros();
  }, [puedeVer]);

  if (!puedeVer) {
    return (
      <div
        role="status"
        style={{
          background: 'var(--cp-sand)',
          border: '1px solid var(--cp-line)',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center',
          color: 'var(--cp-soft)',
        }}
      >
        <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: '16px', color: 'var(--cp-navy)', marginBottom: '6px' }}>
          Sin permiso de acceso
        </div>
        <div>No tienes el permiso <b>configuracion/ver</b> para consultar los parámetros de operación.</div>
      </div>
    );
  }

  if (cargando) {
    return <Cargando mensaje="Cargando parámetros de operación..." />;
  }

  if (errorCarga) {
    return (
      <EstadoError
        titulo="Error al cargar parámetros"
        mensaje={errorCarga}
        alReintentar={cargarParametros}
      />
    );
  }

  const iniciarEdicion = (item: ParametroItem) => {
    setParametroEditando(item);
    setErrorValidacion(null);
    setErrorServidor(null);
    if (typeof item.valor === 'boolean') {
      setNuevoValorInput(item.valor ? 'true' : 'false');
    } else if (typeof item.valor === 'number') {
      setNuevoValorInput(String(item.valor));
    } else if (typeof item.valor === 'string') {
      setNuevoValorInput(item.valor);
    } else {
      setNuevoValorInput(JSON.stringify(item.valor));
    }
  };

  const prepararGuardado = () => {
    if (!parametroEditando) return;
    const meta = META_PARAMETROS[parametroEditando.clave];
    const tipo = meta?.tipo || (typeof parametroEditando.valor === 'number' ? 'numero' : 'texto');

    if (tipo === 'numero') {
      const num = Number(nuevoValorInput.trim());
      if (isNaN(num) || num < 0) {
        setErrorValidacion('El valor debe ser un número mayor o igual a 0');
        return;
      }
    } else if (tipo === 'texto') {
      if (!nuevoValorInput.trim()) {
        setErrorValidacion('El texto no puede estar vacío');
        return;
      }
    }

    setErrorValidacion(null);
    setConfirmarAbierto(true);
  };

  const handleGuardarParametro = async () => {
    if (!parametroEditando || !puedeEditar) return;
    const clave = parametroEditando.clave;
    const meta = META_PARAMETROS[clave];
    const tipo = meta?.tipo || (typeof parametroEditando.valor === 'number' ? 'numero' : 'texto');

    let valorFinal: any = nuevoValorInput.trim();
    if (tipo === 'numero') {
      valorFinal = Number(nuevoValorInput.trim());
    } else if (tipo === 'sino') {
      valorFinal = nuevoValorInput === 'true';
    }

    setGuardando(true);
    setErrorServidor(null);
    try {
      const res = await api.put<ParametroItem>(`/admin/configuracion/${clave}`, {
        valor: valorFinal,
      });

      setParametros((prev) =>
        prev.map((p) => (p.clave === clave ? { ...p, valor: res.valor } : p)),
      );

      const ahora = new Date();
      const horaStr = ahora.toLocaleTimeString('es-PE', { hour12: false });
      setMensajeGuardado(`Guardado a las ${horaStr}`);
      setConfirmarAbierto(false);
      setParametroEditando(null);
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'Error al actualizar el parámetro en el servidor';
      setErrorServidor(msg);
      setConfirmarAbierto(false);
    } finally {
      setGuardando(false);
    }
  };

  const formatearValorVisual = (clave: string, valor: any) => {
    if (clave === 'pausa_alta_demanda') {
      const activa = typeof valor === 'boolean' ? valor : Boolean(valor?.activa);
      return activa ? 'Activa (cocina pausada)' : 'Desactivada (operando)';
    }
    if (typeof valor === 'boolean') {
      return valor ? 'Sí' : 'No';
    }
    if (typeof valor === 'object' && valor !== null) {
      return JSON.stringify(valor);
    }
    const meta = META_PARAMETROS[clave];
    if (meta?.sufijo) {
      return `${valor} ${meta.sufijo}`;
    }
    return String(valor ?? '');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: 'var(--fuente-titulos)',
              fontWeight: 800,
              fontSize: '18px',
              color: 'var(--cp-navy)',
            }}
          >
            Parámetros de operación
          </h2>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--cp-soft)',
              margin: '4px 0 0 0',
            }}
          >
            Tiempos de entrega, umbrales de reparto, tolerancias y beneficios de clientes.
          </p>
        </div>

        {mensajeGuardado && (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--cp-green)',
            }}
          >
            {mensajeGuardado}
          </span>
        )}
      </div>

      {!puedeEditar && (
        <div
          role="status"
          style={{
            background: 'var(--cp-sand)',
            border: '1px solid var(--cp-line)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '13px',
            color: 'var(--cp-soft)',
          }}
        >
          Modo sólo lectura. No tienes el permiso <b>configuracion/editar</b> para modificar parámetros.
        </div>
      )}

      {!parametroEditando && errorServidor && (
        <div
          role="alert"
          style={{
            background: '#FBEDE9',
            border: '1px solid var(--cp-rust)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '13px',
            color: 'var(--cp-rust)',
            fontWeight: 600,
          }}
        >
          {errorServidor}
        </div>
      )}

      {parametros.length === 0 ? (
        <EstadoVacio
          titulo="Sin parámetros de operación"
          descripcion="No se encontraron parámetros registrados en la base de datos."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {parametros.map((p) => {
            const meta = META_PARAMETROS[p.clave] || {
              nombre: p.clave.replace(/_/g, ' '),
              descripcion: `Parámetro de configuración del sistema (${p.clave}).`,
              tipo: typeof p.valor === 'number' ? 'numero' : typeof p.valor === 'boolean' ? 'sino' : 'texto',
            };
            const esSoloLectura = meta.tipo === 'solo_lectura' || p.clave === 'pausa_alta_demanda';

            return (
              <div
                key={p.clave}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  padding: '14px 18px',
                  background: 'var(--cp-white)',
                  border: '1px solid var(--cp-line)',
                  borderRadius: '14px',
                  gap: '12px',
                }}
              >
                <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--fuente-titulos)',
                        fontWeight: 800,
                        fontSize: '15px',
                        color: 'var(--cp-navy)',
                      }}
                    >
                      {meta.nombre}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '6px',
                        background: 'var(--cp-sand)',
                        color: 'var(--cp-soft)',
                      }}
                    >
                      {p.clave}
                    </span>
                    {esSoloLectura && (
                      <Insignia variante="aviso">Solo lectura (Cocina)</Insignia>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--cp-soft)', lineHeight: '18px' }}>
                    {meta.descripcion}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      fontFamily: 'var(--fuente-titulos)',
                      fontWeight: 800,
                      fontSize: '16px',
                      color: 'var(--cp-navy)',
                      background: 'var(--cp-sand)',
                      padding: '6px 14px',
                      borderRadius: '10px',
                      minWidth: '80px',
                      textAlign: 'center',
                    }}
                  >
                    {formatearValorVisual(p.clave, p.valor)}
                  </div>

                  {!esSoloLectura && puedeEditar && (
                    <Boton
                      type="button"
                      variante="secundario"
                      tamano="pequeno"
                      onClick={() => iniciarEdicion(p)}
                    >
                      Editar
                    </Boton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal / Diálogo de edición de parámetro */}
      {parametroEditando && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: 'rgba(11, 44, 62, 0.65)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => !guardando && setParametroEditando(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="editar-parametro-titulo"
            style={{
              width: '100%',
              maxWidth: '440px',
              background: 'var(--cp-white)',
              border: '1px solid var(--cp-line)',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 12px 36px rgba(11, 44, 62, 0.22)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3
                id="editar-parametro-titulo"
                style={{
                  fontFamily: 'var(--fuente-titulos)',
                  fontWeight: 800,
                  fontSize: '17px',
                  color: 'var(--cp-navy)',
                }}
              >
                {META_PARAMETROS[parametroEditando.clave]?.nombre || parametroEditando.clave}
              </h3>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--cp-soft)',
                  margin: '4px 0 0 0',
                }}
              >
                {META_PARAMETROS[parametroEditando.clave]?.descripcion}
              </p>
            </div>

            {errorValidacion && (
              <div
                role="alert"
                style={{
                  background: '#FBEDE9',
                  border: '1px solid var(--cp-rust)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: 'var(--cp-rust)',
                  fontWeight: 600,
                }}
              >
                {errorValidacion}
              </div>
            )}

            {errorServidor && (
              <div
                role="alert"
                style={{
                  background: '#FBEDE9',
                  border: '1px solid var(--cp-rust)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: 'var(--cp-rust)',
                  fontWeight: 600,
                }}
              >
                {errorServidor}
              </div>
            )}

            {(() => {
              const meta = META_PARAMETROS[parametroEditando.clave];
              const tipo = meta?.tipo || (typeof parametroEditando.valor === 'number' ? 'numero' : 'texto');

              if (tipo === 'sino') {
                const esTrue = nuevoValorInput === 'true';
                return (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setNuevoValorInput('true')}
                      style={{
                        flex: 1,
                        minHeight: '44px',
                        borderRadius: '10px',
                        border: '1.5px solid var(--cp-navy)',
                        background: esTrue ? 'var(--cp-navy)' : 'transparent',
                        color: esTrue ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        fontWeight: 800,
                      }}
                    >
                      Sí / Activo
                    </button>
                    <button
                      type="button"
                      onClick={() => setNuevoValorInput('false')}
                      style={{
                        flex: 1,
                        minHeight: '44px',
                        borderRadius: '10px',
                        border: '1.5px solid var(--cp-navy)',
                        background: !esTrue ? 'var(--cp-navy)' : 'transparent',
                        color: !esTrue ? 'var(--cp-cream)' : 'var(--cp-navy)',
                        fontWeight: 800,
                      }}
                    >
                      No / Inactivo
                    </button>
                  </div>
                );
              }

              return (
                <Campo
                  etiqueta={`Nuevo valor ${meta?.sufijo ? `(${meta.sufijo})` : ''}`}
                  type={tipo === 'numero' ? 'number' : 'text'}
                  value={nuevoValorInput}
                  onChange={(e) => {
                    setNuevoValorInput(e.target.value);
                    setErrorValidacion(null);
                    setErrorServidor(null);
                  }}
                  autoFocus
                />
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <Boton
                type="button"
                variante="secundario"
                disabled={guardando}
                onClick={() => setParametroEditando(null)}
              >
                Cancelar
              </Boton>
              <Boton
                type="button"
                variante="primario"
                disabled={guardando}
                onClick={prepararGuardado}
              >
                Continuar
              </Boton>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Sí/No obligatorio antes de guardar un parámetro */}
      <Confirmar
        abierto={confirmarAbierto}
        titulo="¿Guardar parámetro de operación?"
        mensaje={`¿Confirmas cambiar el valor de "${
          parametroEditando ? META_PARAMETROS[parametroEditando.clave]?.nombre || parametroEditando.clave : ''
        }" a "${nuevoValorInput}"? El cambio afectará los cálculos operativos del sistema.`}
        textoSi="Sí, guardar"
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={handleGuardarParametro}
        alCancelar={() => setConfirmarAbierto(false)}
      />
    </div>
  );
}

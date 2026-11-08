import { useState, useEffect, useMemo } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Campo } from '../../comun/Campo';
import { Cargando } from '../../comun/Cargando';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { AyudaBloque } from './AyudaBloque';
import { CampoAyuda } from './AyudaCampo';
import { propsAyuda } from './catalogo/propsAyuda';

export interface PagosLocal {
  efectivo: { activo: boolean };
  yape: { activo: boolean; numero?: string; titular?: string };
  plin: { activo: boolean; numero?: string; titular?: string };
  transferencia: { activo: boolean; cuenta?: string; cci?: string; banco?: string; titular?: string };
  tarjeta: { activo: boolean };
}

const PAGOS_DEFAULT: PagosLocal = {
  efectivo: { activo: true },
  yape: { activo: true, numero: '', titular: '' },
  plin: { activo: true, numero: '', titular: '' },
  transferencia: { activo: true, cuenta: '', cci: '', banco: '', titular: '' },
  tarjeta: { activo: true },
};

interface PagosTabProps {
  puedeEditar: boolean;
}

export function PagosTab({ puedeEditar }: PagosTabProps) {
  const [pagos, setPagos] = useState<PagosLocal>(PAGOS_DEFAULT);
  const [original, setOriginal] = useState<PagosLocal | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null);
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);

  const cargarPagos = async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const res = await api.get<PagosLocal>('/admin/local/pagos');
      const formateado: PagosLocal = {
        efectivo: { activo: res.efectivo?.activo ?? true },
        yape: { activo: res.yape?.activo ?? true, numero: res.yape?.numero || '', titular: res.yape?.titular || '' },
        plin: { activo: res.plin?.activo ?? true, numero: res.plin?.numero || '', titular: res.plin?.titular || '' },
        transferencia: {
          activo: res.transferencia?.activo ?? true,
          cuenta: res.transferencia?.cuenta || '',
          cci: res.transferencia?.cci || '',
          banco: res.transferencia?.banco || '',
          titular: res.transferencia?.titular || '',
        },
        tarjeta: { activo: res.tarjeta?.activo ?? true },
      };
      setPagos(formateado);
      setOriginal(JSON.parse(JSON.stringify(formateado)));
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'No se pudieron cargar los medios de pago';
      setErrorCarga(msg);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPagos();
  }, []);

  const hayCambios = useMemo(() => {
    if (!original) return false;
    return JSON.stringify(pagos) !== JSON.stringify(original);
  }, [pagos, original]);

  const handleGuardar = async () => {
    if (!puedeEditar || !hayCambios) return;
    setGuardando(true);
    setErrorGuardar(null);
    try {
      const res = await api.put<PagosLocal>('/admin/local/pagos', pagos);
      const formateado: PagosLocal = {
        efectivo: { activo: res.efectivo?.activo ?? true },
        yape: { activo: res.yape?.activo ?? true, numero: res.yape?.numero || '', titular: res.yape?.titular || '' },
        plin: { activo: res.plin?.activo ?? true, numero: res.plin?.numero || '', titular: res.plin?.titular || '' },
        transferencia: {
          activo: res.transferencia?.activo ?? true,
          cuenta: res.transferencia?.cuenta || '',
          cci: res.transferencia?.cci || '',
          banco: res.transferencia?.banco || '',
          titular: res.transferencia?.titular || '',
        },
        tarjeta: { activo: res.tarjeta?.activo ?? true },
      };
      setPagos(formateado);
      setOriginal(JSON.parse(JSON.stringify(formateado)));
      const ahora = new Date();
      const horaStr = ahora.toLocaleTimeString('es-PE', { hour12: false });
      setMensajeGuardado(`Guardado a las ${horaStr}`);
      setConfirmarAbierto(false);
    } catch (err) {
      const msg =
        err instanceof ErrorApi
          ? err.message
          : 'Error al guardar los medios de pago';
      setErrorGuardar(msg);
      setConfirmarAbierto(false);
    } finally {
      setGuardando(false);
    }
  };

  const handleDescartar = () => {
    if (original) {
      setPagos(JSON.parse(JSON.stringify(original)));
      setErrorGuardar(null);
    }
  };

  if (cargando) {
    return <Cargando mensaje="Cargando medios de pago..." />;
  }

  if (errorCarga) {
    return (
      <EstadoError
        titulo="Error al cargar medios de pago"
        mensaje={errorCarga}
        alReintentar={cargarPagos}
      />
    );
  }

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
            Medios de pago
          </h2>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--cp-soft)',
              margin: '4px 0 0 0',
            }}
          >
            Activa los métodos de pago aceptados y sus números o cuentas públicas de cobro.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {hayCambios ? (
            <Insignia variante="aviso">Cambios sin guardar</Insignia>
          ) : (
            <Insignia variante="neutro">Todo guardado</Insignia>
          )}
          {mensajeGuardado && !hayCambios && (
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
          Modo sólo lectura. No tienes el permiso <b>local/editar</b> para modificar los medios de pago.
        </div>
      )}

      {errorGuardar && (
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
          {errorGuardar}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Efectivo */}
        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: '15px' }}>
              Efectivo
            </div>
            <AyudaBloque id="pagos-pg-efe" />
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={pagos.efectivo.activo}
            aria-label="Aceptar efectivo"
            disabled={!puedeEditar || guardando}
            onClick={() => {
              setPagos({
                ...pagos,
                efectivo: { activo: !pagos.efectivo.activo },
              });
              setMensajeGuardado(null);
            }}
            style={{
              minHeight: '44px',
              padding: '0 20px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-navy)',
              background: pagos.efectivo.activo ? 'var(--cp-navy)' : 'transparent',
              color: pagos.efectivo.activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: '13px',
            }}
          >
            {pagos.efectivo.activo ? 'Activo' : 'Desactivado'}
          </button>
        </div>

        {/* Tarjeta */}
        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: '15px' }}>
              Tarjeta (POS inalámbrico)
            </div>
            <AyudaBloque id="pagos-pg-tarj" />
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={pagos.tarjeta.activo}
            aria-label="Aceptar tarjeta"
            disabled={!puedeEditar || guardando}
            onClick={() => {
              setPagos({
                ...pagos,
                tarjeta: { activo: !pagos.tarjeta.activo },
              });
              setMensajeGuardado(null);
            }}
            style={{
              minHeight: '44px',
              padding: '0 20px',
              borderRadius: '9999px',
              border: '1.5px solid var(--cp-navy)',
              background: pagos.tarjeta.activo ? 'var(--cp-navy)' : 'transparent',
              color: pagos.tarjeta.activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
              fontWeight: 800,
              fontSize: '13px',
            }}
          >
            {pagos.tarjeta.activo ? 'Activo' : 'Desactivado'}
          </button>
        </div>

        {/* Yape */}
        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
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
              <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: '15px' }}>
                Yape
              </div>
              <AyudaBloque id="pagos-pg-yape" />
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={pagos.yape.activo}
              aria-label="Aceptar Yape"
              disabled={!puedeEditar || guardando}
              onClick={() => {
                setPagos({
                  ...pagos,
                  yape: { ...pagos.yape, activo: !pagos.yape.activo },
                });
                setMensajeGuardado(null);
              }}
              style={{
                minHeight: '44px',
                padding: '0 20px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                background: pagos.yape.activo ? 'var(--cp-navy)' : 'transparent',
                color: pagos.yape.activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 800,
                fontSize: '13px',
              }}
            >
              {pagos.yape.activo ? 'Activo' : 'Desactivado'}
            </button>
          </div>

          {pagos.yape.activo && (
            <div style={{ maxWidth: '320px', marginTop: '4px' }}>
              <CampoAyuda id="pagos-yape-numero" etiqueta="Número de celular para Yape" cfgId="pagos-yape" {...propsAyuda('pagos-yape')}>
              <Campo
                value={pagos.yape.numero || ''}
                placeholder="Ej: 9XX XXX XXX"
                disabled={!puedeEditar || guardando}
                onChange={(e) => {
                  setPagos({
                    ...pagos,
                    yape: { ...pagos.yape, numero: e.target.value },
                  });
                  setMensajeGuardado(null);
                }}
              />
              </CampoAyuda>
              <CampoAyuda id="pagos-yape-titular" etiqueta="Nombre del titular de Yape" cfgId="pagos-yape-titular" {...propsAyuda('pagos-yape-titular')}>
              <Campo
                value={pagos.yape.titular || ''}
                placeholder="Ej: Maria Jose Morillo Ruiz"
                disabled={!puedeEditar || guardando}
                onChange={(e) => {
                  setPagos({
                    ...pagos,
                    yape: { ...pagos.yape, titular: e.target.value },
                  });
                  setMensajeGuardado(null);
                }}
              />
              </CampoAyuda>
            </div>
          )}
        </div>

        {/* Plin */}
        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
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
              <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: '15px' }}>
                Plin
              </div>
              <AyudaBloque id="pagos-pg-plin" />
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={pagos.plin.activo}
              aria-label="Aceptar Plin"
              disabled={!puedeEditar || guardando}
              onClick={() => {
                setPagos({
                  ...pagos,
                  plin: { ...pagos.plin, activo: !pagos.plin.activo },
                });
                setMensajeGuardado(null);
              }}
              style={{
                minHeight: '44px',
                padding: '0 20px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                background: pagos.plin.activo ? 'var(--cp-navy)' : 'transparent',
                color: pagos.plin.activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 800,
                fontSize: '13px',
              }}
            >
              {pagos.plin.activo ? 'Activo' : 'Desactivado'}
            </button>
          </div>

          {pagos.plin.activo && (
            <div style={{ maxWidth: '320px', marginTop: '4px' }}>
              <CampoAyuda id="pagos-plin-numero" etiqueta="Número de celular para Plin" cfgId="pagos-plin" {...propsAyuda('pagos-plin')}>
              <Campo
                value={pagos.plin.numero || ''}
                placeholder="Ej: 9XX XXX XXX"
                disabled={!puedeEditar || guardando}
                onChange={(e) => {
                  setPagos({
                    ...pagos,
                    plin: { ...pagos.plin, numero: e.target.value },
                  });
                  setMensajeGuardado(null);
                }}
              />
              </CampoAyuda>
              <CampoAyuda id="pagos-plin-titular" etiqueta="Nombre del titular de Plin" cfgId="pagos-plin-titular" {...propsAyuda('pagos-plin-titular')}>
              <Campo
                value={pagos.plin.titular || ''}
                placeholder="Ej: Maria Jose Morillo Ruiz"
                disabled={!puedeEditar || guardando}
                onChange={(e) => {
                  setPagos({
                    ...pagos,
                    plin: { ...pagos.plin, titular: e.target.value },
                  });
                  setMensajeGuardado(null);
                }}
              />
              </CampoAyuda>
            </div>
          )}
        </div>

        {/* Transferencia bancaria */}
        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-line)',
            borderRadius: '14px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
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
              <div style={{ fontFamily: 'var(--fuente-titulos)', fontWeight: 800, fontSize: '15px' }}>
                Transferencia bancaria
              </div>
              <AyudaBloque id="pagos-pg-transf" />
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={pagos.transferencia.activo}
              aria-label="Aceptar transferencia bancaria"
              disabled={!puedeEditar || guardando}
              onClick={() => {
                setPagos({
                  ...pagos,
                  transferencia: {
                    ...pagos.transferencia,
                    activo: !pagos.transferencia.activo,
                  },
                });
                setMensajeGuardado(null);
              }}
              style={{
                minHeight: '44px',
                padding: '0 20px',
                borderRadius: '9999px',
                border: '1.5px solid var(--cp-navy)',
                background: pagos.transferencia.activo ? 'var(--cp-navy)' : 'transparent',
                color: pagos.transferencia.activo ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 800,
                fontSize: '13px',
              }}
            >
              {pagos.transferencia.activo ? 'Activo' : 'Desactivado'}
            </button>
          </div>

          {pagos.transferencia.activo && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '14px',
                marginTop: '4px',
              }}
            >
              <CampoAyuda id="pagos-banco-nombre" etiqueta="Banco" cfgId="pagos-banco" {...propsAyuda('pagos-banco')}>
              <Campo
                value={pagos.transferencia.banco || ''}
                placeholder="Ej: BCP, Interbank..."
                disabled={!puedeEditar || guardando}
                onChange={(e) => {
                  setPagos({
                    ...pagos,
                    transferencia: {
                      ...pagos.transferencia,
                      banco: e.target.value,
                    },
                  });
                  setMensajeGuardado(null);
                }}
              />
              </CampoAyuda>

              <CampoAyuda id="pagos-cuenta-numero" etiqueta="Número de cuenta bancaria" cfgId="pagos-cuenta" {...propsAyuda('pagos-cuenta')}>
              <Campo
                value={pagos.transferencia.cuenta || ''}
                placeholder="Ej: 191-12345678-0-12"
                disabled={!puedeEditar || guardando}
                onChange={(e) => {
                  setPagos({
                    ...pagos,
                    transferencia: {
                      ...pagos.transferencia,
                      cuenta: e.target.value,
                    },
                  });
                  setMensajeGuardado(null);
                }}
              />
              </CampoAyuda>
              <CampoAyuda id="pagos-cci-numero" etiqueta="CCI (código de cuenta interbancario)" cfgId="pagos-cci" {...propsAyuda('pagos-cci')}>
              <Campo
                value={pagos.transferencia.cci || ''}
                placeholder="Ej: 002 191 000000000000 00"
                disabled={!puedeEditar || guardando}
                onChange={(e) => {
                  setPagos({
                    ...pagos,
                    transferencia: { ...pagos.transferencia, cci: e.target.value },
                  });
                  setMensajeGuardado(null);
                }}
              />
              </CampoAyuda>
              <CampoAyuda id="pagos-transf-titular" etiqueta="Nombre del titular de la cuenta" cfgId="pagos-transf-titular" {...propsAyuda('pagos-transf-titular')}>
              <Campo
                value={pagos.transferencia.titular || ''}
                placeholder="Ej: Maria Jose Morillo Ruiz"
                disabled={!puedeEditar || guardando}
                onChange={(e) => {
                  setPagos({
                    ...pagos,
                    transferencia: { ...pagos.transferencia, titular: e.target.value },
                  });
                  setMensajeGuardado(null);
                }}
              />
              </CampoAyuda>
            </div>
          )}
        </div>
      </div>

      <AyudaBloque id="pagos-guardar" />
      <div
        style={{
          display: 'flex',
          gap: '10px',
          marginTop: '8px',
          flexWrap: 'wrap',
        }}
      >
        <Boton
          type="button"
          variante="primario"
          disabled={!puedeEditar || !hayCambios || guardando}
          cargando={guardando}
          onClick={() => setConfirmarAbierto(true)}
        >
          Guardar medios de pago
        </Boton>

        <Boton
          type="button"
          variante="secundario"
          disabled={!hayCambios || guardando}
          onClick={handleDescartar}
        >
          Descartar
        </Boton>
      </div>

      <Confirmar
        abierto={confirmarAbierto}
        titulo="¿Guardar medios de pago?"
        mensaje="Los clientes verán únicamente los métodos activos durante el proceso de pago."
        textoSi="Sí, guardar"
        textoNo="No, revisar"
        cargando={guardando}
        alConfirmar={handleGuardar}
        alCancelar={() => setConfirmarAbierto(false)}
      />
    </div>
  );
}

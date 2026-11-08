import { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { pedidosApi, type Pedido } from './pedidosApi';
import './corregir-cliente.css';

export interface ModalCorregirClienteProps {
  pedido: Pedido;
  alCerrar: () => void;
  alGuardar: () => void;
}

/** Mensaje en vivo del celular, o '' si está bien (o aún vacío sin tocar). */
export function errorCelular(valor: string): string {
  if (!valor) return 'Escribe el celular del cliente.';
  if (/\D/.test(valor)) return 'Solo números, sin espacios ni guiones.';
  if (!valor.startsWith('9')) return 'El celular debe empezar con 9.';
  if (valor.length < 9) return `Faltan ${9 - valor.length} dígito${9 - valor.length === 1 ? '' : 's'} (son 9).`;
  if (valor.length > 9) return 'Sobran dígitos: el celular tiene 9.';
  return '';
}

const soloDigitos = (v: string) => v.replace(/[\s-]/g, '');

/** «Corregir datos del cliente»: nombre, celular y, en delivery, dirección y referencia. No mueve el punto del mapa. */
export function ModalCorregirCliente({ pedido, alCerrar, alGuardar }: ModalCorregirClienteProps) {
  const esDelivery = String(pedido.modalidad || '').toUpperCase() === 'DELIVERY';
  const celularActual = pedido.cliente_telefono && /^9\d{8}$/.test(pedido.cliente_telefono) && pedido.cliente_telefono !== '999999999' ? pedido.cliente_telefono : '';
  const [nombre, setNombre] = useState(pedido.cliente_nombre ?? '');
  const [celular, setCelular] = useState(celularActual);
  const [direccion, setDireccion] = useState(pedido.entrega_direccion ?? '');
  const [referencia, setReferencia] = useState(pedido.entrega_referencia ?? '');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const errCel = errorCelular(celular);
  const errNombre = nombre.trim().length < 2 ? 'El nombre debe tener al menos 2 letras.' : '';
  const invalido = !!errCel || !!errNombre;

  const guardar = async () => {
    if (invalido) return;
    setEnviando(true);
    setError('');
    try {
      const r = await pedidosApi.corregirCliente(pedido.id, {
        nombre: nombre.trim(),
        telefono: celular,
        ...(esDelivery ? { direccion: direccion.trim(), referencia: referencia.trim() } : {}),
        motivo: motivo.trim() || undefined,
      });
      if (r?.numeroDeCuenta) {
        // Solo informa: la cuenta del cliente no se enlaza ni se cambia
        setAviso(`Guardado. Este número pertenece a ${r.numeroDeCuenta}.`);
        window.setTimeout(alGuardar, 1800);
      } else {
        alGuardar();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los datos.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div onClick={alCerrar} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(11, 44, 62, 0.55)' }} />
      <div role="dialog" aria-modal="true" aria-label="Corregir datos del cliente" className="cc-hoja">
        <div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 22, color: 'var(--cp-navy, #0B2C3E)' }}>
            Corregir datos del cliente
          </div>
          <div style={{ fontSize: 14, color: 'var(--cp-soft, #2C4C5D)', marginTop: 4 }}>Pedido {pedido.codigo}</div>
        </div>

        <div className="cc-actual" aria-label="Datos actuales">
          <strong>Dato actual</strong>
          <span>Nombre: {pedido.cliente_nombre || 'sin nombre'}</span>
          <span>Celular: {celularActual || 'sin celular válido'}</span>
          {esDelivery && <span>Dirección: {pedido.entrega_direccion || 'sin dirección'}</span>}
        </div>

        <div className="cc-grid">
          <label className="cc-campo">
            Nombre del cliente
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} aria-invalid={!!errNombre} autoComplete="off" />
            {errNombre && <span className="cc-error" role="alert">{errNombre}</span>}
          </label>

          <div className="cc-campo">
            <label htmlFor="cc-celular">Celular / WhatsApp</label>
            <div className="cc-fila-cel">
              <input
                id="cc-celular"
                value={celular}
                onChange={(e) => setCelular(soloDigitos(e.target.value))}
                inputMode="numeric"
                maxLength={12}
                placeholder="9XXXXXXXX"
                aria-invalid={!!errCel}
                autoComplete="off"
              />
              <Boton
                variante="secundario"
                type="button"
                deshabilitado={!!errCel}
                onClick={() => window.open(`https://wa.me/51${celular}`, '_blank', 'noopener')}
              >
                Probar en WhatsApp
              </Boton>
            </div>
            {errCel ? <span className="cc-error" role="alert">{errCel}</span> : <span className="cc-ayuda">Número correcto: se puede probar en WhatsApp.</span>}
          </div>

          {esDelivery && (
            <>
              <label className="cc-campo">
                Dirección
                <input value={direccion} onChange={(e) => setDireccion(e.target.value)} maxLength={200} autoComplete="off" />
              </label>
              <label className="cc-campo">
                Referencia
                <input value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={200} autoComplete="off" />
              </label>
              <div className="cc-ancho cc-ayuda">El punto en el mapa no cambia aquí; usa «Ubicar pedido» si hace falta.</div>
            </>
          )}

          <label className="cc-campo cc-ancho">
            Motivo (opcional)
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Corrección por error al escribir el número" autoComplete="off" />
          </label>
        </div>

        {error && <div role="alert" className="cc-error">{error}</div>}
        {aviso && <div role="status" className="cc-ayuda" style={{ fontWeight: 700 }}>{aviso}</div>}

        <div className="cc-acciones">
          <Boton variante="secundario" tamano="grande" onClick={alCerrar}>Cancelar</Boton>
          <Boton tamano="grande" onClick={guardar} deshabilitado={invalido || enviando || !!aviso}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </div>
    </>
  );
}

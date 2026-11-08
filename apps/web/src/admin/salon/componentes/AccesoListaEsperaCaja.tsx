import { useState } from 'react';
import { salonApi } from '../api';
import type { PisoPlano, PisoSalon } from '../tipos';
import { ListaEsperaMesa, useListaEspera } from './ListaEsperaMesa';
import './lista-espera.css';

/**
 * Cabecera de Caja: si hay pedidos esperando mesa, botón «Lista de espera (N)» que abre el panel
 * para asignarles mesa (libre u ocupada con confirmación fuerte). Sin lista, no se ve.
 */
export function AccesoListaEsperaCaja() {
  const espera = useListaEspera();
  const [abierto, setAbierto] = useState(false);
  const [pisos, setPisos] = useState<PisoSalon[]>([]);
  const [planos, setPlanos] = useState<PisoPlano[] | null>(null);

  const cargarMesas = async () => {
    try {
      const [m, p] = await Promise.all([salonApi.obtenerMesas(), salonApi.obtenerPlano().catch(() => null)]);
      setPisos(m?.pisos ?? []);
      setPlanos(p);
    } catch {
      /* sin mesas, el selector avisa que no hay plano */
    }
  };

  if (espera.total === 0 && !abierto) return null;
  return (
    <>
      <button
        type="button"
        className="cj2-btn le-btn le-btn--cabecera"
        data-testid="caja-lista-espera"
        aria-label={`Lista de espera, ${espera.total} esperando mesa`}
        onClick={() => {
          setAbierto(true);
          void cargarMesas();
        }}
      >
        Lista de espera ({espera.total})
      </button>
      {abierto && (
        <div className="le-fondo" role="dialog" aria-modal="true" aria-label="Lista de espera de mesa">
          <div className="le-modal le-modal--ancho">
            <ListaEsperaMesa espera={espera} pisos={pisos} planos={planos} alAsignado={() => void cargarMesas()} />
            <div className="le-modal-acciones">
              <button type="button" className="le-btn" onClick={() => setAbierto(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

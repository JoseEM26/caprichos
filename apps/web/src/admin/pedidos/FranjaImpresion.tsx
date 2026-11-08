import { useCallback, useEffect, useState } from 'react';
import { EstadoAdminImpresion } from '@caprichos/compartido';
import { impresionApi } from '../impresion/impresionApi';
import { useEventos } from '../../comun/socket';
import { IndicadoresMaquinas } from '../impresion/IndicadoresMaquinas';
import type { MaquinasImpresion } from '../impresion/useEstadoMaquinas';

/**
 * Chip de impresión de Pedidos y caja (un solo chip fino con panel Estado / Cola / Instalar).
 * Si hay etiquetas en cola y falla una máquina el chip se pone ámbar con el número y el aviso
 * va dentro del panel (vista Estado). Se revisa al entrar, cada 20 s y en vivo.
 */
export function FranjaImpresion() {
  const [estado, setEstado] = useState<EstadoAdminImpresion | null>(null);

  const cargar = useCallback(async () => {
    try {
      setEstado(await impresionApi.obtenerEstado());
    } catch {
      // sin permiso o sin conexión: no se muestra el chip
      setEstado(null);
    }
  }, []);

  useEffect(() => {
    void cargar();
    const cada = setInterval(() => void cargar(), 20000);
    return () => clearInterval(cada);
  }, [cargar]);

  useEventos('impresion:sin_conexion', cargar);
  useEventos('pedido:nuevo', cargar);
  useEventos('impresion:cola', cargar);
  useEventos('impresion:estado', cargar);

  if (!estado) return null;
  // Respuesta sin detalle por máquina: se deduce del programa y la impresora de Caja
  const lista = estado.agente === 'conectado' && estado.impresora === 'lista';
  const deducida = { conectada: lista, estado: lista ? 'lista' : 'desconectada', motivo: null };
  const maquinas = (estado.impresoras as MaquinasImpresion | undefined) ?? ({ ETIQUETERA: deducida, TICKETERA: deducida } as MaquinasImpresion);

  return <IndicadoresMaquinas maquinas={maquinas} pendientes={estado.pendientes ?? 0} estado={estado} alCambiarCola={cargar} />;
}

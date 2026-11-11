/**
 * Captura de «DNI o RUC» en el panel: detecta por longitud (8 = DNI, 11 = RUC) y consulta al servidor
 * (`/admin/dni`, `/admin/ruc`). Solo ayuda a rellenar: si no hay respuesta se escribe a mano.
 * El nombre de un DNI es dato personal: se muestra, nunca se guarda en el navegador.
 */
import { useEffect, useState } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { rucValido } from '../comprobantes/utilidades';

export type TipoDocumento = 'DNI' | 'RUC';

/** 8 dígitos = DNI; 11 dígitos = RUC (sin validar el dígito verificador); otra cosa = null. */
export function tipoPorLongitud(doc: string): TipoDocumento | null {
  if (/^\d{8}$/.test(doc)) return 'DNI';
  if (/^\d{11}$/.test(doc)) return 'RUC';
  return null;
}

export type ConsultaDocumento =
  | { estado: 'idle' }
  | { estado: 'consultando' }
  | { estado: 'ok'; tipo: 'DNI'; nombre: string }
  | { estado: 'ok'; tipo: 'RUC'; razon: string; direccion: string | null }
  | { estado: 'no_encontrado'; tipo: TipoDocumento }
  | { estado: 'no_disponible'; tipo: TipoDocumento }
  | { estado: 'ruc_invalido' };

/** Texto para el usuario de cada estado que no es éxito. */
export function mensajeConsulta(c: ConsultaDocumento): string | null {
  switch (c.estado) {
    case 'consultando':
      return 'Consultando…';
    case 'no_encontrado':
      return c.tipo === 'DNI' ? 'No encontramos ese DNI. Escribe el nombre a mano.' : 'SUNAT no reconoce este RUC. Revísalo o escribe la razón social a mano.';
    case 'no_disponible':
      return 'El servicio de consulta no está disponible ahora. Escribe los datos a mano.';
    case 'ruc_invalido':
      return 'El RUC no es válido: revisa los números.';
    default:
      return null;
  }
}

/** Una consulta: nunca lanza, devuelve el estado final. */
export async function consultarDocumento(doc: string): Promise<ConsultaDocumento> {
  const tipo = tipoPorLongitud(doc);
  if (!tipo) return { estado: 'idle' };
  if (tipo === 'RUC' && !rucValido(doc)) return { estado: 'ruc_invalido' };
  try {
    if (tipo === 'DNI') {
      const d = await api.get<{ nombre_completo: string }>(`/admin/dni/${doc}`);
      return { estado: 'ok', tipo, nombre: d.nombre_completo };
    }
    const d = await api.get<{ razon_social: string; direccion: string | null }>(`/admin/ruc/${doc}`);
    return { estado: 'ok', tipo, razon: d.razon_social, direccion: d.direccion };
  } catch (e) {
    const codigo = e instanceof ErrorApi ? e.codigo : '';
    if (codigo === 'DNI_NO_ENCONTRADO' || codigo === 'RUC_NO_ENCONTRADO') return { estado: 'no_encontrado', tipo };
    return { estado: 'no_disponible', tipo };
  }
}

/** Consulta sola al completar el documento (8 u 11 dígitos); ignora respuestas de un documento que ya cambió. */
export function useConsultaDocumento(doc: string, activo: boolean): ConsultaDocumento {
  const [c, setC] = useState<ConsultaDocumento>({ estado: 'idle' });
  useEffect(() => {
    const tipo = tipoPorLongitud(doc);
    if (!activo || !tipo) {
      setC({ estado: 'idle' });
      return;
    }
    let vigente = true;
    if (tipo === 'RUC' && !rucValido(doc)) {
      setC({ estado: 'ruc_invalido' });
      return;
    }
    setC({ estado: 'consultando' });
    // Pequeña espera: si el usuario sigue escribiendo o corrige, no se gasta una consulta
    const t = setTimeout(() => consultarDocumento(doc).then((r) => vigente && setC(r)), 350);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [doc, activo]);
  return c;
}

import { useEffect, useRef } from 'react';
import { crearMotor, type Motor } from './escena3d/motor';
import type { ResumenMesero } from './escena3d/director';
import type { PisoVivo, SalonVivo } from './salonVivoApi';

export interface PropsEscena3D {
  piso: PisoVivo;
  datos: SalonVivo | null;
  reducir: boolean;
  ligero: boolean;
  onMotor: (m: Motor | null) => void;
  alMeseros: (m: ResumenMesero[]) => void;
  onError: (e: Error) => void;
}

/** Lienzo 3D (Three.js a pelo). Se carga con React.lazy solo al abrir el módulo; se rehace si cambia el plano o el modo ligero. */
export default function Escena3D({ piso, datos, reducir, ligero, onMotor, alMeseros, onError }: PropsEscena3D) {
  const contRef = useRef<HTMLDivElement>(null);
  const lienzoRef = useRef<HTMLCanvasElement>(null);
  const capaRef = useRef<HTMLDivElement>(null);
  const motorRef = useRef<Motor | null>(null);
  const datosRef = useRef(datos);
  datosRef.current = datos;
  const aplicado = useRef<SalonVivo | null>(null);
  const cbs = useRef({ onMotor, alMeseros, onError });
  cbs.current = { onMotor, alMeseros, onError };
  // El plano se vuelve a dibujar solo si de verdad cambió algo
  const firma = JSON.stringify([piso.id, piso.cuadriculaAncho, piso.cuadriculaAlto, piso.elementos.map((e) => [e.id, e.tipo, e.nombre, e.x, e.y, e.ancho, e.alto, e.asientos, e.activo])]);

  useEffect(() => {
    if (!contRef.current || !lienzoRef.current || !capaRef.current) return;
    let motor: Motor | null = null;
    try {
      motor = crearMotor({ piso, contenedor: contRef.current, lienzo: lienzoRef.current, capa: capaRef.current, reducir, ligero, alMeseros: (m) => cbs.current.alMeseros(m) });
    } catch (e) {
      cbs.current.onError(e instanceof Error ? e : new Error('No se pudo crear la escena 3D'));
      return;
    }
    motorRef.current = motor;
    cbs.current.onMotor(motor);
    if (datosRef.current) { aplicado.current = datosRef.current; motor.actualizar(datosRef.current); }
    return () => {
      motor?.destruir();
      motorRef.current = null;
      cbs.current.onMotor(null);
    };
  }, [firma, reducir, ligero]);

  useEffect(() => {
    if (!datos || datos === aplicado.current) return;
    aplicado.current = datos;
    motorRef.current?.actualizar(datos);
  }, [datos]);

  return (
    <div ref={contRef} className="sv-lienzo-caja">
      <canvas ref={lienzoRef} className="sv-lienzo" aria-label="Salón de Caprichos en 3D" />
      <div ref={capaRef} className="sv-capa" />
    </div>
  );
}

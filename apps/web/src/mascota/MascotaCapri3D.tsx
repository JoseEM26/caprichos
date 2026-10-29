import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  construirCapri,
  aplicarPoseCapri,
  liberarCapri,
  type PiezasCapri,
} from './construirCapri';
import {
  POSE_INICIAL,
  calcularPoseObjetivo,
  interpolarPose,
  crearControlParpadeo,
  calcularParpadeo,
  type EstadoCapri,
  type PoseCapri,
} from './animaciones';
import { crearRendererWebGL } from './crearRendererWebGL';
import type { AspectoCapri } from './tiposAspecto';

export interface MascotaCapri3DProps {
  estado?: EstadoCapri;
  tamano?: number;
  className?: string;
  alHacerClic?: () => void;
  onError?: (error: Error) => void;
  aspecto?: AspectoCapri;
}

/**
 * Componente interno 3D con Three.js a pelo (sin react-three-fiber).
 * Diseñado para ser cargado de forma diferida (React.lazy).
 */
export default function MascotaCapri3D({
  estado = 'reposo',
  tamano = 160,
  className = '',
  alHacerClic,
  onError,
  aspecto,
}: MascotaCapri3DProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const estadoRef = useRef<EstadoCapri>(estado);
  estadoRef.current = estado;
  const aspectoSerializado = aspecto ? JSON.stringify(aspecto) : '';

  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return;

    let animacionId: number | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let piezas: PiezasCapri | null = null;
    let observador: IntersectionObserver | null = null;
    let estaVisible = true;

    try {
      // 1. Escena y Cámara con perspectiva amable
      const scene = new THREE.Scene();
      const aspect = 1; // Relación cuadrada para el avatar
      const camera = new THREE.PerspectiveCamera(34, aspect, 0.1, 50);
      camera.position.set(0, 0.2, 5.5);
      camera.lookAt(0, 0.18, 0);

      // 2. Renderer Three.js optimizado
      renderer = crearRendererWebGL({
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(tamano, tamano);
      renderer.setClearColor(0x000000, 0);

      const canvas = renderer.domElement;
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      contenedor.appendChild(canvas);

      // 3. Iluminación cálida estilo Pixar
      const luzAmbiente = new THREE.AmbientLight(0xfff5ea, 1.3);
      scene.add(luzAmbiente);

      // Luz principal cálida frontal/lateral
      const luzPrincipal = new THREE.DirectionalLight(0xffecd2, 1.8);
      luzPrincipal.position.set(2.5, 4.0, 3.5);
      scene.add(luzPrincipal);

      // Luz de relleno suave azulada
      const luzRelleno = new THREE.DirectionalLight(0xaad0f0, 0.65);
      luzRelleno.position.set(-2.5, 1.5, 2.0);
      scene.add(luzRelleno);

      // Luz de borde (rim light) dorada para resaltar la silueta
      const luzBorde = new THREE.DirectionalLight(0xd99e39, 1.1);
      luzBorde.position.set(-2.0, 3.0, -3.0);
      scene.add(luzBorde);

      // 4. Construcción procedural del personaje
      piezas = construirCapri(aspecto);
      scene.add(piezas.raiz);

      // 5. Estado de animación
      let poseActual: PoseCapri = { ...POSE_INICIAL };
      const controlParpadeo = crearControlParpadeo(0);
      const puntero = { x: 0, y: 0 };
      let ultimoTiempo = performance.now() * 0.001;
      let tiempoAcumulado = 0;

      // Seguimiento suave del puntero del mouse
      const manejarMovimientoMouse = (e: MouseEvent) => {
        const rect = contenedor.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const centroX = rect.left + rect.width / 2;
          const centroY = rect.top + rect.height / 2;
          // Normalizar entre -1 y 1 respecto al centro del personaje
          puntero.x = Math.max(-1, Math.min(1, (e.clientX - centroX) / (window.innerWidth / 2)));
          puntero.y = Math.max(-1, Math.min(1, (e.clientY - centroY) / (window.innerHeight / 2)));
        }
      };

      const manejarMouseLeave = () => {
        puntero.x = 0;
        puntero.y = 0;
      };

      window.addEventListener('mousemove', manejarMovimientoMouse, { passive: true });
      contenedor.addEventListener('mouseleave', manejarMouseLeave);

      // 6. Bucle de renderizado
      const animar = () => {
        if (!renderer || !piezas) return;

        const ahora = performance.now() * 0.001;
        const delta = Math.min(ahora - ultimoTiempo, 0.1);
        ultimoTiempo = ahora;

        if (estaVisible && document.visibilityState !== 'hidden') {
          tiempoAcumulado += delta;

          // Parpadeo aleatorio
          const parpadeo = calcularParpadeo(tiempoAcumulado, controlParpadeo);

          // Cálculo de pose objetivo e interpolación suave (lerp amortiguado)
          const poseObjetivo = calcularPoseObjetivo(estadoRef.current, tiempoAcumulado, {
            puntero,
            parpadeoForzado: parpadeo,
          });

          // Factor de transición (lerp a ~10 Hz para suavidad sedosa sin saltos)
          const factorLerp = Math.min(1, delta * 9.5);
          poseActual = interpolarPose(poseActual, poseObjetivo, factorLerp);

          // Aplicar la pose al modelo 3D y renderizar
          aplicarPoseCapri(piezas, poseActual);
          renderer.render(scene, camera);
        }

        animacionId = requestAnimationFrame(animar);
      };

      // Iniciar el bucle de animación
      animacionId = requestAnimationFrame(animar);

      // 7. Pausar cuando no es visible (IntersectionObserver y Visibility API)
      if (typeof IntersectionObserver !== 'undefined') {
        observador = new IntersectionObserver(
          (entradas) => {
            const entrada = entradas[0];
            estaVisible = entrada ? entrada.isIntersecting : true;
          },
          { threshold: 0.05 }
        );
        observador.observe(contenedor);
      }

      const manejarVisibilidadPestana = () => {
        if (document.visibilityState !== 'hidden') {
          ultimoTiempo = performance.now() * 0.001;
        }
      };
      document.addEventListener('visibilitychange', manejarVisibilidadPestana);

      // Limpieza exhaustiva al desmontar
      return () => {
        if (animacionId !== null) {
          cancelAnimationFrame(animacionId);
        }
        window.removeEventListener('mousemove', manejarMovimientoMouse);
        contenedor.removeEventListener('mouseleave', manejarMouseLeave);
        document.removeEventListener('visibilitychange', manejarVisibilidadPestana);

        if (observador) {
          observador.disconnect();
        }

        if (piezas) {
          scene.remove(piezas.raiz);
          liberarCapri(piezas);
        }

        if (renderer) {
          renderer.dispose();
          if (canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
          }
        }
      };
    } catch (err) {
      if (onError && err instanceof Error) {
        onError(err);
      }
      return () => {};
    }
  }, [tamano, onError, aspectoSerializado]);

  return (
    <div
      ref={contenedorRef}
      role="img"
      aria-label="Capri, la asistente de Caprichos"
      className={`capri-3d-contenedor capri-estado-${estado} ${className}`}
      style={{
        width: tamano,
        height: tamano,
        maxWidth: '100%',
        display: 'inline-block',
        position: 'relative',
        userSelect: 'none',
        cursor: alHacerClic ? 'pointer' : 'default',
      }}
      onClick={alHacerClic}
    />
  );
}

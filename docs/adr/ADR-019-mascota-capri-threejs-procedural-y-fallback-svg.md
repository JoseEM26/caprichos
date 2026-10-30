---
id: ADR-019
tipo: adr
titulo: "Mascota institucional Capri con Three.js 3D procedural y respaldo accesible 2D SVG"
estado: draft
producto: caprichos
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: 2026-10-27
relacionados: [ADR-001, ADR-018]
tags: [adr, frontend, threejs, 3d, svg, accesibilidad, mascota, capri]
---

# ADR-019: Mascota institucional Capri con Three.js 3D procedural y respaldo accesible 2D SVG

- **Estado:** borrador (draft — la IA propone; aprueba y firma el líder técnico)
- **Relacionado con:** **ADR-001** (Monolito modular NestJS/React) y **ADR-018** (Asistente de ayuda Capri).
- **Fecha:** 2026-10-27

---

## 1. Contexto

Para consolidar la identidad visual de Caprichos y humanizar la interacción tanto en el asistente de ayuda del panel administrativo como en la experiencia de la carta digital, se definió la creación del personaje y mascota oficial de la marca: "Capri".

El diseño técnico de este elemento visual enfrentaba desafíos específicos:
1. **Rendimiento y peso del paquete web:** La aplicación web es utilizada en terminales móviles de mozo con hardware limitado y conexiones celulares. Incorporar motores de animación pesados o archivos de modelos 3D externos (como archivos GLTF/GLB de varios megabytes) degradaría drásticamente la velocidad de carga inicial de la carta y del panel.
2. **Compatibilidad y accesibilidad universal:** No todos los dispositivos en operación cuentan con aceleración de hardware WebGL activa, y ciertos usuarios requieren o prefieren interfaces estáticas con baja estimulación visual (*prefers-reduced-motion*).
3. **Consistencia en diseño y personalidad:** El cliente solicitó características visuales representativas y cálidas que debían mantenerse fieles tanto en la versión tridimensional interactiva como en las representaciones gráficas bidimensionales.

---

## 2. Opciones evaluadas

| Opción | Por qué no | Qué la haría reconsiderar |
|---|---|---|
| **Elegida:** **Three.js procedural en 3D con carga diferida (`lazy`) + componente SVG 2D de respaldo automático** | — | Necesidad de cinemáticas hiperrealistas complejas no viables proceduralmente. |
| **Modelos 3D descargables (GLTF / GLB / FBX)** | Archivos pesados (1 a 5 MB adicionales de descarga por red), peticiones HTTP adicionales y lentitud de renderizado en dispositivos modestos. | Disponer de CDN dedicada y modelos ultracomprimidos bajo 50 KB con texturas unificadas. |
| **Imágenes estáticas rasterizadas (PNG / WebP)** | Cero capacidad de animación fluida, falta de interactividad con el cursor y mala adaptación a diferentes densidades de píxeles o modos de pantalla. | Si la mascota solo fuera un logotipo decorativo sin estados interactivos. |
| **Animaciones en video o formato GIF** | Alto peso en bytes, pixelado en pantallas de alta resolución, consumo continuo de CPU en bucle y falta de interactividad por eventos. | Pantallas de bienvenida publicitarias estáticas sin interacción de usuario. |

---

## 3. Decisión

1. **Construcción 3D Procedural en Memoria (`apps/web/src/mascota/construirCapri.ts`):**
   - El modelo 3D del personaje se genera íntegramente mediante geometrías matemáticas primitivas de Three.js (esferas, cilindros, conos y curvas de Bézier), ensambladas dinámicamente mediante código TypeScript.
   - No requiere descargar ningún archivo de malla ni texturas externas a través de la red, garantizando descarga instantánea y cero peticiones de red adicionales para el renderizado.

2. **Carga Diferida Obligatoria (*Lazy Loading*):**
   - El componente 3D (`MascotaCapri3D.tsx`) se importa dinámicamente mediante `lazy(() => import('./MascotaCapri3D'))` envuelto en un límite `Suspense` en `MascotaCapri.tsx`.
   - La librería Three.js queda aislada en un segmento (*chunk*) de código independiente, impidiendo que su peso afecte el tiempo de carga del paquete principal (*bundle*) de la carta web o del panel administrativo.

3. **Componente de Respaldo Accesible 2D SVG (`CapriFallback.tsx`):**
   - Implementación vectorial pura en SVG que reproduce con fidelidad los rasgos y estados del personaje.
   - Se activa de forma automática e inmediata en los siguientes escenarios:
     a) Ausencia de soporte WebGL en el navegador (`!tieneSoporteWebGL()`).
     b) Activación de preferencia de accesibilidad del sistema para movimiento reducido (`prefers-reduced-motion`).
     c) Ocurrencia de cualquier error o excepción durante la inicialización del contexto gráfico 3D (`huboFallo3D`).
     d) Cuando el componente se invoque con la propiedad `forzarFallback2D={true}` para entornos que requieran máxima ligereza.

4. **Siete Estados Emocionales y de Animación (`apps/web/src/mascota/animaciones.ts`):**
   - Se implementaron 7 estados predefinidos con poses e interpolaciones matemáticas:
     1. `reposo`: pose base neutra con parpadeo periódico natural y balanceo suave.
     2. `saludando`: elevación y oscilación de brazo para bienvenida.
     3. `pensando`: inclinación de cabeza, mirada hacia arriba e indicación de procesamiento.
     4. `hablando`: gesticulación y sincronización visual de apertura bucal al entregar respuestas.
     5. `contento`: rebote jovial, ojos sonrientes y brillo de satisfacción.
     6. `confundido`: rotación asimétrica de cabeza y ceño de interrogación ante entradas no reconocidas.
     7. `dormido`: ojos cerrados y respiración acompasada en estados de inactividad prolongada.
   - La lógica de animación, interpolación y poses está completamente desacoplada del motor de render, permitiendo pruebas unitarias sin dependencias de DOM ni contextos gráficos.

5. **Alineación con los Criterios de Diseño del Cliente:**
   - Atendiendo a las solicitudes explícitas de personalización del dueño:
     - Personaje definido como una **chef mujer** joven y cordial.
     - Gorro de chef blanco con volumen y copa esponjosa, estructurado con una banda sobre la coronilla claramente separada de la cabeza y detalle de moñito naranja.
     - Rostro redondeado color piel con orejitas delineadas, mejillas rosadas y pestañas finas en la mirada.
     - Cabello castaño con flequillo recto y dos colitas laterales adornadas con moñitos.
     - Uniforme de cocina en los colores oficiales de Caprichos (chaquetilla naranja y negro con ribetes dorados).

6. **Herramienta de Diagnóstico Interno (`/mascota`):**
   - Se habilitó la página oculta `/mascota` (`PaginaMascota.tsx`) para pruebas de diseño y control de calidad.
   - Permite al equipo evaluar interactivamente los 7 estados, probar escalados desde 60 px hasta 320 px, forzar conmutación entre 3D y 2D SVG, y validar la fluidez de animaciones antes de su despliegue.

---

## 4. Consecuencias

### Positivas
- **Identidad de marca cercana:** Genera empatía y dinamismo en la interacción con la carta y el asistente administrativo.
- **Eficiencia extrema:** Cero megabytes de descargas de modelos 3D y nulo impacto en el bundle principal.
- **Resiliencia y accesibilidad total:** Ningún usuario o dispositivo queda excluido gracias al respaldo automático e imperceptible en SVG accesible.
- **Testeabilidad:** Lógica de estados y animación 100% cubierta con pruebas automatizadas (`animaciones.ts`).

### Negativas / Mitigaciones
- **Mantenimiento en espejo:** Todo cambio estético requiere actualizar coordinadamente la geometría procedural en `construirCapri.ts` y las rutas vectoriales en `CapriFallback.tsx`. *Mitigación:* La página oculta `/mascota` permite la verificación visual inmediata lado a lado de ambas representaciones.

---

## 5. Datos (Gobierno de Datos - Puerta F4)

- **Entidades afectadas:** Ninguna. Se trata de componentes de interfaz y lógica visual que no persisten información en bases de datos.
- **Privacidad:** Totalmente inocuo respecto a datos personales; no emite telemetría ni cookies hacia terceros.

---

*Generado por IA: Borrador formal según especificación de docs-contrato.txt y directrices del proyecto Caprichos — Revisado por: (pendiente) — Aprueba: Technical Lead*

import * as THREE from 'three';

export function crearRendererWebGL(opciones?: THREE.WebGLRendererParameters): THREE.WebGLRenderer {
  return new THREE.WebGLRenderer(opciones);
}

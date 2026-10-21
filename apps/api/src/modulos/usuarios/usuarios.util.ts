import * as crypto from 'crypto';

/**
 * Enmascara un DNI mostrando los primeros 2 y últimos 2 dígitos (ej. 12****78).
 */
export function enmascararDni(dni: string): string {
  if (!dni || typeof dni !== 'string') {
    return '****';
  }
  const limpio = dni.trim();
  if (limpio.length < 4) {
    return '****';
  }
  return `${limpio.slice(0, 2)}****${limpio.slice(-2)}`;
}

/**
 * Genera una contraseña aleatoria de 12 caracteres alfanuméricos con caracteres especiales.
 */
export function generarClaveAleatoria(longitud: number = 12): string {
  const minusculas = 'abcdefghjkmnpqrstuvwxyz';
  const mayusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const numeros = '23456789';
  const especiales = '!@#$%&*';
  const todos = minusculas + mayusculas + numeros + especiales;

  const seleccion = [
    minusculas[crypto.randomInt(minusculas.length)],
    mayusculas[crypto.randomInt(mayusculas.length)],
    numeros[crypto.randomInt(numeros.length)],
    especiales[crypto.randomInt(especiales.length)],
  ];

  for (let i = 4; i < longitud; i++) {
    seleccion.push(todos[crypto.randomInt(todos.length)]);
  }

  // Mezclar con Fisher-Yates
  for (let i = seleccion.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [seleccion[i], seleccion[j]] = [seleccion[j], seleccion[i]];
  }

  return seleccion.join('');
}

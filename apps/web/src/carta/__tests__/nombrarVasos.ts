import { fireEvent } from '@testing-library/react';

/** Los nombres de vaso son obligatorios: escribe uno en cada campo de vaso (Ana1, Ana2…). */
export function nombrarVasos(nombre = 'Ana'): void {
  document.querySelectorAll<HTMLInputElement>('[id^="nombre-bebida-"]').forEach((el, i) => fireEvent.change(el, { target: { value: `${nombre}${i + 1}` } }));
}

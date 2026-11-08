import { fireEvent } from '@testing-library/react';

/** «Con cuánto paga» es obligatorio en efectivo: si el campo está en pantalla, lo llena (monto holgado). */
export function llenarPagaCon(monto = '500') {
  const campo = document.querySelector<HTMLInputElement>('#plan-paga-con');
  if (campo) fireEvent.change(campo, { target: { value: monto } });
}

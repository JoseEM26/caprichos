import { Page, expect } from '@playwright/test';

/**
 * Helper que interactúa con los diálogos modales de confirmación (<Confirmar /> / [role="dialog"]).
 * Por defecto pulsa el botón de confirmación ("Sí, ...", "Confirmar", etc.).
 * Si se pasa opcion = 'no', pulsa el botón de cancelación ("No, ...", "Cancelar", etc.).
 */
export async function confirmarSiNo(
  page: Page,
  opcion: 'si' | 'no' = 'si',
  timeoutMs: number = 5000,
): Promise<void> {
  const dialogs = page.locator('[role="dialog"]');
  await dialogs.first().waitFor({ state: 'visible', timeout: timeoutMs });

  const count = await dialogs.count();
  let dialog = dialogs.last();

  // Si hay más de un diálogo modal abierto (ej. Confirmar sobre un formulario modal),
  // seleccionar el diálogo superior que contenga botones de confirmación (Sí / No / Confirmar)
  if (count > 1) {
    for (let i = count - 1; i >= 0; i--) {
      const d = dialogs.nth(i);
      const botonesConfirmacion = await d.locator('button:has-text("Sí"), button:has-text("Confirmar"), button:has-text("No,")').count();
      if (botonesConfirmacion > 0) {
        dialog = d;
        break;
      }
    }
  }

  if (opcion === 'si') {
    // Buscar botones afirmativos habituales en el sistema
    const botonSi = dialog.locator(
      'button:has-text("Sí"), button:has-text("Confirmar"), button:has-text("Aceptar"), button:has-text("Guardar"), button:has-text("Cobrar")',
    ).first();

    if (await botonSi.isVisible()) {
      await botonSi.click();
    } else {
      // Fallback: el último botón del diálogo suele ser la acción afirmativa
      const botones = dialog.locator('button');
      const count = await botones.count();
      if (count > 0) {
        await botones.nth(count - 1).click();
      } else {
        throw new Error('No se encontró botón afirmativo dentro del diálogo modal');
      }
    }
  } else {
    // Buscar botones de cancelación o descarte
    const botonNo = dialog.locator(
      'button:has-text("No"), button:has-text("Cancelar"), button:has-text("Descartar"), button:has-text("Revisar")',
    ).first();

    if (await botonNo.isVisible()) {
      await botonNo.click();
    } else {
      // Fallback: el primer botón del diálogo suele ser la acción secundaria/cancelar
      const botones = dialog.locator('button');
      if ((await botones.count()) > 0) {
        await botones.first().click();
      } else {
        throw new Error('No se encontró botón de cancelación dentro del diálogo modal');
      }
    }
  }

  // Esperar a que el modal se cierre (salvo si la acción abre otra cosa)
  await dialog.waitFor({ state: 'hidden', timeout: timeoutMs }).catch(() => {});
}

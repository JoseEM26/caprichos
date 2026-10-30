import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { SupervisorCodigoGuard } from './supervisor-codigo.guard';

export const CLAVE_REQUIERE_CODIGO_SUPERVISOR = 'requiere_codigo_supervisor';

export interface OpcionesRequiereCodigo {
  condicion?: (req: any) => boolean;
}

export function RequiereCodigoSupervisor(
  accion: string,
  opciones?: OpcionesRequiereCodigo,
) {
  return applyDecorators(
    SetMetadata(CLAVE_REQUIERE_CODIGO_SUPERVISOR, { accion, ...opciones }),
    UseGuards(SupervisorCodigoGuard),
  );
}


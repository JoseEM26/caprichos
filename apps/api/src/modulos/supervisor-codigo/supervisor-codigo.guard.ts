import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupervisorCodigoService } from './supervisor-codigo.service';
import {
  CLAVE_REQUIERE_CODIGO_SUPERVISOR,
  OpcionesRequiereCodigo,
} from './requiere-codigo-supervisor.decorator';

@Injectable()
export class SupervisorCodigoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly supervisorCodigoService?: SupervisorCodigoService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.get<{ accion: string } & OpcionesRequiereCodigo>(
      CLAVE_REQUIERE_CODIGO_SUPERVISOR,
      context.getHandler(),
    );

    if (!meta) {
      return true;
    }

    const req = context.switchToHttp().getRequest();

    // Si tiene condición dinámica (ej: merma sobre cierto umbral), evaluarla
    if (meta.condicion && !meta.condicion(req)) {
      return true;
    }

    // Ya verificado en esta petición
    if (req.codigoSupervisorVerificado) {
      return true;
    }

    const headers = req.headers || {};
    const body = req.body || {};
    const query = req.query || {};

    const codigo =
      headers['x-codigo-supervisor'] ||
      headers['X-Codigo-Supervisor'] ||
      headers['x-pin-supervisor'] ||
      headers['X-Pin-Supervisor'] ||
      body.codigoSupervisor ||
      body.codigo_supervisor ||
      body.codigo ||
      body.pinSupervisor ||
      body.pin_supervisor ||
      query.codigoSupervisor ||
      query.codigo_supervisor ||
      query.codigo ||
      query.pinSupervisor ||
      query.pin_supervisor;

    const ip = (req.ip || headers['x-forwarded-for']) as string | undefined;

    if (!this.supervisorCodigoService) {
      return true;
    }

    // Solo las acciones que exigen código al SUPERVISOR pasan el 8.º argumento (las demás, la llamada de siempre)
    const supervisor = meta.exigeCodigoSupervisor
      ? await this.supervisorCodigoService.verificarYConsumirCodigo(
          codigo,
          req.usuario?.partyId,
          meta.accion,
          ip,
          undefined,
          undefined,
          undefined,
          true,
        )
      : await this.supervisorCodigoService.verificarYConsumirCodigo(codigo, req.usuario?.partyId, meta.accion, ip);

    req.supervisor = supervisor;
    req.codigoSupervisorVerificado = true;

    return true;
  }
}

export interface RespuestaSalud {
    estado: 'ok' | 'error';
    timestamp: string;
    detalles: {
        base: {
            estado: 'conectado' | 'desconectado';
            mensaje?: string;
        };
        redis: {
            estado: 'conectado' | 'desconectado';
            mensaje?: string;
        };
    };
}
export interface RespuestaVersion {
    version: string;
    commit: string;
    ambiente: string;
}
export interface ResumenPedido {
    id: string;
    codigo: string;
    total: number;
    estado: 'PENDIENTE' | 'CONFIRMADO' | 'EN_PREPARACION' | 'LISTO' | 'ENTREGADO' | 'ANULADO';
}
//# sourceMappingURL=index.d.ts.map
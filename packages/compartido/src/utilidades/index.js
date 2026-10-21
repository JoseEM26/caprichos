"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redondearMonto = redondearMonto;
function redondearMonto(monto) {
    return Math.round((monto + Number.EPSILON) * 100) / 100;
}
//# sourceMappingURL=index.js.map
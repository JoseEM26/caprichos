-- Historial: filtro por acción y por quién la hizo, ordenados por fecha.
CREATE INDEX IF NOT EXISTS "ix_auditoria_accion" ON "auditoria"("accion", "en" DESC);
CREATE INDEX IF NOT EXISTS "ix_auditoria_persona" ON "auditoria"("party_id", "en" DESC);

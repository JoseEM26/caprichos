# Línea base de dependencias entre módulos (CI)

`pnpm run check:deps` corre dependency-cruiser sobre `apps/api/src` ignorando las violaciones ya conocidas, guardadas en `.dependency-cruiser-known-violations.json` (raíz). El CI falla solo si aparece una violación NUEVA.

Regla de oro: **el archivo solo puede BAJAR, nunca crecer.** Al limpiar violaciones (p. ej. añadiendo `index.ts` a un módulo), regenera y verifica que no suma líneas:

```
npx depcruise-baseline --config .dependency-cruiser.js apps/api/src
git diff --stat .dependency-cruiser-known-violations.json   # solo borrados
```

La salida es determinista (misma entrada, mismo archivo). Un PR que aumente el archivo debe rechazarse: se corrige el import o, si es una API transversal legítima, se añade una excepción comentada en `.dependency-cruiser.js` con aprobación.

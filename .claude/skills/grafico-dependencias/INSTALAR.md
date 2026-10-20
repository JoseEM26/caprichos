# Skill «grafico-dependencias» (AybarCorp)

Crea el Gráfico de dependencias de un proyecto: épicas, features y HU en orden, qué va en paralelo, por dónde empezar, la ruta hasta cualquier pieza y qué la detiene.

## Instalar (Claude Code)

1. Descomprime este archivo. Queda una carpeta `grafico-dependencias/`.
2. Cópiala en tu carpeta de skills:
   - Linux / Mac: `~/.claude/skills/grafico-dependencias/`
   - Windows: `%USERPROFILE%\.claude\skills\grafico-dependencias\`
3. Reinicia Claude Code. Con `/skills` deberías verla en la lista.

Necesitas `python3` y `node` (v16 o más). Google Chrome es opcional; se usa para revisar cómo se ve el gráfico.

## Usar

Abre Claude Code en la carpeta de tu proyecto y pide, por ejemplo:

> Hazme el gráfico de dependencias de este proyecto

Claude lee la documentación estándar de Aybar (`epicas/`, `features/`, `historias/`, `backlog/tareas/*.json`, `dor/`, `roadmap/`). Si falta algo, te pregunta. Antes de construir te muestra las diferencias que encuentre entre el texto de las HU y el backlog, para que decidas qué incluir. Al final publica el gráfico como artifact (o te deja el HTML si no hay artifacts disponibles).

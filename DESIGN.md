# DESIGN.md - Matemáticas En Tu Bolsillo

Este documento guía a los modelos y agentes IA que trabajen sobre la interfaz de **Matemáticas En Tu Bolsillo**. Su objetivo es mantener una experiencia minimalista, pedagógica, confiable y visualmente atractiva sin romper la lógica existente.

## Principio central

La aplicación se vende por los ojos, pero se queda por la claridad. Todo cambio visual debe hacer que estudiantes, profesores e instituciones entiendan más rápido qué hacer, confíen más en la plataforma y cometan menos errores.

## Reglas obligatorias

1. No cambiar lógica de negocio sin instrucción explícita.
2. No eliminar flujos existentes de autenticación, aulas, exámenes, mensajes, pagos, reportes o roles.
3. No exponer claves API, secretos de Firebase, Wompi, Stitch, Gemini, Resend ni tokens en frontend o repositorio.
4. Todo diseño debe ser responsive para móvil, tablet y escritorio.
5. Evitar elementos recortados, doble scroll innecesario, botones fuera de pantalla y textos partidos.
6. Cada modal debe abrir visible desde el inicio, con scroll interno solo si realmente lo necesita.
7. Si el usuario cierra una ventana pública como login, registro o preguntas frecuentes, al abrirla de nuevo debe iniciar limpia.
8. Mantener accesibilidad: contraste suficiente, foco visible, botones táctiles de mínimo 44px, labels claros y navegación por teclado.
9. Mantener una sola acción principal por bloque visual.
10. Diseñar con intención pedagógica: claridad, calma, progreso visible y retroalimentación comprensible.

## Identidad visual

La plataforma debe transmitir:

- Educación.
- Tecnología.
- Confianza.
- Sencillez.
- Progreso.
- Profesionalismo institucional.

Paleta principal:

- Azul marino: base de marca, títulos, navegación.
- Azul petróleo: acciones principales.
- Turquesa: progreso, confirmaciones, interacción.
- Blanco y grises claros: superficies limpias.
- Amarillo/naranja suave: acentos pedagógicos, alertas positivas o llamados visuales puntuales.

Evitar:

- Páginas saturadas.
- Exceso de sombras.
- Fondos oscuros para contenido académico largo.
- Paletas de un solo color.
- Cards dentro de cards.
- Botones enormes que parezcan desproporcionados en móvil.

## Sistema de interfaz

### Botones

- Acción principal: degradado azul/turquesa, texto claro, alto mínimo 44px.
- Acción secundaria: borde azul, fondo blanco.
- Acción peligrosa: rojo suave, mensaje de confirmación obligatorio.
- En móvil, los botones deben ocupar el ancho necesario sin salirse del contenedor.

### Formularios

- Inputs amplios, claros y con foco visible.
- Mensajes de error siempre en rojo.
- Mensajes de éxito en verde/turquesa.
- Validaciones cerca del campo afectado.
- Si un campo se autocompleta oficialmente, debe quedar bloqueado si el usuario no debe editarlo.

### Modales

- Deben abrir centrados y visibles.
- Deben iniciar con scroll interno arriba.
- Cerrar con equis, clic afuera o acción explícita cuando aplique.
- Al cerrar login, registro o FAQs, limpiar campos y selecciones.

### Menús

- El menú lateral debe ser fácil de leer, con separación generosa.
- Las opciones bloqueadas deben verse bloqueadas, pero sin romper alineación.
- En móvil debe haber espacio lateral suficiente para no pegarse al borde.

### Exámenes

- El estudiante debe ver estado, intentos, tiempo y disponibilidad con claridad.
- La retroalimentación debe respetar publicación del profesor.
- Los estados deben diferenciarse visualmente: programado, disponible, finalizado, bloqueado.

### Profesor e institución

- Paneles administrativos deben ser densos pero ordenados.
- Métricas, reportes, estudiantes y aulas deben priorizar tablas limpias, filtros y exportación.
- Las acciones destructivas requieren confirmación clara.

## Mejora continua con IA

Los agentes IA integrados al proyecto deben trabajar como asistentes de diseño y calidad, no como editores autónomos sin control.

Cada propuesta de IA debe revisar:

1. Claridad del flujo.
2. Carga cognitiva.
3. Consistencia visual.
4. Responsive real.
5. Accesibilidad.
6. Riesgo de romper lógica existente.
7. Cumplimiento de privacidad y seguridad.
8. Compatibilidad con Firebase, GitHub Pages y móvil.

Antes de aplicar cambios, el agente debe responder:

- Qué mejora propone.
- Qué archivos tocaría.
- Qué riesgo tiene.
- Cómo se validará.

## Instrucciones adicionales para modelos IA

- No inventar funcionalidades que no existan.
- No cambiar nombres de colecciones Firebase sin migración explícita.
- No modificar reglas de Firestore o Storage sin explicar impacto.
- No almacenar datos sensibles en `localStorage` si no es estrictamente necesario.
- No usar imágenes pesadas sin optimización.
- No añadir librerías externas innecesarias.
- Si propone una librería visual, justificar peso, licencia y beneficio.
- Si el cambio afecta pagos, autenticación o datos personales, tratarlo como alta prioridad de seguridad.
- Si el cambio afecta exámenes, validar rol, aula, disponibilidad y retroalimentación.
- Mantener lenguaje humano, colombiano, claro y profesional.

## Integración recomendada de Stitch AI

Stitch debe usarse como asesor de diseño mediante MCP o backend seguro. Nunca se debe pegar la API key en archivos públicos.

Configuración MCP recomendada para Codex en un archivo local privado, no versionado:

```toml
[mcp_servers.stitch]
url = "https://stitch.googleapis.com/mcp"

[mcp_servers.stitch.http_headers]
"X-Goog-Api-Key" = "TU_API_KEY_PRIVADA"
```

Uso esperado de Stitch:

- Generar propuestas de layout.
- Evaluar jerarquía visual.
- Sugerir mejoras de botones, formularios, cards y navegación.
- Revisar pantallas móviles.
- Proponer microinteracciones.
- Crear variantes visuales antes de implementar.

Stitch no debe:

- Escribir claves en el repositorio.
- Tomar decisiones de negocio.
- Cambiar reglas de seguridad.
- Reemplazar validaciones backend.
- Modificar datos reales de estudiantes, profesores o instituciones.

## Checklist antes de publicar

- `node --check script.js`
- `git diff --check`
- Revisar móvil: 360px, 390px, 430px.
- Revisar tablet: 768px.
- Revisar escritorio: 1366px o superior.
- Probar login, registro, menú, soporte, exámenes, mensajes y facturación.
- Verificar que no haya doble scroll en sesiones.
- Confirmar que GitHub Pages cargue el cache nuevo de CSS/JS cuando aplique.

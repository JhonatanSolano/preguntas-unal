# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Estudiantes independientes de Colombia y Venezuela que practican matemáticas, presentan exámenes y reciben retroalimentación.
- Estudiantes asociados a instituciones educativas colombianas, con acceso según la suscripción y permisos de su institución.
- Profesores autorizados por instituciones, responsables de aulas, preguntas, exámenes, disponibilidad, retroalimentación, mensajes y reportes.
- Instituciones educativas de Colombia, administradas por rectoría o coordinación, con control de docentes, estudiantes, cupos, suscripción y facturación.
- Dueño de la app, con permisos especiales para administrar instituciones, estudiantes independientes y operaciones globales.

## Product Purpose

Matemáticas En Tu Bolsillo es una plataforma educativa para practicar, evaluar y acompañar el aprendizaje de matemáticas. Reúne aulas, bancos de preguntas, exámenes programados, métricas, reportes, mensajería interna, facturación y asesoría IA en una experiencia web que también debe sentirse cómoda en móvil.

El éxito del producto se mide por claridad de uso, confianza institucional, continuidad de estudio, facilidad para profesores y evidencia académica exportable.

## Positioning

La plataforma combina exámenes matemáticos, aulas con códigos únicos, reportes oficiales, disponibilidad controlada por profesor, retroalimentación publicable, mensajería académica y Asesor IA dentro de un solo flujo educativo pensado para estudiantes de grados 9, 10 y 11, preparación ICFES y admisión universitaria.

## Operating Context

- GitHub Pages sirve la aplicación web pública.
- Firebase sostiene autenticación, Firestore, Storage, Functions, SMS, correos y reglas de seguridad.
- Resend envía correos transaccionales desde dominios de Matemáticas En Tu Bolsillo.
- Wompi se prepara como pasarela de pagos en Colombia.
- La app debe funcionar en computadores, tablets y celulares.
- Los usuarios institucionales dependen de datos de colegios colombianos y códigos DANE.
- Los exámenes dependen de horarios oficiales y zonas horarias por país.

## Capabilities and Constraints

- No romper flujos existentes de login, registro, Google, verificación de correo, verificación de teléfono, aulas, mensajes, exámenes, reportes, pagos, roles y perfiles.
- Las cuentas institucionales ingresan con correo y contraseña; no deben depender de Google.
- Profesores y estudiantes institucionales deben estar autorizados por una institución.
- Estudiantes independientes pertenecen al aula independiente del dueño y pueden tener acceso gratuito limitado al diagnóstico.
- La retroalimentación de exámenes se publica solo cuando el profesor lo decide.
- Los datos sensibles nunca deben quedar expuestos en frontend ni repositorio.
- Cualquier cambio visual debe respetar reglas de Firebase y seguridad backend.

## Brand Commitments

- Nombre oficial: Matemáticas En Tu Bolsillo.
- Logo oficial: monograma MB con identidad azul marino y turquesa.
- Tono: claro, profesional, pedagógico, colombiano y confiable.
- La experiencia debe vender por los ojos sin sacrificar sencillez.
- Correos oficiales: soporte@matematicasentubolsillo.com e info@matematicasentubolsillo.com.

## Evidence on Hand

- `DESIGN.md`: lineamientos visuales y de IA.
- `index.html`, `style.css`, `script.js`: implementación actual de landing, app, roles, menús, modales y flujos.
- `firestore.rules`, `storage.rules`, `functions/`: seguridad y backend.
- `assets/`: logo, catálogos geográficos, colegios e instituciones.
- No inventar testimonios, cifras comerciales, clientes ni resultados reales sin datos suministrados.

## Product Principles

1. Seguridad primero: roles, permisos y datos personales se validan desde backend.
2. Pedagogía clara: cada estudiante debe saber qué puede hacer, qué está bloqueado y cómo avanzar.
3. Control docente: profesores gestionan exámenes, preguntas, reportes, mensajes y retroalimentación con claridad.
4. Confianza institucional: colegios necesitan administración ordenada, legal y escalable.
5. Diseño con propósito: cada pantalla debe ser simple, atractiva y usable en móvil.

## Accessibility & Inclusion

La interfaz debe cumplir buenas prácticas WCAG: contraste suficiente, foco visible, botones táctiles de al menos 44px, textos legibles, navegación por teclado y diseño responsive real para móvil, tablet y escritorio.

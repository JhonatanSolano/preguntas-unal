# Matemáticas En Tu Bolsillo - Agent Guide

## Project Shape
- Main frontend files: `index.html`, `style.css`, `script.js`.
- Firebase backend: `functions/index.js`.
- Security rules: `firestore.rules`, `storage.rules`.
- The app is a single-page Firebase app with role-based flows for independent students, institution students, teachers, institutions, and the platform owner.

## Non-Negotiables
- Do not commit secrets, service-account JSON files, Wompi private keys, Resend keys, Gemini keys, or Firebase Admin credentials.
- Keep Firebase Admin SDK operations in Cloud Functions when a client-side write could bypass quotas, payments, ownership, or role checks.
- Preserve existing user-facing behavior unless the task explicitly asks for a change.
- For design work, improve clarity, spacing, contrast, responsiveness, and accessibility without changing the data model or business logic.

## Business Rules
- Independent students use the `student-annual` plan: $20.000 COP for one year, paid manually through Wompi, with no saved payment methods or automatic renewal.
- Independent students without Premium may access only Aritmética in Aprendizaje and the related Banco principal exams; Asesor IA and internal messages stay locked.
- Institution commerce is frozen: do not sell, display, or create institution plans in public, subscription, billing, privacy, terms, or refund flows until explicitly reactivated.
- Institution member creation and removal must go through `manageInstitutionMembers`; direct client creation of `institutionMembers` is intentionally blocked by Firestore rules.
- The platform owner is `solanojhonatan2000@gmail.com`.
- Institutional teachers and students must match an authorized institution member record.

## Firebase Deployment
- Validate before deploy:
  - `node --check script.js`
  - `node --check functions/index.js`
  - `firebase deploy --only firestore:rules --project preguntas-tipo-examen`
- Function discovery may need a longer timeout:
  - PowerShell: `$env:FUNCTIONS_DISCOVERY_TIMEOUT="120"; firebase deploy --only functions:<name> --project preguntas-tipo-examen`
- GitHub Pages only updates frontend assets; Firestore rules, Storage rules, and Cloud Functions deploy separately.

## Design Direction
- Minimal, modern, pedagogical, and responsive.
- Avoid cramped mobile layouts, clipped buttons, text overflow, and nested cards.
- Use consistent typography, clear hierarchy, restrained gradients, and strong readable contrast.
- Landing page should sell by visual clarity: concise sections, useful motion, and clean calls to action.

## Verification Checklist
- Desktop and mobile layouts must avoid horizontal overflow.
- Login role gates must prevent access with the wrong account type.
- Paid features must remain locked unless the active plan permits them.
- Institution quotas must be enforced by backend transaction, not only by UI.

## Specialized Agent Lanes
- `agente-produccion`: deployment, GitHub Pages, Firebase deploys, DNS checks, environment health and release verification only.
- `agente-pruebas`: syntax checks, regression tests, browser verification, mobile/desktop QA and test evidence only.
- `agente-pagos-wompi`: Wompi checkout, webhooks, payment intents, receipts, billing history and payment security only.
- `agente-suscripciones-reglas`: premium/free entitlements, annual access, expiration, role gates and Firestore rules only.
- `agente-firebase-auth`: Firebase Auth, verification emails, password reset, Google linking, phone verification and legacy login compatibility only.
- `agente-diseno-ui`: visual design, responsive layout, spacing, animation, accessibility and UX polish only.
- `agente-docente-aulas`: teacher dashboards, classrooms, students, exam permissions, reports and institutional requests only.
- `agente-asesor-ia`: AI tutor prompts, eligibility checks, rate limits, response quality and AI safety only.
- `agente-mensajes`: internal messaging, replies, attachments, notifications and email copies only.
- `agente-contenido-aprendizaje`: learning catalog, topics, resources, study progress and free/Premium learning access only.

# Panel Mira — panel.miraleads.pro

Panel de administración único para todos los agentes de Mira (Leads Catálogo).
Sitio estático (sin build): `index.html` + una ficha por agente en `agentes/`.

## Cómo funciona

1. El agente entra a `panel.miraleads.pro/?c=<codigo>` (o escribe su código en el login).
2. El panel lee `agentes/<codigo>.json` → nombre y URL `/exec` del Apps Script de ese agente.
3. Envía el PIN al Apps Script (`autenticar`) y pide `sesion`, que devuelve el **plan** y las
   **funciones activas**. El panel solo dibuja lo que el plan incluye.
4. El Apps Script vuelve a validar el plan en cada acción: ocultar en pantalla es comodidad,
   el bloqueo real está en el servidor.

El plan NO se guarda en este repo. Vive en las Propiedades del script de cada agente:
`PLAN_<LC_TOKEN> = catalogo | crecimiento | fullads`.

## Agregar un agente nuevo

1. Crear su proyecto de Apps Script (código de `plan.gs`, `leads.gs`, etc.), configurar PIN y plan, publicar como aplicación web.
2. Crear `agentes/<codigo>.json`:
   ```json
   { "nombre": "Nombre del agente", "scriptUrl": "https://script.google.com/macros/s/.../exec" }
   ```
3. Usar un código difícil de adivinar, por ejemplo `alejandro-k3x9` (solo minúsculas, números y guiones).
   El código es lo único que protege el nombre y la URL del script, porque el archivo es público en el sitio.
4. Hacer commit. Cloudflare Pages publica solo.

> No hay un `clientes.json` con todos los agentes a propósito: así nadie puede listar a todos los clientes.

## Despliegue (Cloudflare Pages)

- Repo privado en la organización `lc-mira` (por ejemplo `lc-mira/panel`).
- Cloudflare → Workers & Pages → Create → Pages → conectar con GitHub → elegir el repo.
- Build command: (vacío). Build output directory: `/` (la raíz).
- Cada rama y pull request genera una URL de prueba `*.pages.dev`: probar ahí antes de pasar a `main`.
- Dominio: en Pages → Custom domains → `panel.miraleads.pro`. En Hostinger (DNS) crear un CNAME
  `panel` → `<proyecto>.pages.dev`.
- Volver a una versión anterior: Pages → Deployments → Rollback.

## Qué ve cada plan

| | Catálogo | Crecimiento | Full Ads |
|---|---|---|---|
| Inmuebles y ficha para colegas | ✔ | ✔ | ✔ |
| Leads (lista) | ✔ | ✔ | ✔ |
| Etapas y notas de leads | 🔒 | ✔ | ✔ |
| Importar fichas Wasi / Red / Domus | 🔒 | ✔ | ✔ |
| Requerimientos | 🔒 | ✔ | ✔ |
| Eventos de Meta desde el servidor y feed dinámico | 🔒 | 🔒 | ✔ |

Lo último no se ve en el panel: lo aplica el Apps Script.

## Contacto de "Mejorar mi plan"

El número de WhatsApp está en la constante `SOPORTE_WA` al inicio del script de `index.html`.

# ✂ BARBER STUDIO — Sistema de Turnos

Sistema completo de reserva de turnos para barberías: web pública con wizard
de reserva en 6 pasos, gestión de turnos sin cuenta (código + teléfono),
motor de disponibilidad automática y panel administrativo integral.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind v4 · Prisma · SQLite/PostgreSQL · Zod

---

## Características

### Público
- **Landing page** con servicios, barberos y datos del local (todo desde la DB)
- **Wizard de reserva**: servicio → barbero (o "cualquiera") → fecha → horario → datos → confirmación
- **Calendario y horarios calculados en vivo** según horarios laborales, turnos existentes, bloqueos, anticipación mínima y ventana de reserva
- **Código de 6 caracteres** por turno: consultar, reprogramar o cancelar sin registrarse (exige el teléfono usado en la reserva)
- Descarga del turno a **calendario (.ics)** y enlace directo a WhatsApp

### Motor de disponibilidad (`src/lib/availability/engine.ts`)
- Función pura y testeada (20 tests): recibe jornadas, ocupación y bloqueos → devuelve slots válidos
- Soporta **múltiples barberos por slot**, asignación automática ("any") con reintento ante conflicto
- **Triple defensa anti-doble-reserva**: filtrado previo + re-validación dentro de transacción + `Serializable` en Postgres

### Panel admin (`/admin`)
Dashboard con métricas del día · Agenda día/semana con crear-editar-cancelar-reprogramar · Historial de turnos con filtros · Barberos (alta/baja, sin borrar historial) · Servicios · Clientes (autogenerado por teléfono, contacto WhatsApp) · Horarios laborales semanales por barbero · Bloqueos (días libres y franjas) · Configuración (datos, moneda, reglas de agenda, pagos)

### Integraciones (opcionales)
- **WhatsApp**: modo consola por defecto; Meta Cloud API activable con env vars
- **MercadoPago**: preferencias de pago listas; se activa con `MERCADOPAGO_ACCESS_TOKEN`
- **Recordatorios** (24h y 1h antes): endpoint `/api/cron/reminders` protegido por `CRON_SECRET`, pensado para un cron externo

---

## Puesta en marcha

```bash
npm install
npm run db:push      # crea dev.db (SQLite) según prisma/schema.prisma
npm run db:seed      # datos demo: barberos, servicios, horarios, turnos
npm run dev          # http://localhost:3000
```

**Admin:** `http://localhost:3000/admin/login` — credenciales en `.env`
(`ADMIN_EMAIL` / `ADMIN_PASSWORD`, por defecto `admin@barberstudio.com` / `admin123`).

> Windows + PowerShell: usar `npm.cmd` / `npx.cmd` si la política de ejecución bloquea los `.ps1`.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `start` | Build y servidor de producción |
| `npm run db:push` | Sincroniza schema → DB (dev) |
| `npm run db:migrate` | Migraciones (producción) |
| `npm run db:seed` | Recrea datos demo (borra todo antes) |
| `npm run db:studio` | GUI de la base de datos |
| `npm run test:engine` | 20 tests unitarios del motor de disponibilidad |

## Testing E2E

Con el server corriendo:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\smoke-api.ps1
```

19 pruebas sobre la API real: reserva, desaparición de slot, doble reserva (409),
asignación "any", reprogramar/cancelar por código, seguridad del panel.
El suite es **autolimpiante** (cancela sus reservas al final) y determinista.

Scripts auxiliares de diagnóstico en `scripts/`: `repro-manage.mjs`,
`repro-freeslot.mjs`, `repro-smoke-flow.mjs`, `purge-test-data.cjs`,
`inspect-day.cjs`.

---

## Arquitectura

```
src/
├── app/
│   ├── (public)/          # landing, /reservar, /turno/[code]
│   ├── admin/             # login + panel (9 secciones)
│   └── api/               # ~18 endpoints REST finos
├── services/              # LÓGICA DE NEGOCIO (transacciones acá)
├── lib/
│   ├── availability/      # motor puro de slots
│   ├── auth.ts jwt.ts     # sesión httpOnly (cookie bs_session)
│   └── whatsapp.ts payments.ts
├── validations/           # esquemas Zod compartidos front/back
├── components/            # ui kit + público + admin
└── middleware.ts          # guarda de /admin en el edge
```

**Decisiones clave**
- Fechas como strings `"YYYY-MM-DD"` locales (nunca `toISOString()`) y horarios como minutos desde medianoche → inmune a UTC/DST.
- Las rutas API solo validan y delegan; toda escritura vive en `src/services` dentro de `prisma.$transaction`.
- Un solo registro `Settings` (id=1): la config impacta al instante en web y motor.

## Variables de entorno (`.env.example`)

| Variable | Uso |
|---|---|
| `DATABASE_URL` | `file:./dev.db` (SQLite) o URL Postgres |
| `JWT_SECRET` | Firma de sesiones admin |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Usuario inicial (creado por seed) |
| `NEXT_PUBLIC_APP_URL` | Links de notificaciones |
| `CRON_SECRET` | Protege `/api/cron/reminders` |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_ID` | Activa Meta Cloud API |
| `MERCADOPAGO_ACCESS_TOKEN` | Activa cobros online |

## Recordatorios automáticos

Programar un cron externo (cron-job.org, Vercel Cron, crontab):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://TU-DOMINIO/api/cron/reminders
```

Recomendado: cada 15 minutos. Marca `reminder24hAt`/`reminder1hAt` para no duplicar.

---

## Migrar a PostgreSQL (producción)

1. Instalar Docker (+ WSL2 en Windows: `wsl --install`) y levantar:
   ```bash
   docker compose up -d
   ```
2. En `prisma/schema.prisma`: `provider = "postgresql"`
3. `.env`: `DATABASE_URL="postgresql://barber:barber_dev@localhost:5432/turnos_barber"`
4. `npx prisma migrate dev --name init && npm run db:seed`

El motor activa automáticamente `isolationLevel: Serializable` al detectar Postgres.

## Deploy — checklist

- [ ] Build limpio: `npm run build`
- [ ] Migraciones aplicadas (`prisma migrate deploy`)
- [ ] `JWT_SECRET` fuerte y único por entorno
- [ ] Cambiar credenciales admin del seed
- [ ] Cron de recordatorios apuntando a `/api/cron/reminders`
- [ ] (Opcional) tokens de WhatsApp / MercadoPago

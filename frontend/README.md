# Taller Automotriz Córdova

Frontend interno para atención, agenda, órdenes de trabajo, repuestos, cobros, cierres y continuidad del taller. Usa React, TypeScript y Vite. Las acciones consultan el contrato OpenAPI y operan sobre la API FastAPI.

## Ejecutar en Windows

Desde `Project-Taller-Backend`, con PostgreSQL y el archivo `.env` configurados:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m scripts.bootstrap_manager --username gerente --name "Gerente del taller"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Ejecuta el comando de creación del gerente una sola vez, cuando la base todavía no tenga usuarios. El comando pide la contraseña de forma interactiva.

En otra terminal, desde `Project-Taller-Frontend\frontend`:

```powershell
npm.cmd ci
npm.cmd run dev -- --host localhost --port 5173 --strictPort
```

Abre [el frontend](http://localhost:5173/) e ingresa con la cuenta del taller. La URL predeterminada de API es `http://localhost:8000`. Para cambiarla, copia `.env.example` a `.env.local` y edita `VITE_API_URL`. Si cambia el origen del frontend, inclúyelo también en `CORS_ORIGINS` del backend.

## Recorrido

1. Busca al cliente y abre su vehículo para registrar una solicitud.
2. Deriva la solicitud a una cita o a recepción directa y abre la OT.
3. Desde la OT, registra diagnóstico, presupuesto y respuesta del cliente. Una vez autorizado, asigna un responsable y documenta avances, repuestos y pruebas.
4. Registra el aviso de reparación terminada, revisa el saldo y completa el cobro o el compromiso antes de registrar la entrega.
5. Desde Cierres y reportes, revisa el periodo, las diferencias y los identificadores de movimientos. Solo el gerente confirma o reabre el cierre.

Las comunicaciones de cita y OT registran lo que el personal comunicó al cliente. La sesión se conserva por pestaña hasta el cierre de sesión o la caducidad del token.

## Compilación

```powershell
npm.cmd run build
```

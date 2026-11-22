# Fases de implementación del frontend — Taller Automotriz Córdova

## 1. Objetivo y alineación

Construir la interfaz web del taller sobre los seis procesos TO-BE, en correspondencia con `Project-Taller-Backend/FASES_BACKEND_TALLER_CORDOVA.md`. La orden de trabajo (OT) será el eje de navegación entre cliente, vehículo, presupuesto, reparación, repuestos, cobros y entrega.

**Flujo visible:** solicitud → cita opcional → recepción y OT → diagnóstico → presupuesto y autorización → reparación y prueba → cobro o acuerdo → entrega → cierre y reportes.

Este es un **plan de implementación**. El proyecto frontend actual contiene la plantilla inicial React + Vite + TypeScript; las pantallas descritas aquí todavía no están implementadas. Los clientes y proveedores no tendrán portal en la primera versión. La interfaz será para gerente, subgerente y dos técnicos, con acceso eventual de soporte técnico.

## 2. Reglas de diseño e integración

- Usar las mismas fases, códigos P01–P06, estados, permisos y vocabulario del backend. No inventar transiciones, importes ni saldos en el navegador.
- Consumir contratos OpenAPI del backend; acordar rutas, esquemas, errores, paginación y filtros antes de integrar cada pantalla. Si se generan tipos desde OpenAPI, mantenerlos sincronizados con la API.
- Separar páginas, componentes, cliente HTTP, tipos y lógica de presentación por dominio: `auth`, `clientes`, `citas`, `ordenes`, `repuestos`, `pagos`, `cierres` y `reportes`.
- Proteger rutas y ocultar acciones según permisos para mejorar la experiencia; la autorización definitiva siempre la aplica el backend. Tratar `401`, `403`, `409` y errores de validación con mensajes útiles.
- Usar formularios con validación de entrada y estados de carga, vacío, error y éxito. Después de una mutación, mostrar el estado confirmado por el servidor y actualizar los datos visibles.
- Diseñar primero para computadora y uso cómodo en teléfono dentro del taller. Usar tablas legibles, filtros, búsqueda por placa/cliente/OT, botones claros y formularios que eviten volver a escribir datos.
- Mantener accesibilidad básica: etiquetas, navegación con teclado, foco visible, contraste y confirmación comprensible de acciones sensibles.
- Nunca almacenar contraseñas ni información sensible en el código. Definir configuración de URL de API por entorno y estrategia de sesión acordada con el backend.

## 3. Navegación y roles

| Sección | Gerente | Subgerente | Técnico |
| --- | --- | --- | --- |
| Inicio / tareas pendientes | Visión global | Visión operativa | OT asignadas |
| Clientes y vehículos | Consulta y edición | Consulta y edición | Consulta necesaria para atención |
| Solicitudes y citas | Consulta y gestión | Gestión | Gestión si tiene permiso asignado |
| Órdenes de trabajo | Gestión, aprobación y supervisión | Gestión y coordinación | Diagnóstico, avances, repuestos solicitados y pruebas de OT asignadas |
| Compras y repuestos | Aprobación y gestión | Gestión según permiso | Solicitud y consulta de disponibilidad |
| Cobros y saldos | Gestión y supervisión | Gestión | Sin edición económica |
| Cierres y reportes | Confirmación, reapertura y consulta | Revisión y consulta permitida | Sin acceso económico |
| Usuarios y ajustes | Administración | Acceso limitado según permiso | Sin acceso |

Gerente y subgerente también pueden trabajar como responsables de una reparación cuando corresponda. El menú representa funciones autorizadas por el servidor y no crea permisos nuevos.

## 4. Fases del frontend

### Fase 0 — Diseño funcional y base del proyecto

**Alineación backend:** fase 0.

**Entregables:**

- Mapa de pantallas y recorridos de P01–P06; estados de cita, OT, compra, pago y cierre reflejados en la interfaz.
- Estructura React + TypeScript, enrutamiento, diseño base, componentes reutilizables y cliente HTTP centralizado.
- Contratos de integración por pantalla: datos de entrada, respuesta, errores, permisos y acciones disponibles.
- Prototipos de escritorio y móvil para inicio, agenda, listado y detalle de OT, compras, cobros y reportes.
- Componentes compartidos: tabla, filtros, formulario, confirmación, etiquetas de estado, línea de tiempo, mensajes y cargadores.

**Criterio de salida:** cada acción visible corresponde a una transición o endpoint definido; el diseño representa las tres dimensiones de una OT por separado: estado técnico, entrega y saldo.

### Fase 1 — Acceso y estructura por rol

**Alineación backend:** fase 1, identidad y permisos.

**Pantallas:** inicio de sesión, cambio de contraseña según contrato, perfil y estructura principal de navegación.

**Comportamiento:** obtener identidad y permisos desde la API, proteger rutas, mostrar menú y acciones permitidas, gestionar sesión caducada y mensajes de acceso denegado. Evitar que el frontend sugiera que ocultar un botón sustituye el control del servidor.

**Criterio de salida:** gerente, subgerente y técnico ven opciones acordes con sus funciones; una respuesta `403` se comunica sin exponer datos ni dejar la interfaz en un estado engañoso.

### Fase 2 — P01 Clientes, vehículos y solicitudes

**Alineación backend:** fase 2.

**Pantallas:** listado y búsqueda de clientes; ficha de cliente con vehículos e historial; ficha de vehículo; formulario de solicitud; bandeja de solicitudes.

**Comportamiento:** buscar por nombre/documento/teléfono y placa antes de crear; registrar canal WhatsApp, llamada o presencial, motivo y responsable; permitir actualizar datos y derivar la solicitud a cita o recepción directa. Mostrar posibles duplicados señalados por la API.

**Criterio de salida:** un trabajador encuentra al cliente y vehículo y continúa hacia P02 o P03 sin capturar de nuevo la misma información.

### Fase 3 — P02 Agenda de citas

**Alineación backend:** fase 3.

**Pantallas:** agenda diaria/semanal, disponibilidad, nueva cita y detalle de cita.

**Comportamiento:** elegir horario entre alternativas del servidor; registrar, confirmar, reprogramar, cancelar y marcar atendida o `no_asistio`. Ante un conflicto de cupo al guardar (`409`), actualizar alternativas y conservar los datos ya ingresados. Mostrar historial de reprogramaciones.

**Reglas visibles:** la cita representa la visita o recepción; no presentar su fecha como compromiso de entrega. Permitir acceso rápido a recepción sin cita.

**Criterio de salida:** la agenda refleja la capacidad confirmada por el backend y se recupera claramente de reservas simultáneas o de un horario ya ocupado.

### Fase 4 — P03 Órdenes de trabajo, reparación y entrega

**Alineación backend:** fase 4.

**Pantallas:** bandeja de OT con filtros, recepción, detalle de OT, diagnóstico, presupuesto, autorizaciones, asignación, avances, pruebas y entrega.

**Detalle de OT:** encabezado con cliente, vehículo, responsable y fecha estimada; etiquetas separadas de **estado técnico**, **entrega** y **situación financiera**; línea de tiempo con eventos y responsables; secciones de trabajos, repuestos, presupuesto, comunicaciones y cobros.

**Flujo:**

1. Registrar recepción y abrir OT desde una cita o directamente.
2. Permitir al técnico asignado anotar diagnóstico, trabajos y repuestos necesarios.
3. Preparar presupuesto, registrar envío y respuesta del cliente. Mostrar con claridad lo pendiente de autorización.
4. Ante rechazo, registrar motivo y devolución; visualizar cierre sin reparación.
5. Ante autorización, asignar responsable y fecha estimada. Registrar avances diarios y necesidades de repuestos.
6. Para trabajo adicional, crear presupuesto complementario y solicitar nueva autorización antes de mostrar la acción de ejecución.
7. Registrar prueba y resultado; si no es conforme, mostrar tarea de corrección y nueva prueba.
8. Marcar reparación terminada, registrar aviso al cliente, consultar saldo/acuerdo y registrar entrega con fecha real.

**Criterio de salida:** un trabajador puede seguir una OT de inicio a fin sin perder el historial; la interfaz no confunde reparación terminada, vehículo entregado y pago completado.

### Fase 5 — P04 Compras y repuestos

**Alineación backend:** fase 5.

**Pantallas:** solicitudes por OT, aprobación/rechazo, pedidos, proveedores, recepción, existencias y movimientos.

**Comportamiento:** el técnico solicita repuesto desde su OT; dueño autorizado revisa necesidad y costo, aprueba o rechaza con motivo, registra proveedor y pedido. En recepción se introducen cantidades reales, calidad, costo real y diferencias. Mostrar recepción parcial y devoluciones; consultar consumo de repuesto dentro de la OT.

**Reglas visibles:** distinguir `solicitado`, `pedido`, `recibido conforme`, `rechazado` y `consumido`. Un pedido aún no recibido no se muestra como stock disponible. Un cambio que afecta el importe autorizado remite a presupuesto complementario en P03.

**Criterio de salida:** cada repuesto visible en la OT se rastrea hasta su solicitud, compra, recepción y consumo; la interfaz no permite seleccionar como disponible una pieza rechazada.

### Fase 6 — P05 Servicios, adelantos, cobros y saldos

**Alineación backend:** fase 6.

**Pantallas:** resumen económico de OT, registro de pago, historial de movimientos, constancia y compromiso de pago.

**Comportamiento:** mostrar importe autorizado vigente, pagos válidos y saldo calculados por la API; registrar adelantos y abonos con medio y referencia; mostrar constancia generada; registrar compromiso sin sumarlo a cobros. Anular un movimiento solo con permiso, confirmación y motivo.

**Reglas visibles:** evitar enviar un saldo editable; ante pago concurrente o importe mayor al saldo, actualizar resumen y explicar el rechazo. No cambiar automáticamente el estado técnico ni el de entrega al registrar un pago.

**Criterio de salida:** el historial diferencia pagos válidos, anulados y compromisos; el saldo mostrado coincide con la respuesta actual del servidor.

### Fase 7 — P06 Cierre y reportes

**Alineación backend:** fase 7.

**Pantallas:** selección de periodo semanal/mensual, revisión de movimientos y comprobantes, diferencias, confirmación de cierre, historial y reportes.

**Comportamiento:** separar visualmente servicios/importes autorizados, cobros efectivos, saldos, compras y egresos; enlazar cada total con movimientos de origen. Permitir correcciones con evidencia antes del cierre. El gerente confirma y visualiza fecha y responsable; la reapertura exige motivo y se muestra en historial.

**Reglas visibles:** periodo cerrado en modo lectura salvo reapertura autorizada. Si faltan costos, etiquetar el resultado como parcial; no presentar automáticamente ventas menos compras como utilidad neta.

**Criterio de salida:** los totales se pueden verificar desde la pantalla y un periodo cerrado no aparenta admitir edición libre.

### Fase 8 — Comunicaciones, contingencia y piloto

**Alineación backend:** fase 8.

**Pantallas/funciones:** acciones de comunicación desde cita y OT; registro de canal, fecha y responsable; estados de retraso y avisos pendientes; ingreso controlado de operaciones registradas en papel durante una caída, según el contrato de API.

**Comportamiento:** preparar texto para WhatsApp o llamada y registrar su ejecución sin afirmar envío automático cuando aún no exista integración. Mostrar claramente si la API está indisponible; conservar borradores únicamente si el diseño y la seguridad acordados lo permiten. Al reingresar datos, advertir sobre posibles duplicados.

**Piloto:** probar los recorridos reales con gerente, subgerente y dos técnicos; ajustar campos, tiempos de captura, vista móvil y textos de error.

**Criterio de salida:** los cuatro usuarios pueden completar sus tareas principales y el flujo P01–P06 sin instrucciones técnicas ni duplicar registros tras una contingencia.

## 5. Matriz de pantallas y API necesaria

Los nombres siguientes describen **capacidades**, no rutas HTTP definitivas. La URL y el esquema se fijarán con el contrato OpenAPI del backend.

| Vista o acción | Datos que debe entregar la API | Mutaciones que consume |
| --- | --- | --- |
| Inicio | Identidad, permisos, tareas pendientes por rol | Ninguna obligatoria |
| Clientes/vehículos | Búsqueda, ficha e historial | Alta y actualización |
| Solicitudes | Canal, motivo, cliente, vehículo, derivación | Registrar y derivar |
| Agenda | Capacidad, horarios, citas y estados | Crear, confirmar, reprogramar, cancelar, atender, inasistencia |
| OT | Ficha, estados separados, presupuesto, avances, pruebas, historial | Recepción, diagnóstico, autorización, asignación, avances, prueba, terminación y entrega |
| Repuestos | Disponibilidad, solicitudes, pedidos, recepciones, movimientos | Solicitar, aprobar/rechazar, pedir, recibir, devolver, consumir |
| Cobros | Importe autorizado, pagos válidos, saldo, compromisos | Registrar/anular pago y registrar compromiso |
| Cierres | Periodos, movimientos, diferencias, totales y auditoría | Corregir, confirmar y reabrir según permiso |
| Reportes | Resultados semanales y mensuales con desglose | Generación si no es automática |

## 6. Escenarios mínimos de validación de la interfaz

1. Completar solicitud → cita → OT → presupuesto autorizado → reparación → prueba → pago → entrega → cierre.
2. Registrar una atención sin cita y cerrar una OT por presupuesto rechazado.
3. Recibir un conflicto de horario al guardar y seleccionar otra alternativa sin perder datos.
4. Impedir que se muestre como ejecutable un trabajo adicional pendiente de autorización.
5. Mostrar un repuesto pedido pero aún no recibido y una recepción parcial o rechazada.
6. Registrar prueba fallida y mostrar corrección pendiente antes de terminar reparación.
7. Mostrar adelanto, abonos, pago anulado, compromiso y saldo correcto desde la API.
8. Mostrar por separado OT terminada, vehículo no entregado y saldo pendiente.
9. Confirmar un cierre, bloquear su edición ordinaria y mostrar reapertura autorizada.
10. Comprobar escritorio y teléfono; teclado, etiquetas, errores, cargas y estados vacíos.
11. Verificar que un técnico no ve controles económicos y que un `403` del servidor no modifica la vista como si la operación hubiera tenido éxito.

## 7. Orden de trabajo y condición de entrega

`Fase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8`.

Cada fase se integra cuando su contrato de API esté definido. Puede trabajarse con datos simulados para construir una vista mientras avanza el backend, pero se considera terminada solo cuando consume la API real, respeta permisos y estados, maneja errores y supera los escenarios de negocio correspondientes. Los indicadores del PETI se muestran con datos reales del backend y con el total operativo necesario para calcular cobertura sin sesgos.

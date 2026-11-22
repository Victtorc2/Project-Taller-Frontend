import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ApiError, message, query, request, resolve } from './api'
import type { Contract, Method, Row, Schema, User } from './api'

export type Choice = { value: string | number; label: string }
export type ActionSpec = {
  title: string; route: string; path: string; method?: Method; preset?: Row; initial?: Row;
  choices?: Record<string, Choice[]>; hint?: string; confirm?: string; onDone?: (data: Row) => void
}
type Context = { user: User; contract: Contract; revision: number; refresh: () => void; open: (spec: ActionSpec) => void }
export const AppContext = createContext<Context>(null!)
export const useApp = () => useContext(AppContext)
export const manager = (user: User) => user.role === 'gerente' || user.role === 'subgerente'
export const id = (row: Row) => String(row.id)
export const go = (path: string) => { window.location.hash = path }
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', dateStyle: 'short' }).format(new Date())
export function shiftDay(day: string, days: number) {
  const date = new Date(day + 'T12:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const terms: Record<string, string> = {
  id: 'N.º', full_name: 'Nombre completo', username: 'Usuario', phone: 'Teléfono', document: 'Documento',
  email: 'Correo', plate: 'Placa', brand: 'Marca', model: 'Modelo', year: 'Año', status: 'Estado', client_id: 'Cliente',
  vehicle_id: 'Vehículo', request_id: 'Solicitud', order_id: 'Orden de trabajo', technician_id: 'Responsable',
  assigned_to: 'Responsable', starts_at: 'Horario', ends_at: 'Fin', created_at: 'Registro', created_by: 'Registrado por',
  channel: 'Canal', reason: 'Motivo', reception_notes: 'Notas de recepción', diagnosis: 'Diagnóstico',
  proposed_work: 'Trabajos propuestos', amount: 'Importe', description: 'Descripción', kind: 'Tipo', evidence: 'Evidencia',
  estimated_delivery_at: 'Entrega estimada', delivered_at: 'Entrega real', returned_at: 'Devolución real',
  pending_work: 'Trabajo pendiente', quote_id: 'Presupuesto autorizado', passed: 'Prueba conforme', notes: 'Notas',
  approved: 'Aprobado', name: 'Nombre', sku: 'Código SKU', stock: 'Existencias', quantity: 'Cantidad',
  part_id: 'Repuesto', supplier_id: 'Proveedor', estimated_unit_cost: 'Costo unitario estimado', unit_cost: 'Costo unitario',
  actual_unit_cost: 'Costo unitario real', accepted_quantity: 'Unidades conformes', rejected_quantity: 'Unidades rechazadas',
  cost_change_quote_id: 'Presupuesto complementario autorizado', receipt_id: 'Recepción', method: 'Medio de pago',
  reference: 'Referencia', due_date: 'Fecha de vencimiento', valid_payments: 'Pagos válidos', authorized_amount: 'Importe autorizado',
  financial_status: 'Situación financiera', balance: 'Saldo pendiente', void_reason: 'Motivo de anulación',
  frequency: 'Frecuencia', start_date: 'Desde', end_date: 'Hasta', category: 'Categoría', confirmed_at: 'Confirmado el',
  confirmed_by: 'Confirmado por', message: 'Mensaje', active: 'Activo', current_password: 'Contraseña actual',
  new_password: 'Nueva contraseña', password: 'Contraseña', role: 'Rol', process_code: 'Proceso', severity: 'Severidad',
  impact: 'Impacto', temp_code: 'Código temporal', record_type: 'Tipo de registro', target_id: 'Registro digital',
  user_id: 'Trabajador', action_taken: 'Acción tomada', tasks_correct: 'Tareas correctas', tasks_total: 'Tareas evaluadas',
  evaluated: 'Evaluado', occurred_at: 'Ocurrió el', reconciled_entity: 'Tipo de operación digital', reconciled_id: 'Operación digital',
  reconciled_at: 'Conciliado el', resolved_at: 'Resuelto el', voided_at: 'Anulado el', entity_id: 'N.º de operación digital',
  quantity_delta: 'Variación de existencias', part_request_id: 'Solicitud de repuesto', orders_opened: 'OT abiertas',
  vehicles_delivered: 'Vehículos entregados', rejection_reason: 'Motivo de rechazo', return_unrepaired: 'Devolución sin reparación',
  receipt_number: 'Número de constancia', payment_id: 'N.º de pago', tecnico: 'Técnico', diagnostico: 'Diagnóstico', reparacion: 'Reparación', correccion: 'Corrección',
  espera_repuesto: 'En espera de repuesto', espera_autorizacion: 'Pendiente de autorización', no_asistio: 'No asistió',
  recepcion_directa: 'Recepción directa', cerrada_sin_reparacion: 'Cerrada sin reparación', whatsapp: 'WhatsApp',
  valido: 'Válido', received: 'Recibido', action: 'Acción', actor_id: 'Responsable', detail: 'Detalle',
  available: 'Cupos disponibles', capacity: 'Capacidad', resolution: 'Resolución', digital_id: 'Registro digital',
}
export function label(key: string) {
  return terms[key] ?? key.replaceAll('_', ' ').replace(/^./, char => char.toUpperCase())
}
export function money(value: unknown) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(value))
}
export function display(value: unknown, key = ''): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value)) {
    const date = new Date(value.endsWith('Z') || /[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z')
    if (!Number.isNaN(+date)) return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' }).format(date)
  }
  if (/amount|cost|balance|expense|result/.test(key) && /^-?\d+(\.\d+)?$/.test(String(value))) return money(value)
  if (Array.isArray(value)) return value.map(item => display(item)).join(', ') || '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

export function useData<T>(path?: string) {
  const { revision } = useApp()
  const [state, setState] = useState<{ path?: string; data?: T; error?: string; done?: boolean }>({})
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    request<T>(path, 'GET', undefined, controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ path, data, done: true })
    }).catch(error => {
      if (!controller.signal.aborted) setState(old => ({ path, data: old.path === path ? old.data : undefined, error: message(error), done: true }))
    })
    return () => controller.abort()
  }, [path, revision])
  return { data: state.path === path ? state.data : undefined, error: state.path === path ? state.error : undefined, loading: !!path && (state.path !== path || !state.done) }
}

export function Alert({ children, ok = false }: { children: ReactNode; ok?: boolean }) {
  return <div className={'alert ' + (ok ? 'good' : '')} role={ok ? 'status' : 'alert'}>{children}</div>
}
export function Panel({ title, children, tools }: { title: string; children: ReactNode; tools?: ReactNode }) {
  return <section className="panel"><header className="panel-head"><h2>{title}</h2>{tools}</header>{children}</section>
}
export function Button({ children, to, onClick, secondary = false, disabled = false }: {
  children: ReactNode; to?: string; onClick?: () => void; secondary?: boolean; disabled?: boolean
}) {
  const className = 'button ' + (secondary ? 'secondary' : '')
  return to ? <a className={className} href={'#' + to}>{children}</a> :
    <button type="button" className={className} onClick={onClick} disabled={disabled}>{children}</button>
}
export function Action({ spec, secondary = true }: { spec: ActionSpec; secondary?: boolean }) {
  const { open } = useApp()
  return <Button secondary={secondary} onClick={() => open(spec)}>{spec.title}</Button>
}
export function Badge({ value }: { value: unknown }) {
  const name = String(value)
  const tone = /anulad|rechazad|cancelad|correccion|no_asistio/.test(name) ? 'red' :
    /autorizad|terminad|entregad|recibid|atendid|valid|cerrado|resuelto|pagado/.test(name) ? 'green' :
    /pendiente|espera|parcial|borrador/.test(name) ? 'amber' : 'blue'
  return <span className={'badge ' + tone}>{label(name)}</span>
}
export function Summary({ row, fields }: { row: Row; fields: string[] }) {
  return <dl className="summary">{fields.map(key => <div key={key}><dt>{label(key)}</dt><dd>{key === 'status' ? <Badge value={row[key]} /> : display(row[key], key)}</dd></div>)}</dl>
}
export type Column = string | { key: string; title?: string; render: (row: Row) => ReactNode }
export function Table({ rows, columns, actions }: { rows: Row[]; columns: Column[]; actions?: (row: Row) => ReactNode }) {
  if (!rows.length) return <p className="empty">No hay registros para mostrar.</p>
  return <div className="table-wrap"><table><thead><tr>{columns.map(col => <th key={typeof col === 'string' ? col : col.key} scope="col">{typeof col === 'string' ? label(col) : col.title ?? label(col.key)}</th>)}{actions && <th scope="col">Acciones</th>}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={String(row.id ?? row.temp_code ?? index)}>{columns.map(col => <td key={typeof col === 'string' ? col : col.key}>{typeof col !== 'string' ? col.render(row) : col === 'status' ? <Badge value={row[col]} /> : display(row[col], col)}</td>)}{actions && <td><div className="actions">{actions(row)}</div></td>}</tr>)}</tbody></table></div>
}
export function DataState({ state, children }: { state: { loading?: boolean; error?: string }; children: ReactNode }) {
  const { refresh } = useApp()
  return <>{state.error && <Alert>{state.error} <button className="text-button" onClick={refresh}>Reintentar</button></Alert>}{state.loading ? <p className="empty" role="status">Cargando…</p> : children}</>
}
export function DataTable({ path, columns, actions }: { path: string; columns: Column[]; actions?: (row: Row) => ReactNode }) {
  const state = useData<Row[]>(path)
  return <DataState state={state}>{state.data && <Table rows={state.data} columns={columns} actions={actions} />}</DataState>
}
export function Pager({ page, setPage, length, size = 15 }: { page: number; setPage: (n: number) => void; length: number; size?: number }) {
  return <div className="pager"><Button secondary disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button><span>Página {page + 1}</span><Button secondary disabled={length < size} onClick={() => setPage(page + 1)}>Siguiente</Button></div>
}
export function Timeline({ rows }: { rows: Row[] }) {
  if (!rows.length) return <p className="empty">No hay eventos registrados.</p>
  return <ol className="timeline">{rows.map((row, index) => <li key={String(row.id ?? index)}>
    <strong>{label(String(row.action ?? row.status ?? 'Cambio registrado'))}</strong>
    <span>{display(row.created_at ?? row.changed_at ?? row.at)} {row.actor_id != null && '· Usuario ' + row.actor_id}</span>
    <p>{display(row.detail ?? row.notes ?? row.starts_at ?? row.new_starts_at)}</p>
  </li>)}</ol>
}

function inputTime(value: unknown, format?: string) {
  if (format === 'date-time' && typeof value === 'string' && value.includes('T')) {
    const date = new Date(value)
    if (Number.isFinite(+date)) return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' }).format(date).replace(' ', 'T')
  }
  return value == null ? '' : String(value)
}
function Field({ name, schema, required, defaultValue, choices }: { name: string; schema: Schema; required: boolean; defaultValue?: unknown; choices?: Choice[] }) {
  const ownChoices = choices ?? schema.enum?.map(value => ({ value: String(value), label: label(String(value)) })) ??
    (schema.type === 'boolean' ? [{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }] : undefined)
  const initial = choices ? String(defaultValue ?? '') : inputTime(defaultValue, schema.format)
  const title = name === 'starts_at' && choices ? 'Cupo disponible' : label(name)
  return <label className="field"><span>{title}{required && <span aria-hidden="true"> *</span>}</span>
    {ownChoices ? <select name={name} defaultValue={initial} required={required}>
      <option value="">Seleccionar</option>{ownChoices.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
    </select> : (schema.maxLength ?? 0) >= 1000 ? <textarea name={name} defaultValue={initial} required={required} minLength={schema.minLength} maxLength={schema.maxLength} rows={3} /> :
      <input name={name} defaultValue={initial} required={required} minLength={schema.minLength} maxLength={schema.maxLength}
        type={name.includes('password') ? 'password' : schema.format === 'date-time' ? 'datetime-local' : schema.format === 'date' ? 'date' :
          schema.type === 'integer' || schema.type === 'number' || schema.pattern && /amount|cost/.test(name) ? 'number' : name === 'email' ? 'email' : 'text'}
        step={schema.type === 'integer' ? '1' : /amount|cost/.test(name) ? '0.01' : undefined}
        min={schema.minimum ?? (schema.exclusiveMinimum === 0 ? schema.type === 'integer' ? 1 : 0.01 : undefined)} max={schema.maximum}
        autoComplete={name === 'current_password' ? 'current-password' : name.includes('password') ? 'new-password' : undefined} />}
  </label>
}

export function ActionDialog({ spec, close, onSuccess }: { spec: ActionSpec; close: () => void; onSuccess: () => void }) {
  const { contract, refresh } = useApp()
  const dialog = useRef<HTMLDialogElement>(null)
  const busy = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [slots, setSlots] = useState<Choice[] | undefined>()
  const [day, setDay] = useState(() => String(spec.initial?.day ?? today()))
  const key = useRef<{ body: string; value: string } | undefined>(undefined)
  const method = spec.method ?? 'POST'
  const operation = contract.paths['/api/v1' + spec.route]?.[method.toLowerCase() as Lowercase<Method>]
  const schema = operation?.requestBody?.content['application/json']?.schema
  const body = schema ? resolve(contract, schema) : undefined
  const fields = Object.entries(body?.properties ?? {})
  const params = operation?.parameters?.filter(item => item.in === 'query') ?? []
  const usesSlots = spec.route === '/appointments' || spec.route.endsWith('/reschedule')
  const availability = useData<Row[]>(usesSlots ? query('/appointments/availability', { day }) : undefined)
  useEffect(() => { dialog.current?.showModal() }, [])
  const availableChoices = availability.data?.filter(slot => Number(slot.available) > 0)
    .map(slot => ({ value: String(slot.starts_at), label: display(slot.starts_at) + ' · ' + slot.available + ' cupo(s)' }))
  function value(raw: FormDataEntryValue | null, item: Schema, name: string) {
    if (raw === '' || raw == null) return undefined
    if (item.type === 'integer' || item.type === 'number') return Number(raw)
    if (item.type === 'boolean') return raw === 'true'
    if (item.format === 'date-time' && !/(?:[+-]\d\d:\d\d|Z)$/.test(String(raw))) return raw + ':00-05:00'
    if (name.includes('password')) return String(raw)
    return String(raw).trim()
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current || !operation) return
    const form = new FormData(event.currentTarget)
    const payload: Row = {}
    const search: Row = {}
    fields.forEach(([name, item]) => {
      if (name !== 'idempotency_key') payload[name] = spec.preset?.[name] ?? value(form.get(name), resolve(contract, item), name)
    })
    params.forEach(item => { search[item.name] = spec.preset?.[item.name] ?? value(form.get(item.name), resolve(contract, item.schema), item.name) })
    if (fields.some(([name]) => name === 'idempotency_key')) {
      const signature = JSON.stringify(payload)
      if (key.current?.body !== signature) key.current = { body: signature, value: crypto.randomUUID() }
      payload.idempotency_key = key.current.value
    }
    busy.current = true
    setSaving(true)
    setError('')
    try {
      const data = await request<Row>(query(spec.path, search), method, body ? payload : undefined)
      spec.onDone?.(data)
      onSuccess()
    } catch (err) {
      setError(message(err))
      if (err instanceof ApiError && err.status === 409) {
        refresh()
        if (usesSlots) {
          try {
            const rows = await request<Row[]>(query('/appointments/availability', { day }))
            setSlots(rows.filter(slot => Number(slot.available) > 0).map(slot => ({ value: String(slot.starts_at), label: display(slot.starts_at) })))
          } catch { setSlots([]) }
        }
      }
    } finally { busy.current = false; setSaving(false) }
  }
  return <dialog ref={dialog} aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); if (!busy.current) close() }}>
    <form onSubmit={submit}><header className="dialog-head"><h2 id="dialog-title">{spec.title}</h2><button type="button" className="icon-button" aria-label="Cerrar" disabled={saving} onClick={close}>×</button></header>
      {spec.hint && <p className="muted">{spec.hint}</p>}{spec.confirm && <p>{spec.confirm}</p>}
      {error && <Alert>{error}</Alert>}{!operation && <Alert>La API actual no ofrece esta acción.</Alert>}
      {usesSlots && <label className="field"><span>Día de la cita</span><input type="date" value={day} required onChange={event => { setSlots(undefined); setDay(event.target.value) }} /></label>}
      {usesSlots && availability.error && <Alert>{availability.error}</Alert>}
      <div className="form-grid">{fields.filter(([name]) => name !== 'idempotency_key' && !(name in (spec.preset ?? {}))).map(([name, item]) =>
        <Field key={name === 'starts_at' ? name + day : name} name={name} schema={resolve(contract, item)}
          required={body?.required?.includes(name) ?? false} defaultValue={spec.initial?.[name]}
          choices={name === 'starts_at' && usesSlots ? slots ?? availableChoices ?? [] : spec.choices?.[name]} />)}
      {params.filter(item => !(item.name in (spec.preset ?? {}))).map(item =>
        <Field key={item.name} name={item.name} schema={resolve(contract, item.schema)} required={item.required ?? false} choices={spec.choices?.[item.name]} />)}</div>
      {usesSlots && !(slots ?? availableChoices)?.length && <p className="muted">{availability.loading ? 'Consultando disponibilidad…' : 'No hay cupos disponibles este día.'}</p>}
      <footer className="dialog-actions"><Button secondary disabled={saving} onClick={close}>Cancelar</Button><button className="button" disabled={saving || !operation}>{saving ? 'Guardando…' : method === 'GET' ? 'Consultar' : 'Confirmar'}</button></footer>
    </form>
  </dialog>
}
export function choices(rows: Row[] | undefined, name: (row: Row) => string): Choice[] {
  return (rows ?? []).map(row => ({ value: id(row), label: name(row) }))
}

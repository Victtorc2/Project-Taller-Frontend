import { useEffect, useState } from 'react'
import { message, query, request } from './api'
import type { Row } from './api'
import { Action, Alert, Badge, Button, DataState, DataTable, Pager, Panel, Summary, Table, Timeline, choices, display, go, id, manager, shiftDay, today, useApp, useData } from './ui'

const clientLabel = (row: Row) => String(row.full_name) + ' · ' + display(row.document)
const vehicleLabel = (row: Row) => [row.plate, row.brand, row.model].filter(Boolean).join(' ')
const requestLabel = (row: Row) => 'Solicitud #' + row.id + ' · ' + row.reason
export const clientColumn = { key: 'client_id', render: (row: Row) => <a href={'#/clientes/' + row.client_id}>Cliente #{String(row.client_id)}</a> }
export const vehicleColumn = { key: 'vehicle_id', render: (row: Row) => <a href={'#/vehiculos/' + row.vehicle_id}>Vehículo #{String(row.vehicle_id)}</a> }

export function Directory({ vehicles }: { vehicles: boolean }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const root = vehicles ? '/vehicles' : '/clients'
  const local = vehicles ? '/vehiculos' : '/clientes'
  const list = useData<Row[]>(query(root, { q: search, offset: page * 15, limit: 15 }))
  const clients = useData<Row[]>(vehicles ? '/clients?limit=100' : undefined)
  return <Panel title={vehicles ? 'Vehículos registrados' : 'Clientes registrados'} tools={<Action secondary={false} spec={{
    title: vehicles ? 'Nuevo vehículo' : 'Nuevo cliente', path: root, route: root,
    choices: vehicles ? { client_id: choices(clients.data, clientLabel) } : undefined,
    onDone: row => go(local + '/' + id(row)),
  }} />}>
    <div className="filters"><label className="field"><span>{vehicles ? 'Buscar por placa' : 'Buscar por nombre, documento o teléfono'}</span>
      <input type="search" value={search} onChange={event => { setPage(0); setSearch(event.target.value) }} placeholder={vehicles ? 'ABC-123' : 'Nombre, DNI o teléfono'} /></label></div>
    <DataState state={list}>{list.data && <><Table rows={list.data} columns={vehicles ? ['plate', 'brand', 'model', 'year', clientColumn] : ['full_name', 'document', 'phone', 'email']}
      actions={row => <Button secondary to={local + '/' + id(row)}>Ver ficha</Button>} /><Pager page={page} setPage={setPage} length={list.data.length} /></>}</DataState>
  </Panel>
}

function NewRequest({ client, vehicle, vehicles }: { client: unknown; vehicle?: unknown; vehicles?: Row[] }) {
  return <Action secondary={false} spec={{ title: 'Nueva solicitud', route: '/requests', path: '/requests',
    preset: { client_id: client, ...(vehicle != null && { vehicle_id: vehicle }) },
    choices: { vehicle_id: choices(vehicles, vehicleLabel) }, onDone: row => go('/solicitudes/' + id(row)),
  }} />
}

export function ContactDetail({ recordId, vehicles }: { recordId: string; vehicles: boolean }) {
  const { user } = useApp()
  const endpoint = vehicles ? '/vehicles/' + recordId : '/clients/' + recordId
  const person = useData<Row>(endpoint)
  const clientId = vehicles ? person.data?.client_id : recordId
  const garage = useData<Row[]>(!vehicles ? endpoint + '/vehicles' : undefined)
  const history = useData<Row[]>(clientId ? query('/requests', vehicles ? { vehicle_id: recordId, limit: 100 } : { client_id: recordId, limit: 100 }) : undefined)
  const parent = useData<Row>(vehicles && clientId ? '/clients/' + clientId : undefined)
  const row = person.data
  return <DataState state={person}>{row && <>
    <Panel title={vehicles ? vehicleLabel(row) : String(row.full_name)} tools={<div className="actions">
      {(!vehicles || manager(user)) && <Action spec={{ title: 'Editar ficha', method: 'PATCH', route: vehicles ? '/vehicles/{vehicle_id}' : '/clients/{client_id}', path: endpoint,
        initial: row, preset: vehicles ? { client_id: row.client_id } : undefined }} />}
      {vehicles ? <NewRequest client={row.client_id} vehicle={row.id} /> : !!garage.data?.length && <NewRequest client={row.id} vehicles={garage.data} />}
    </div>}>
      <Summary row={row} fields={vehicles ? ['plate', 'brand', 'model', 'year', 'notes'] : ['document', 'phone', 'email', 'active']} />
      {vehicles && parent.data && <a href={'#/clientes/' + clientId}>{String(parent.data.full_name)}</a>}
    </Panel>
    {!vehicles && <Panel title="Vehículos del cliente" tools={<Action spec={{ title: 'Agregar vehículo', path: '/vehicles', route: '/vehicles', preset: { client_id: row.id } }} />}>
      <DataState state={garage}>{garage.data && <Table rows={garage.data} columns={['plate', 'brand', 'model', 'year']}
        actions={item => <Button secondary to={'/vehiculos/' + id(item)}>Ver ficha</Button>} />}</DataState>
    </Panel>}
    <Panel title="Historial de solicitudes"><DataState state={history}>{history.data && <Table rows={history.data.filter(item =>
      vehicles ? String(item.vehicle_id) === recordId : String(item.client_id) === recordId)}
      columns={['id', 'reason', 'channel', 'status', 'created_at']} actions={item => <Button secondary to={'/solicitudes/' + id(item)}>Ver solicitud</Button>} />}</DataState></Panel>
  </>}</DataState>
}

export function Requests() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const state = useData<Row[]>(query('/requests', { status, offset: page * 15, limit: 15 }))
  return <Panel title="Bandeja de solicitudes" tools={<Button to="/clientes">Buscar cliente</Button>}>
    <div className="filters"><label className="field"><span>Estado</span><select value={status} onChange={event => { setStatus(event.target.value); setPage(0) }}>
      <option value="">Todos</option><option value="pendiente">Pendiente</option><option value="cita">Con cita</option><option value="recepcion_directa">Recepción directa</option>
    </select></label></div>
    <DataState state={state}>{state.data && <><Table rows={state.data} columns={['id', clientColumn, vehicleColumn, 'reason', 'channel', 'status', 'created_at']}
      actions={row => <Button secondary to={'/solicitudes/' + id(row)}>Ver solicitud</Button>} /><Pager page={page} setPage={setPage} length={state.data.length} /></>}</DataState>
  </Panel>
}
export function Receive({ requestId }: { requestId: unknown }) {
  return <Action secondary={false} spec={{ title: 'Recibir vehículo y abrir OT', path: '/orders', route: '/orders',
    preset: { request_id: requestId }, onDone: row => go('/ordenes/' + id(row)),
  }} />
}
export function RequestDetail({ recordId }: { recordId: string }) {
  const endpoint = '/requests/' + recordId
  const data = useData<Row>(endpoint)
  const row = data.data
  const client = useData<Row>(row ? '/clients/' + row.client_id : undefined)
  const vehicle = useData<Row>(row ? '/vehicles/' + row.vehicle_id : undefined)
  const orders = useData<Row[]>(row ? query('/orders', { request_id: recordId, limit: 100 }) : undefined)
  const appointments = useData<Row[]>(row?.status === 'cita' ? query('/appointments', { request_id: recordId, limit: 100 }) : undefined)
  const order = orders.data?.find(item => String(item.request_id) === recordId)
  const appointment = appointments.data?.find(item => String(item.request_id) === recordId)
  return <DataState state={data}>{row && <Panel title={'Solicitud #' + recordId} tools={<Badge value={row.status} />}>
    <div className="actions"><Button secondary to={'/clientes/' + row.client_id}>{display(client.data?.full_name) === '—' ? 'Cliente #' + row.client_id : String(client.data?.full_name)}</Button>
      <Button secondary to={'/vehiculos/' + row.vehicle_id}>{vehicle.data ? vehicleLabel(vehicle.data) : 'Vehículo #' + row.vehicle_id}</Button></div>
    <Summary row={row} fields={['reason', 'channel', 'created_by', 'created_at']} />
    <div className="actions">
      {row.status === 'pendiente' && <><Action secondary={false} spec={{ title: 'Agendar cita', path: '/appointments', route: '/appointments', preset: { request_id: row.id }, onDone: item => go('/agenda/' + id(item)) }} />
        <Action spec={{ title: 'Derivar a recepción directa', path: endpoint + '/direct-reception', route: '/requests/{request_id}/direct-reception', confirm: 'La solicitud quedará lista para abrir una orden de trabajo.' }} /></>}
      {appointment && <Button secondary to={'/agenda/' + id(appointment)}>Ver cita</Button>}
      {order ? <Button to={'/ordenes/' + id(order)}>Ver OT #{id(order)}</Button> :
        (row.status === 'recepcion_directa' || appointment?.status === 'atendida') && !orders.loading && <Receive requestId={row.id} />}
    </div>
  </Panel>}</DataState>
}

const appointmentColumns = ['id', 'starts_at', 'request_id', 'status']
export function Agenda() {
  const [day, setDay] = useState(today)
  const [weekly, setWeekly] = useState(false)
  const [week, setWeek] = useState<Row[]>()
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const { revision } = useApp()
  const daily = useData<Row[]>(weekly ? undefined : query('/appointments', { day, offset: page * 15, limit: 15 }))
  const slots = useData<Row[]>(query('/appointments/availability', { day }))
  const pending = useData<Row[]>('/requests?status=pendiente&limit=100')
  useEffect(() => {
    if (!weekly || !day) return
    const controller = new AbortController()
    const weekday = new Date(day + 'T12:00:00Z').getUTCDay()
    const monday = shiftDay(day, -((weekday + 6) % 7))
    Promise.all(Array.from({ length: 7 }, (_, index) => request<Row[]>(query('/appointments', { day: shiftDay(monday, index), limit: 100 }), 'GET', undefined, controller.signal)))
      .then(days => { if (!controller.signal.aborted) { setWeek(days.flat()); setError('') } })
      .catch(err => { if (!controller.signal.aborted) setError(message(err)) })
    return () => controller.abort()
  }, [weekly, day, revision])
  const rows = weekly ? week : daily.data
  const updateDay = (value: string) => { if (value) { setWeek(undefined); setError(''); setDay(value); setPage(0) } }
  return <>
    <Panel title="Agenda de recepción" tools={<Action secondary={false} spec={{ title: 'Nueva cita', route: '/appointments', path: '/appointments',
      initial: { day }, choices: { request_id: choices(pending.data, requestLabel) }, onDone: row => go('/agenda/' + id(row)) }} />}>
      <div className="filters">
        <Button secondary onClick={() => updateDay(shiftDay(day, weekly ? -7 : -1))}>‹</Button>
        <label className="field"><span>Fecha</span><input type="date" value={day} onChange={event => updateDay(event.target.value)} /></label>
        <Button secondary onClick={() => updateDay(shiftDay(day, weekly ? 7 : 1))}>›</Button>
        <Button secondary onClick={() => updateDay(today())}>Hoy</Button>
        <Button secondary onClick={() => { setWeek(undefined); setWeekly(!weekly) }}>{weekly ? 'Vista diaria' : 'Vista semanal'}</Button>
      </div>
      <DataState state={weekly ? { error, loading: !rows && !error } : daily}>
        {rows && <Table rows={rows} columns={appointmentColumns} actions={row => <Button secondary to={'/agenda/' + id(row)}>Ver cita</Button>} />}
        {!weekly && rows && <Pager page={page} setPage={setPage} length={rows.length} />}
      </DataState>
    </Panel>
    <Panel title="Disponibilidad del día"><DataState state={slots}>{slots.data && <div className="slots">{slots.data.length ? slots.data.map(row =>
      <div className={Number(row.available) > 0 ? 'slot' : 'slot full'} key={String(row.starts_at)}>
        <strong>{display(row.starts_at)}</strong><span>{String(row.available)} cupo(s)</span></div>) : <p className="empty">Sin horarios disponibles.</p>}</div>}</DataState></Panel>
  </>
}
export function Appointment({ recordId }: { recordId: string }) {
  const path = '/appointments/' + recordId
  const state = useData<Row>(path)
  const row = state.data
  const history = useData<Row[]>(path + '/history')
  const service = useData<Row>(row ? '/requests/' + row.request_id : undefined)
  const client = useData<Row>(service.data ? '/clients/' + service.data.client_id : undefined)
  const commands = [
    ['confirm', 'Confirmar cita', ['programada']], ['attend', 'Marcar atendida', ['confirmada']],
    ['no-show', 'Marcar inasistencia', ['confirmada']], ['cancel', 'Cancelar cita', ['programada', 'confirmada']],
    ['reschedule', 'Reprogramar', ['programada', 'confirmada', 'cancelada']],
  ] as const
  const [copied, setCopied] = useState(false)
  const draft = row ? 'Hola ' + (client.data?.full_name ?? '') + ', le contactamos del Taller Automotriz Córdova por su cita del ' + display(row.starts_at) + '.' : ''
  return <DataState state={state}>{row && <>
    <Panel title={'Cita #' + recordId} tools={<Badge value={row.status} />}>
      <Summary row={row} fields={['starts_at', 'request_id', 'created_by', 'created_at']} />
      <div className="actions">
        <Button secondary to={'/solicitudes/' + row.request_id}>Ver solicitud y recepción</Button>
        {commands.filter(item => (item[2] as readonly string[]).includes(String(row.status))).map(([action, title]) =>
          <Action key={action} spec={{ title, route: '/appointments/{appointment_id}/' + action, path: path + '/' + action,
            confirm: action === 'cancel' ? 'El horario quedará disponible para otra cita.' : undefined,
            initial: { day: String(row.starts_at).slice(0, 10) } }} />)}
        {['programada', 'confirmada'].includes(String(row.status)) && <Button secondary onClick={() => {
          navigator.clipboard.writeText(draft).then(() => setCopied(true)).catch(() => setCopied(false))
        }}>Copiar mensaje de cita</Button>}
      </div>
      {copied && <Alert ok>Mensaje copiado para compartir con el cliente.</Alert>}
    </Panel>
    <Panel title="Comunicaciones de la cita" tools={<Action spec={{ title: 'Registrar comunicación', path: path + '/notices',
      route: '/appointments/{appointment_id}/notices', initial: { message: draft },
      hint: 'Registra el canal y el mensaje una vez que hayas contactado al cliente.',
    }} />}><DataTable path={path + '/notices'} columns={['channel', 'message', 'created_by', 'created_at']} /></Panel>
    <Panel title="Historial de la cita"><DataState state={history}>{history.data && <Timeline rows={history.data} />}</DataState></Panel>
  </>}</DataState>
}

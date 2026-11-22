import { useState } from 'react'
import { query } from './api'
import type { Row } from './api'
import { clientColumn, vehicleColumn } from './atencion'
import { Action, Badge, Button, DataState, Pager, Panel, Summary, Table, Timeline, choices, display, id, label, manager, money, useApp, useData } from './ui'
import { OrderParts } from './repuestos'
import { OrderPayments } from './pagos'

const statuses = ['diagnostico', 'espera_autorizacion', 'autorizada', 'reparacion', 'espera_repuesto', 'correccion', 'terminada', 'cerrada_sin_reparacion']
export function Orders() {
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const data = useData<Row[]>(query('/orders', { status, q: search, offset: page * 15, limit: 15 }))
  return <Panel title="Bandeja de órdenes" tools={<Button to="/solicitudes">Ir a recepción</Button>}>
    <div className="filters">
      <label className="field"><span>Buscar por OT, cliente o placa</span><input type="search" value={search} onChange={event => { setPage(0); setSearch(event.target.value) }} /></label>
      <label className="field"><span>Estado técnico</span><select value={status} onChange={event => { setStatus(event.target.value); setPage(0) }}>
        <option value="">Todos</option>{statuses.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
    </div>
    <DataState state={data}>{data.data && <><Table rows={data.data} columns={['id', clientColumn, vehicleColumn, 'status', 'estimated_delivery_at',
      { key: 'delivered_at', title: 'Entrega', render: row => row.delivered_at ? display(row.delivered_at) : row.returned_at ? 'Devuelto sin reparación' : 'Pendiente' }]}
      actions={row => <Button secondary to={'/ordenes/' + id(row)}>Abrir OT</Button>} /><Pager page={page} setPage={setPage} length={data.data.length} /></>}</DataState>
  </Panel>
}

export const quoteChoices = (rows: Row[], extra = false) => choices(rows.filter(row => row.status === 'autorizado' && (!extra || row.kind === 'complementario')),
  row => '#' + row.id + ' · ' + row.description)

function Quotes({ order, rows }: { order: Row; rows: Row[] }) {
  const { user } = useApp()
  const path = '/orders/' + id(order) + '/quotes'
  const route = '/orders/{order_id}/quotes'
  const canManage = manager(user)
  const initial = order.status === 'espera_autorizacion' && !rows.some(row => row.kind === 'inicial')
  const extra = ['autorizada', 'espera_repuesto', 'reparacion', 'correccion'].includes(String(order.status)) &&
    !rows.some(row => row.kind === 'complementario' && ['borrador', 'enviado'].includes(String(row.status)))
  return <Panel title="Presupuestos y autorizaciones" tools={canManage && (initial || extra) && <Action secondary={false} spec={{
    title: initial ? 'Presupuesto inicial' : 'Presupuesto complementario', path, route, preset: { kind: initial ? 'inicial' : 'complementario' },
  }} />}>
    <Table rows={rows} columns={['id', 'kind', 'description', ...(canManage ? ['amount'] : []), 'status',
      { key: 'sent_message', title: 'Comunicación', render: row => display(row.sent_message) },
      { key: 'decision_evidence', title: 'Respuesta registrada', render: row => display(row.decision_evidence) }]}
      actions={canManage ? row => {
        const q = path + '/' + id(row)
        const r = route + '/{quote_id}'
        return <>{row.status === 'borrador' && <>
          <Action spec={{ title: 'Editar borrador', method: 'PATCH', path: q, route: r, initial: row }} />
          <Action spec={{ title: 'Registrar envío', path: q + '/send', route: r + '/send', hint: 'Registra el canal y el mensaje compartido con el cliente.' }} />
        </>}{row.status === 'enviado' && <>
          <Action spec={{ title: 'Autorizar', path: q + '/decision', route: r + '/decision', preset: { approved: true }, hint: 'Registra el canal y la evidencia de la respuesta del cliente.' }} />
          <Action spec={{ title: 'Rechazar', path: q + '/decision', route: r + '/decision', preset: { approved: false },
            confirm: row.kind === 'inicial' ? 'El rechazo del presupuesto inicial cierra la OT sin reparación.' : 'El trabajo adicional quedará rechazado.' }} />
        </>}</>
      } : undefined} />
  </Panel>
}

export function OrderDetail({ recordId }: { recordId: string }) {
  const { user } = useApp()
  const canManage = manager(user)
  const [tab, setTab] = useState('trabajo')
  const path = '/orders/' + recordId
  const route = '/orders/{order_id}'
  const state = useData<Row>(path)
  const order = state.data
  const customer = useData<Row>(order ? '/clients/' + order.client_id : undefined)
  const vehicle = useData<Row>(order ? '/vehicles/' + order.vehicle_id : undefined)
  const balance = useData<Row>(canManage ? path + '/balance' : undefined)
  const commitments = useData<Row[]>(canManage ? path + '/commitments' : undefined)
  const quotes = useData<Row[]>(path + '/quotes')
  const progress = useData<Row[]>(path + '/progress')
  const events = useData<Row[]>(path + '/history')
  const notices = useData<Row[]>(path + '/notices')
  const parts = useData<Row[]>(canManage || order?.assigned_to === user.id ? '/parts/orders/' + recordId + '/requests' : undefined)
  const staff = useData<Row[]>(canManage ? '/auth/responsibles' : undefined)
  const assigned = canManage || order?.assigned_to === user.id
  const inWork = assigned && ['reparacion', 'correccion'].includes(String(order?.status))
  const quoteRows = quotes.data ?? []
  const authorized = quoteChoices(quoteRows)
  const pendingPart = parts.data?.some(item => ['solicitado', 'aprobado', 'pedido', 'parcial'].includes(String(item.status)))
  const lastTest = events.data?.findLast(item => ['prueba_conforme', 'prueba_no_conforme'].includes(String(item.action)))
  const corrected = !lastTest || events.data?.some((item, index, all) => item.action === 'avance' && index > all.indexOf(lastTest))
  const canTest = inWork && !!progress.data?.length && corrected && quotes.data && !quoteRows.some(row => ['borrador', 'enviado'].includes(String(row.status)))
  const lastNotice = notices.data?.some(item => item.kind === 'terminada' && (!lastTest || String(item.created_at) >= String(lastTest.created_at)))
  const canPayDelivery = balance.data && (Number(balance.data.balance) <= 0 || commitments.data?.some(item =>
    item.active && Number(item.amount) >= Number(balance.data?.balance)))
  const tabs = [['trabajo', 'Trabajo'], ['presupuestos', 'Presupuestos'], ['repuestos', 'Repuestos'],
    ...(canManage ? [['cobros', 'Cobros']] : []), ['comunicaciones', 'Comunicaciones'], ['historial', 'Historial']]
  return <DataState state={state}>{order && <>
    <Panel title={'Orden de trabajo #' + recordId} tools={<Button secondary to={'/solicitudes/' + order.request_id}>Ver solicitud</Button>}>
      <div className="actions">
        <Button secondary to={'/clientes/' + order.client_id}>{String(customer.data?.full_name ?? 'Cliente #' + order.client_id)}</Button>
        <Button secondary to={'/vehiculos/' + order.vehicle_id}>{vehicle.data ? [vehicle.data.plate, vehicle.data.brand, vehicle.data.model].filter(Boolean).join(' ') : 'Vehículo #' + order.vehicle_id}</Button>
      </div>
      <div className="status-strip">
        <div><small>Estado técnico</small><Badge value={order.status} /></div>
        <div><small>Entrega</small><strong>{order.delivered_at ? display(order.delivered_at) : order.returned_at ? 'Devuelto sin reparación' : 'Pendiente'}</strong></div>
        {canManage && <div><small>Situación financiera</small><strong>{balance.data ? money(balance.data.balance) + ' · ' + label(String(balance.data.financial_status)) : '—'}</strong></div>}
      </div>
      <Summary row={{ ...order, assigned_to: staff.data?.find(person => person.id === order.assigned_to)?.full_name ?? order.assigned_to }} fields={['assigned_to', 'estimated_delivery_at', 'created_at']} />
    </Panel>
    <nav className="tabs" aria-label="Secciones de la orden">{tabs.map(([key, text]) =>
      <button key={key} type="button" aria-current={tab === key ? 'page' : undefined} className={tab === key ? 'selected' : ''} onClick={() => setTab(key)}>{text}</button>)}</nav>
    {tab === 'trabajo' && <>
      <Panel title="Recepción y reparación"><Summary row={order} fields={['reception_notes', 'diagnosis', 'proposed_work', ...(order.rejection_reason ? ['rejection_reason'] : [])]} />
        {order.status === 'correccion' && <p className="callout">Registra la corrección realizada antes de repetir la prueba.</p>}
        {canManage && order.status === 'terminada' && !order.delivered_at && !lastNotice && <p className="callout">Registra el aviso de reparación terminada al cliente.</p>}
        {canManage && order.status === 'terminada' && !order.delivered_at && lastNotice && !canPayDelivery && <p className="callout">Registra el cobro pendiente o un compromiso que cubra el saldo.</p>}
        <div className="actions">
          {order.status === 'diagnostico' && <Action secondary={false} spec={{ title: 'Registrar diagnóstico', path: path + '/diagnosis', route: route + '/diagnosis' }} />}
          {canManage && order.status === 'autorizada' && <Action secondary={false} spec={{ title: 'Asignar responsable', path: path + '/assign', route: route + '/assign',
            choices: { technician_id: choices(staff.data, row => String(row.full_name) + ' · ' + label(String(row.role))) } }} />}
          {inWork && authorized.length > 0 && <Action spec={{ title: order.status === 'correccion' ? 'Registrar corrección' : 'Registrar avance', path: path + '/progress',
            route: route + '/progress', choices: { quote_id: authorized } }} />}
          {canTest && <Action spec={{ title: 'Registrar prueba', path: path + '/tests', route: route + '/tests' }} />}
          {assigned && order.status === 'reparacion' && pendingPart && <Action spec={{ title: 'Esperar repuestos', path: path + '/waiting-parts', route: route + '/waiting-parts', confirm: 'La reparación quedará suspendida mientras se gestionan los repuestos.' }} />}
          {assigned && order.status === 'espera_repuesto' && parts.data && !pendingPart && <Action spec={{ title: 'Reanudar reparación', path: path + '/resume', route: route + '/resume' }} />}
          {canManage && ['reparacion', 'correccion', 'espera_repuesto'].includes(String(order.status)) && <Action spec={{ title: 'Cambiar fecha estimada', path: path + '/estimated-delivery', route: route + '/estimated-delivery', initial: order }} />}
          {canManage && order.status === 'cerrada_sin_reparacion' && !order.returned_at && <Action spec={{ title: 'Registrar devolución', path: path + '/return-unrepaired', route: route + '/return-unrepaired' }} />}
          {canManage && order.status === 'terminada' && !order.delivered_at && lastNotice && canPayDelivery &&
            <Action secondary={false} spec={{ title: 'Entregar vehículo', path: path + '/deliver', route: route + '/deliver', confirm: 'Confirma que el vehículo se entregó físicamente al cliente.' }} />}
        </div>
      </Panel>
      <Panel title="Avances registrados"><DataState state={progress}>{progress.data && <Table rows={progress.data} columns={['created_at', 'description', 'pending_work', 'quote_id', 'created_by']} />}</DataState></Panel>
    </>}
    {tab === 'presupuestos' && <DataState state={quotes}>{quotes.data && <Quotes order={order} rows={quotes.data} />}</DataState>}
    {tab === 'repuestos' && (assigned ? <DataState state={parts}>{parts.data && <OrderParts order={order} rows={parts.data} quotes={quoteRows} />}</DataState> : <p className="empty">Los repuestos se gestionan desde la asignación de la OT.</p>)}
    {tab === 'cobros' && canManage && <OrderPayments orderId={recordId} balance={balance} />}
    {tab === 'comunicaciones' && <Panel title="Avisos al cliente" tools={canManage && <Action spec={{ title: 'Registrar aviso', route: route + '/notices', path: path + '/notices',
      choices: { kind: ['avance', 'demora', 'terminada', 'entrega', 'otro'].map(value => ({ value, label: label(value) })) },
      initial: { kind: order.status === 'terminada' ? 'terminada' : 'avance', message: 'Hola ' + (customer.data?.full_name ?? '') + ', le contactamos del Taller Automotriz Córdova por la orden #' + recordId + '.' },
      hint: 'Usa el texto como borrador para contactar al cliente y registra el canal utilizado.',
    }} />}><DataState state={notices}>{notices.data && <Table rows={notices.data} columns={['kind', 'channel', 'message', 'created_by', 'created_at']} />}</DataState></Panel>}
    {tab === 'historial' && <Panel title="Historial de la orden"><DataState state={events}>{events.data && <Timeline rows={events.data} />}</DataState></Panel>}
  </>}</DataState>
}

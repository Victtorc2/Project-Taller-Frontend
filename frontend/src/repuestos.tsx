import { useState } from 'react'
import { query } from './api'
import type { Row } from './api'
import { Action, Badge, Button, DataState, DataTable, Pager, Panel, Summary, Table, choices, id, label, manager, useApp, useData } from './ui'

const partLabel = (row: Row) => row.sku + ' · ' + row.name + ' (' + row.stock + ' en stock)'
export function Inventory() {
  const { user } = useApp()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [part, setPart] = useState<Row>()
  const parts = useData<Row[]>(query('/parts', { q: search, offset: page * 15, limit: 15 }))
  return <>
    <Panel title="Existencias" tools={manager(user) && <Action secondary={false} spec={{ title: 'Nuevo repuesto', route: '/parts', path: '/parts' }} />}>
      <div className="filters"><label className="field"><span>Buscar por código o nombre</span><input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} /></label></div>
      <DataState state={parts}>{parts.data && <><Table rows={parts.data} columns={['sku', 'name', 'stock', 'active']}
        actions={row => <Button secondary onClick={() => setPart(row)}>Movimientos</Button>} /><Pager page={page} setPage={setPage} length={parts.data.length} /></>}</DataState>
    </Panel>
    {part && <Panel title={'Movimientos · ' + part.name} tools={<Button secondary onClick={() => setPart(undefined)}>Cerrar</Button>}>
      <DataTable path={'/parts/' + part.id + '/movements'} columns={['created_at', 'reason', 'quantity_delta', 'unit_cost', 'order_id', 'part_request_id', 'receipt_id']} />
    </Panel>}
    <Panel title="Proveedores" tools={manager(user) && <Action spec={{ title: 'Nuevo proveedor', route: '/parts/suppliers', path: '/parts/suppliers' }} />}>
      <DataTable path="/parts/suppliers" columns={['name', 'phone', 'active']} />
    </Panel>
  </>
}
const authorized = (rows: Row[], extra = false) => choices(rows.filter(row => row.status === 'autorizado' && (!extra || row.kind === 'complementario')),
  row => '#' + row.id + ' · ' + row.description)

function Purchases({ item, quotes }: { item: Row; quotes: Row[] }) {
  const data = useData<Row[]>('/parts/requests/' + id(item) + '/purchases')
  const suppliers = useData<Row[]>('/parts/suppliers')
  return <DataState state={data}>{data.data?.map(purchase => {
    const receipts = (purchase.receipts ?? []) as Row[]
    const path = '/parts/purchases/' + id(purchase)
    const route = '/parts/purchases/{purchase_id}'
    return <article className="subpanel" key={id(purchase)}>
      <h3>Pedido #{id(purchase)}</h3>
      <Summary row={{ ...purchase, supplier_id: suppliers.data?.find(supplier => supplier.id === purchase.supplier_id)?.name ?? purchase.supplier_id }} fields={['supplier_id', 'quantity', 'unit_cost']} />
      {['pedido', 'parcial'].includes(String(item.status)) && <Action spec={{ title: 'Registrar recepción', path: path + '/receipts', route: route + '/receipts',
        choices: { cost_change_quote_id: authorized(quotes, true) }, initial: { accepted_quantity: 0, rejected_quantity: 0, actual_unit_cost: purchase.unit_cost },
        hint: 'Registra por separado las unidades conformes y las rechazadas. Si hay sobrecosto, elige el presupuesto complementario autorizado.' }} />}
      <Table rows={receipts} columns={['id', 'accepted_quantity', 'rejected_quantity', 'actual_unit_cost', 'notes']}
        actions={row => Number(row.accepted_quantity) > 0 && <Action spec={{ title: 'Devolver unidades', path: path + '/return-received', route: route + '/return-received', preset: { receipt_id: row.id }, confirm: 'Se descontarán del stock las unidades devueltas al proveedor.' }} />} />
    </article>
  })}</DataState>
}

export function OrderParts({ order, rows, quotes }: { order: Row; rows: Row[]; quotes: Row[] }) {
  const { user } = useApp()
  const canManage = manager(user)
  const [selected, setSelected] = useState('')
  const parts = useData<Row[]>('/parts?limit=100')
  const suppliers = useData<Row[]>(canManage ? '/parts/suppliers' : undefined)
  const inWork = ['reparacion', 'correccion'].includes(String(order.status))
  const canRequest = (inWork || order.status === 'espera_repuesto') && authorized(quotes).length > 0
  const chosen = rows.find(row => id(row) === selected)
  return <>
    <Panel title="Repuestos de la orden" tools={canRequest && <Action secondary={false} spec={{
      title: 'Solicitar repuesto', path: '/parts/orders/' + order.id + '/requests', route: '/parts/orders/{order_id}/requests',
      choices: { quote_id: authorized(quotes), part_id: choices(parts.data?.filter(row => row.active), partLabel) },
    }} />}>
      <Table rows={rows} columns={['id', { key: 'part_id', render: row => parts.data?.find(part => part.id === row.part_id)?.name as string ?? '#' + row.part_id },
        'quantity', 'status', 'decision_reason']} actions={row => <Button secondary onClick={() => setSelected(id(row))}>Ver gestión</Button>} />
    </Panel>
    {chosen && <Panel title={'Solicitud de repuesto #' + id(chosen)} tools={<Badge value={chosen.status} />}>
      <Summary row={chosen} fields={canManage ? ['quantity', 'estimated_unit_cost', 'decision_reason'] : ['quantity', 'decision_reason']} />
      <div className="actions">
        {canManage && chosen.status === 'solicitado' && [true, false].map(approved => <Action key={String(approved)} spec={{
          title: approved ? 'Aprobar solicitud' : 'Rechazar solicitud', path: '/parts/requests/' + selected + '/decision', route: '/parts/requests/{request_id}/decision', preset: { approved },
        }} />)}
        {canManage && chosen.status === 'aprobado' && <>
          <Action spec={{ title: 'Asignar desde stock', path: '/parts/requests/' + selected + '/fulfill-from-stock', route: '/parts/requests/{request_id}/fulfill-from-stock' }} />
          <Action spec={{ title: 'Registrar pedido', path: '/parts/requests/' + selected + '/purchase', route: '/parts/requests/{request_id}/purchase',
            choices: { supplier_id: choices(suppliers.data?.filter(row => row.active), row => String(row.name)), cost_change_quote_id: authorized(quotes, true) },
            initial: { unit_cost: chosen.estimated_unit_cost } }} />
        </>}
        {canManage && ['solicitado', 'aprobado', 'pedido', 'parcial'].includes(String(chosen.status)) &&
          <Action spec={{ title: 'Anular solicitud', path: '/parts/requests/' + selected + '/cancel', route: '/parts/requests/{request_id}/cancel' }} />}
        {inWork && ['aprobado', 'parcial', 'recibido'].includes(String(chosen.status)) && <Action spec={{
          title: 'Registrar consumo', path: '/parts/requests/' + selected + '/consume', route: '/parts/requests/{request_id}/consume',
        }} />}
      </div>
      {canManage && ['pedido', 'parcial', 'recibido', 'anulado'].includes(String(chosen.status)) && <Purchases item={chosen} quotes={quotes} />}
      <h3>Movimientos de esta solicitud</h3>
      <RequestMovements key={selected} item={chosen} />
    </Panel>}
  </>
}
function RequestMovements({ item }: { item: Row }) {
  const state = useData<Row[]>('/parts/' + item.part_id + '/movements')
  return <DataState state={state}>{state.data && <Table rows={state.data.filter(row => row.part_request_id === item.id)}
    columns={['created_at', { key: 'reason', render: row => label(String(row.reason)) }, 'quantity_delta', 'receipt_id']} />}</DataState>
}

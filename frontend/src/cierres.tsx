import { useState } from 'react'
import { query } from './api'
import type { Row } from './api'
import { Action, Badge, Button, DataState, Pager, Panel, Summary, Table, Timeline, go, id, money, shiftDay, today, useApp, useData } from './ui'

const totals: [string, string][] = [
  ['sales_authorized', 'Servicios autorizados'], ['cash_collected_net', 'Cobros netos'], ['parts_received_net_cost', 'Costo neto de repuestos'],
  ['other_expenses_net', 'Otros egresos'], ['outstanding_at_period_end', 'Saldo al cierre'], ['partial_result', 'Resultado parcial'],
]
const movements: Record<string, string> = { approved_quotes: 'Presupuestos autorizados', payments_received: 'Pagos recibidos',
  payments_reversed: 'Reversos de pagos', purchase_receipts: 'Recepciones de compra', supplier_returns: 'Devoluciones a proveedores',
  expenses: 'Egresos', expenses_reversed: 'Reversos de egresos' }
function Report({ row }: { row: Row }) {
  const source = (row.movement_ids ?? {}) as Record<string, number[]>
  return <>
    <div className="metric-grid">{totals.map(([key, title]) => <div className="metric" key={key}><span>{title}</span><strong>{money(row[key])}</strong></div>)}</div>
    <p className="muted">{String(row.partial_result_note ?? '')}</p>
    <Summary row={row} fields={['orders_opened', 'vehicles_delivered']} />
    <details><summary>Identificadores de movimientos de origen</summary>
      <dl className="summary">{Object.entries(source).map(([key, values]) => <div key={key}><dt>{movements[key] ?? key}</dt><dd>{values.join(', ') || 'Sin movimientos'}</dd></div>)}</dl>
    </details>
  </>
}
function lastPeriod(frequency: string) {
  const current = today()
  if (frequency === 'mensual') {
    const end = shiftDay(current.slice(0, 7) + '-01', -1)
    return [end.slice(0, 7) + '-01', end]
  }
  const weekday = new Date(current + 'T12:00:00Z').getUTCDay()
  const end = shiftDay(current, -((weekday + 6) % 7) - 1)
  return [shiftDay(end, -6), end]
}
export function Closings() {
  const [frequency, setFrequency] = useState('semanal')
  const [dates, setDates] = useState(() => lastPeriod('semanal'))
  const [preview, setPreview] = useState('')
  const report = useData<Row>(preview || undefined)
  const periods = useData<Row[]>('/periods')
  const [page, setPage] = useState(0)
  const expenses = useData<Row[]>(query('/expenses', { offset: page * 15, limit: 15 }))
  return <>
    <Panel title="Informe económico">
      <form className="filters" onSubmit={event => { event.preventDefault(); setPreview(query('/reports', { frequency, start_date: dates[0], end_date: dates[1] })) }}>
        <label className="field"><span>Frecuencia</span><select value={frequency} onChange={event => { setFrequency(event.target.value); setDates(lastPeriod(event.target.value)) }}><option value="semanal">Semanal</option><option value="mensual">Mensual</option></select></label>
        <label className="field"><span>Desde</span><input type="date" required value={dates[0]} onChange={event => setDates([event.target.value, dates[1]])} /></label>
        <label className="field"><span>Hasta</span><input type="date" required value={dates[1]} onChange={event => setDates([dates[0], event.target.value])} /></label>
        <button className="button">Consultar reporte</button>
      </form>
      <DataState state={report}>{report.data && <Report row={report.data} />}</DataState>
    </Panel>
    <Panel title="Periodos de cierre" tools={<Action spec={{ title: 'Abrir periodo para revisión', path: '/periods', route: '/periods',
      initial: { frequency, start_date: dates[0], end_date: dates[1] }, onDone: row => go('/cierres/' + id(row)) }} />}>
      <DataState state={periods}>{periods.data && <Table rows={periods.data} columns={['id', 'frequency', 'start_date', 'end_date', 'status', 'confirmed_by']}
        actions={row => <Button secondary to={'/cierres/' + id(row)}>Ver cierre</Button>} />}</DataState>
    </Panel>
    <Panel title="Otros egresos" tools={<Action spec={{ title: 'Registrar egreso', path: '/expenses', route: '/expenses' }} />}>
      <DataState state={expenses}>{expenses.data && <><Table rows={expenses.data} columns={['id', 'category', 'description', 'amount', 'evidence', 'created_at', 'voided_at']}
        actions={row => !row.voided_at && <Action spec={{ title: 'Anular egreso', path: '/expenses/' + id(row) + '/void', route: '/expenses/{expense_id}/void', confirm: 'El egreso quedará anulado y se conservará su historial.' }} />} />
        <Pager page={page} setPage={setPage} length={expenses.data.length} /></>}</DataState>
    </Panel>
  </>
}
export function Closing({ recordId }: { recordId: string }) {
  const { user } = useApp()
  const path = '/periods/' + recordId
  const route = '/periods/{period_id}'
  const data = useData<Row>(path)
  const issues = useData<Row[]>(path + '/issues')
  const history = useData<Row[]>(path + '/history')
  const draft = data.data?.status === 'borrador'
  return <DataState state={data}>{data.data && <>
    <Panel title={'Cierre #' + recordId} tools={<Badge value={data.data.status} />}>
      <Summary row={data.data} fields={['frequency', 'start_date', 'end_date', 'confirmed_by', 'confirmed_at']} />
      <Report row={data.data.report as Row} />
      <div className="actions">
        {user.role === 'gerente' && draft && issues.data && !issues.data.some(row => !row.resolved_at) &&
          <Action secondary={false} spec={{ title: 'Confirmar cierre', path: path + '/confirm', route: route + '/confirm', confirm: 'Se guardará el resultado del periodo y se bloqueará el registro de nuevos movimientos económicos en él.' }} />}
        {user.role === 'gerente' && !draft && <Action spec={{ title: 'Reabrir cierre', path: path + '/reopen', route: route + '/reopen', confirm: 'El cierre volverá a revisión. El resultado anterior se conservará en el historial.' }} />}
      </div>
    </Panel>
    <Panel title="Diferencias de conciliación" tools={draft && <Action spec={{ title: 'Registrar diferencia', path: path + '/issues', route: route + '/issues' }} />}>
      <DataState state={issues}>{issues.data && <Table rows={issues.data} columns={['id', 'category', 'description', 'evidence', 'resolution', 'resolved_at']}
        actions={draft ? row => !row.resolved_at && <Action spec={{ title: 'Resolver diferencia', path: path + '/issues/' + id(row) + '/resolve', route: route + '/issues/{issue_id}/resolve' }} /> : undefined} />}</DataState>
    </Panel>
    <Panel title="Historial de cierre"><DataState state={history}>{history.data && <><Timeline rows={history.data} />
      {history.data.filter(row => row.snapshot).map(row => <details key={String(row.id ?? row.created_at)}><summary>Resultado archivado</summary><Report row={typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot as Row} /></details>)}</>}</DataState></Panel>
  </>}</DataState>
}

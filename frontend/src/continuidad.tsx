import { useState } from 'react'
import type { Row } from './api'
import { Action, DataState, Panel, Table, choices, id, label, manager, useApp, useData } from './ui'

const entities: Record<string, string> = { P01: 'solicitud', P02: 'cita', P03: 'orden', P04: 'pedido', P05: 'pago', P06: 'egreso' }
const process = Object.keys(entities).map(value => ({ value, label: value + ' · ' + label(entities[value]) }))
export function Continuity() {
  const { user } = useApp()
  const [pending, setPending] = useState(false)
  const incidents = useData<Row[]>('/incidents')
  const records = useData<Row[]>('/manual-records' + (pending ? '?pending=true' : ''))
  return <>
    <Panel title="Incidentes" tools={<Action secondary={false} spec={{ title: 'Reportar incidente', path: '/incidents', route: '/incidents',
      choices: { process_code: process, severity: ['baja', 'media', 'alta', 'critica'].map(value => ({ value, label: label(value) })) } }} />}>
      <DataState state={incidents}>{incidents.data && <Table rows={incidents.data} columns={['id', 'process_code', 'severity', 'description', 'impact', 'status', 'action_taken', 'created_at']}
        actions={manager(user) ? row => row.status === 'abierto' && <Action spec={{ title: 'Resolver incidente', path: '/incidents/' + id(row) + '/resolve', route: '/incidents/{incident_id}/resolve' }} /> : undefined} />}</DataState>
    </Panel>
    <Panel title="Registros de contingencia" tools={<Action spec={{ title: 'Registrar ficha física', path: '/manual-records', route: '/manual-records', choices: { process_code: process },
      hint: 'Usa el código de la ficha física. Si ya existe, consulta su conciliación antes de volver a registrarla.' }} />}>
      <label className="check-label"><input type="checkbox" checked={pending} onChange={event => setPending(event.target.checked)} /> Solo pendientes de conciliación</label>
      <DataState state={records}>{records.data && <Table rows={records.data} columns={['temp_code', 'process_code', 'description', 'occurred_at', 'reconciled_entity', 'reconciled_id', 'reconciled_at']}
        actions={manager(user) ? row => !row.reconciled_at && <Action spec={{ title: 'Conciliar', path: '/manual-records/' + encodeURIComponent(String(row.temp_code)) + '/reconcile', route: '/manual-records/{temp_code}/reconcile',
          preset: { entity: entities[String(row.process_code)] }, hint: 'Ingresa el número de la operación digital que corresponde a esta ficha física.' }} /> : undefined} />}</DataState>
    </Panel>
  </>
}
export function Training() {
  const workers = useData<Row[]>('/training/status')
  const updates = useData<Row>('/metrics/repair-updates')
  return <>
    <Panel title="Avances de reparación"><DataState state={updates}>{updates.data && <div className="metric-grid">
      <div className="metric"><span>Reparaciones activas</span><strong>{String(updates.data.active_repairs)}</strong></div>
      <div className="metric"><span>Con avances hoy</span><strong>{String(updates.data.updated_today)}</strong></div>
      <div className="metric"><span>Cobertura de avances</span><strong>{updates.data.percentage == null ? '—' : updates.data.percentage + '%'}</strong><small>Meta {String(updates.data.target_percentage)}%</small></div>
    </div>}</DataState></Panel>
    <Panel title="Capacitación del personal" tools={<Action spec={{ title: 'Registrar evaluación', path: '/training/evaluations', route: '/training/evaluations',
      choices: { user_id: choices(workers.data?.map(row => ({ ...row, id: row.user_id })), row => String(row.name)) } }} />}>
      <DataState state={workers}>{workers.data && <Table rows={workers.data} columns={['name', 'role', 'tasks_correct', 'tasks_total', 'evaluated',
        { key: 'meets_target', title: 'Meta del 80 %', render: row => !row.evaluated ? 'Pendiente' : row.meets_target ? 'Alcanzada' : 'Por alcanzar' }]} />}</DataState>
    </Panel>
  </>
}

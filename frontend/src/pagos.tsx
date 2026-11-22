import { useState } from 'react'
import type { Row } from './api'
import { Action, Button, DataState, DataTable, Panel, Summary, Table, useData } from './ui'

function Receipt({ path, close }: { path: string; close: () => void }) {
  const state = useData<Row>(path)
  return <div className="payment-receipt"><Panel title="Constancia interna" tools={<Button secondary onClick={close}>Cerrar constancia</Button>}><DataState state={state}>
    {state.data && <><Summary row={state.data} fields={Object.keys(state.data)} /><Button secondary onClick={() => window.print()}>Imprimir constancia</Button></>}
  </DataState></Panel></div>
}

export function OrderPayments({ orderId, balance }: { orderId: string; balance: { data?: Row; error?: string; loading: boolean } }) {
  const path = '/orders/' + orderId
  const route = '/orders/{order_id}'
  const [receipt, setReceipt] = useState('')
  const payments = useData<Row[]>(path + '/payments')
  const available = !!balance.data && Number(balance.data.balance) > 0
  return <>
    <Panel title="Resumen económico de la OT" tools={available && <div className="actions">
      <Action secondary={false} spec={{ title: 'Registrar abono', path: path + '/payments', route: route + '/payments',
        choices: { method: ['Efectivo', 'Transferencia', 'Tarjeta', 'Yape', 'Plin', 'Otro'].map(value => ({ value, label: value })) } }} />
      <Action spec={{ title: 'Registrar compromiso', path: path + '/commitments', route: route + '/commitments', hint: 'El compromiso conserva el saldo pendiente hasta que se registre el pago.' }} />
    </div>}>
      <DataState state={balance}>{balance.data && <Summary row={balance.data} fields={['authorized_amount', 'valid_payments', 'balance', 'financial_status']} />}</DataState>
    </Panel>
    <Panel title="Movimientos de pago"><DataState state={payments}>{payments.data && <Table rows={payments.data}
      columns={['id', 'amount', 'method', 'reference', 'status', 'created_at', 'void_reason']} actions={row => <>
        <Button secondary onClick={() => setReceipt(path + '/payments/' + row.id + '/receipt')}>Constancia</Button>
        {row.status === 'valido' && <Action spec={{ title: 'Anular pago', path: path + '/payments/' + row.id + '/void', route: route + '/payments/{payment_id}/void', confirm: 'La anulación se registrará como reverso y conservará el historial del abono.' }} />}
      </>} />}</DataState></Panel>
    {receipt && <Receipt path={receipt} close={() => setReceipt('')} />}
    <Panel title="Compromisos de pago"><DataTable path={path + '/commitments'} columns={['id', 'amount', 'due_date', 'notes', 'active']} /></Panel>
  </>
}

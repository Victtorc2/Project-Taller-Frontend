import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Appointment, Agenda, ContactDetail, Directory, RequestDetail, Requests } from './atencion'
import { Closing, Closings } from './cierres'
import { Continuity, Training } from './continuidad'
import { OrderDetail, Orders } from './ordenes'
import { Inventory } from './repuestos'
import { ApiError, message, query, request, setToken } from './api'
import type { Contract, Row, Session, User } from './api'
import { Action, ActionDialog, Alert, AppContext, Button, DataState, DataTable, Panel, Summary, go, id, label, manager, today, useApp, useData } from './ui'
import type { ActionSpec } from './ui'

const storage = 'peti-session'
const nav = [
  { path: '/', name: 'Inicio', symbol: '⌂', group: 'Taller' },
  { path: '/clientes', name: 'Clientes', symbol: '◎', group: 'Atención' },
  { path: '/vehiculos', name: 'Vehículos', symbol: '▱', group: 'Atención' },
  { path: '/solicitudes', name: 'Solicitudes', symbol: '≡', group: 'Atención' },
  { path: '/agenda', name: 'Agenda', symbol: '▦', group: 'Atención' },
  { path: '/ordenes', name: 'Órdenes de trabajo', symbol: '▤', group: 'Operación' },
  { path: '/repuestos', name: 'Repuestos', symbol: '▣', group: 'Operación' },
  { path: '/cierres', name: 'Cierres y reportes', symbol: '▥', group: 'Gestión', access: 'manager' },
  { path: '/contingencia', name: 'Contingencia', symbol: '◇', group: 'Gestión' },
  { path: '/indicadores', name: 'Indicadores y capacitación', symbol: '◫', group: 'Gestión', access: 'manager' },
  { path: '/usuarios', name: 'Usuarios', symbol: '⊕', group: 'Gestión', access: 'owner' },
]
const headings: Record<string, string> = {
  '/': 'Panel de operación', '/clientes': 'Clientes', '/vehiculos': 'Vehículos', '/solicitudes': 'Solicitudes',
  '/agenda': 'Agenda de citas', '/ordenes': 'Órdenes de trabajo', '/repuestos': 'Inventario y compras',
  '/cierres': 'Cierres y reportes', '/contingencia': 'Continuidad del taller', '/indicadores': 'Indicadores y capacitación',
  '/usuarios': 'Usuarios', '/perfil': 'Mi perfil',
}
function readSession(): Session | undefined {
  try {
    const session = JSON.parse(sessionStorage.getItem(storage) ?? 'null') as Session | null
    if (session?.access_token && Date.parse(session.expires_at) > Date.now()) return session
    sessionStorage.removeItem(storage)
  } catch { sessionStorage.removeItem(storage) }
}
function brand() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true">C</span><div><strong>Taller Córdova</strong><small>Gestión automotriz</small></div></div>
}
function Login({ onLogin, notice }: { onLogin: (session: Session, user: User) => void; notice: string }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current) return
    const form = new FormData(event.currentTarget)
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const session = await request<Session>('/auth/login', 'POST', { username: form.get('username'), password: form.get('password') })
      setToken(session.access_token)
      const user = await request<User>('/auth/me')
      onLogin(session, user)
    } catch (err) { setToken(''); setError(message(err)) }
    finally { lock.current = false; setBusy(false) }
  }
  return <main className="login">
    <section className="login-brand">{brand()}<div className="login-message"><div className="garage-line" aria-hidden="true" />
      <h1>Taller Automotriz<br />Córdova</h1><p>Gestión de citas, órdenes y entregas</p></div>
      <span className="login-caption">Acceso para el personal del taller</span>
    </section>
    <section className="login-content"><form className="login-form" onSubmit={login}>
      <h2>Iniciar sesión</h2>
      <p className="muted">Ingresa con tu cuenta del taller.</p>
      {notice && !error && <Alert>{notice}</Alert>}{error && <Alert>{error}</Alert>}
      <label className="field"><span>Usuario</span><input name="username" autoComplete="username" required /></label>
      <label className="field"><span>Contraseña</span><input name="password" type="password" autoComplete="current-password" required /></label>
      <button className="button" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
    </form></section>
  </main>
}

function Dashboard() {
  const { user } = useApp()
  const staff = user.role !== 'soporte'
  const technical = user.role === 'tecnico'
  const metric = useData<Row>(manager(user) ? '/metrics/repair-updates' : undefined)
  return <>
    <section className="welcome"><div><p>{new Intl.DateTimeFormat('es-PE', { dateStyle: 'full', timeZone: 'America/Lima' }).format(new Date())}</p>
      <h2>Hola, {user.full_name}</h2><p>{technical ? 'Consulta tus órdenes y diagnósticos pendientes.' : 'Consulta las citas y el trabajo en curso del taller.'}</p></div>
      {staff && <Button to={technical ? '/ordenes' : '/clientes'}>{technical ? 'Ver órdenes' : 'Buscar cliente'}</Button>}
    </section>
    {manager(user) && <DataState state={metric}>{metric.data && <div className="metric-grid">
      <div className="metric"><span>Reparaciones activas</span><strong>{String(metric.data.active_repairs)}</strong></div>
      <div className="metric"><span>Con avance hoy</span><strong>{String(metric.data.updated_today)}</strong></div>
      <div className="metric"><span>Cobertura de avances</span><strong>{metric.data.percentage == null ? '—' : metric.data.percentage + '%'}</strong></div>
    </div>}</DataState>}
    {staff && <div className="dashboard-grid">
      <Panel title={technical ? 'Órdenes asignadas y diagnósticos' : 'Órdenes recientes'} tools={<Button secondary to="/ordenes">Ver órdenes</Button>}>
        <DataTable path="/orders?limit=6" columns={['id', 'status', 'estimated_delivery_at']} actions={row => <Button secondary to={'/ordenes/' + id(row)}>Abrir</Button>} />
      </Panel>
      <Panel title="Citas de hoy" tools={<Button secondary to="/agenda">Ver agenda</Button>}>
        <DataTable path={query('/appointments', { day: today(), limit: 6 })} columns={['starts_at', 'status']} actions={row => <Button secondary to={'/agenda/' + id(row)}>Ver</Button>} />
      </Panel>
    </div>}
    {!staff && <Panel title="Estado del sistema"><DataState state={metric}><SystemHealth /></DataState></Panel>}
  </>
}
function SystemHealth() {
  const data = useData<Row>('/health/db')
  return <DataState state={data}>{data.data && <Alert ok>La API tiene conexión con la base de datos.</Alert>}</DataState>
}
function Profile({ signOut }: { signOut: (notice?: string) => void }) {
  const { user } = useApp()
  return <Panel title={user.full_name} tools={<Action spec={{ title: 'Cambiar contraseña', path: '/auth/change-password', route: '/auth/change-password',
    onDone: () => signOut('Contraseña actualizada. Inicia sesión nuevamente.') }} />}>
    <Summary row={{ ...user, role: label(user.role) }} fields={['username', 'role']} />
  </Panel>
}
function Users() {
  const { user } = useApp()
  return <Panel title="Cuentas internas" tools={<Action secondary={false} spec={{ title: 'Registrar usuario', path: '/auth/register', route: '/auth/register',
    choices: { role: ['gerente', 'subgerente', 'tecnico'].map(value => ({ value, label: label(value) })) } }} />}>
    <DataTable path="/auth/users" columns={['full_name', 'username', { key: 'role', render: row => label(String(row.role)) }, 'active']} actions={row =>
      row.id !== user.id && <Action spec={{ title: row.active ? 'Desactivar' : 'Activar', method: 'PATCH',
        path: '/auth/users/' + id(row) + '/active', route: '/auth/users/{user_id}/active', preset: { active: !row.active },
        confirm: row.active ? 'Se cerrará la sesión del usuario y se bloqueará su acceso.' : 'La cuenta podrá iniciar sesión nuevamente.' }} />} />
  </Panel>
}
function App() {
  const [session, setSession] = useState(readSession)
  const [user, setUser] = useState<User>()
  const [contract, setContract] = useState<Contract>()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [action, setAction] = useState<ActionSpec>()
  const [success, setSuccess] = useState(false)
  const [route, setRoute] = useState(window.location.hash.slice(1) || '/')
  const [mobileMenu, setMobileMenu] = useState(false)
  const main = useRef<HTMLElement>(null)
  const refresh = () => setRevision(current => current + 1)
  const clear = useCallback((text = '') => {
    sessionStorage.removeItem(storage)
    setToken('')
    setSession(undefined)
    setUser(undefined)
    setAction(undefined)
    setSuccess(false)
    setNotice(text)
  }, [])
  useEffect(() => {
    const changed = () => {
      setRoute(window.location.hash.slice(1) || '/')
      setMobileMenu(false)
      main.current?.focus()
      window.scrollTo(0, 0)
    }
    const expired = () => clear('Tu sesión caducó. Inicia sesión de nuevo.')
    window.addEventListener('hashchange', changed)
    window.addEventListener('peti:expired', expired)
    return () => { window.removeEventListener('hashchange', changed); window.removeEventListener('peti:expired', expired) }
  }, [clear])
  useEffect(() => {
    if (!session) return
    setToken(session.access_token)
    const timer = window.setTimeout(() => clear('Tu sesión caducó. Inicia sesión de nuevo.'), Math.max(0, Date.parse(session.expires_at) - Date.now()))
    return () => window.clearTimeout(timer)
  }, [session, clear])
  useEffect(() => {
    if (!session || (user && contract)) return
    setToken(session.access_token)
    const controller = new AbortController()
    Promise.all([user ?? request<User>('/auth/me', 'GET', undefined, controller.signal), contract ?? request<Contract>('/openapi.json', 'GET', undefined, controller.signal)])
      .then(([profile, spec]) => { if (!controller.signal.aborted) { setUser(profile); setContract(spec); setError('') } })
      .catch(err => { if (!controller.signal.aborted && !(err instanceof ApiError && err.status === 401)) setError(message(err)) })
    return () => controller.abort()
  }, [session, user, contract, revision])
  useEffect(() => {
    if (!success) return
    const timer = window.setTimeout(() => setSuccess(false), 3500)
    return () => window.clearTimeout(timer)
  }, [success])
  async function logout() {
    try { await request('/auth/logout', 'POST'); clear() }
    catch { clear('Se cerró la sesión en este navegador.') }
  }
  if (!session) return <Login notice={notice} onLogin={(next, profile) => {
    sessionStorage.setItem(storage, JSON.stringify(next)); setNotice(''); setError(''); setUser(profile); setSession(next)
  }} />
  if (!user || !contract) return <main className="loading-screen">{brand()} {error ? <><Alert>{error}</Alert><div className="actions"><Button onClick={refresh}>Reintentar</Button><Button secondary onClick={() => void logout()}>Cerrar sesión</Button></div></> : <p role="status">Cargando el sistema del taller…</p>}</main>
  const [, segment, recordId, extra] = route.split('/')
  const base = segment ? '/' + segment : '/'
  const links = nav.filter(item => item.path === '/' || user.role !== 'soporte' &&
    (item.access === 'manager' ? manager(user) : item.access === 'owner' ? user.role === 'gerente' : true))
  const allowed = base === '/perfil' || links.some(item => item.path === base)
  const detail = recordId && /^\d+$/.test(recordId) && !extra
  let content
  if (!allowed) content = <Alert>{base in headings ? 'Tu perfil no tiene acceso a esta sección.' : 'La pantalla solicitada no existe.'}</Alert>
  else if (recordId && (!detail || !['/clientes', '/vehiculos', '/solicitudes', '/agenda', '/ordenes', '/cierres'].includes(base))) content = <Alert>La ficha solicitada no existe.</Alert>
  else switch (base) {
    case '/clientes': content = detail ? <ContactDetail recordId={recordId} vehicles={false} /> : <Directory vehicles={false} />; break
    case '/vehiculos': content = detail ? <ContactDetail recordId={recordId} vehicles /> : <Directory vehicles />; break
    case '/solicitudes': content = detail ? <RequestDetail recordId={recordId} /> : <Requests />; break
    case '/agenda': content = detail ? <Appointment recordId={recordId} /> : <Agenda />; break
    case '/ordenes': content = detail ? <OrderDetail recordId={recordId} /> : <Orders />; break
    case '/repuestos': content = <Inventory />; break
    case '/cierres': content = detail ? <Closing recordId={recordId} /> : <Closings />; break
    case '/contingencia': content = <Continuity />; break
    case '/indicadores': content = <Training />; break
    case '/usuarios': content = <Users />; break
    case '/perfil': content = <Profile signOut={clear} />; break
    default: content = <Dashboard />
  }
  return <AppContext.Provider value={{ user, contract, revision, refresh, open: setAction }}>
    <div className="shell">
      <aside className={'sidebar ' + (mobileMenu ? 'sidebar-open' : '')}>
        <a href="#/" className="home-brand" onClick={() => setMobileMenu(false)}>{brand()}</a>
        <nav aria-label="Navegación principal" id="navigation">
          {[...new Set(links.map(item => item.group))].map(group => <div className="nav-group" key={group}>
            {group !== 'Taller' && <p>{group}</p>}{links.filter(item => item.group === group).map(item =>
              <a href={'#' + item.path} key={item.path} aria-current={base === item.path ? 'page' : undefined} onClick={() => setMobileMenu(false)}><span aria-hidden="true">{item.symbol}</span>{item.name}</a>)}
          </div>)}
        </nav>
        <div className="sidebar-footer"><Button secondary to="/perfil">Mi perfil</Button><Button secondary onClick={() => void logout()}>Salir</Button></div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button className="mobile-toggle icon-button" aria-expanded={mobileMenu} aria-controls="navigation" onClick={() => setMobileMenu(!mobileMenu)}>☰<span className="sr-only">Menú</span></button>
          <span className="breadcrumb">Taller <span aria-hidden="true">/</span> {headings[base] ?? 'Página'}</span>
          <a className="profile" href="#/perfil"><span className="avatar">{user.full_name.at(0)}</span><span>{user.full_name}<small>{label(user.role)}</small></span></a>
        </header>
        <main className="main" tabIndex={-1} ref={main}>
          <div className="page-title">{detail && allowed && <button className="text-button" onClick={() => go(base)}>‹ Volver a {headings[base].toLowerCase()}</button>}<h1>{headings[base] ?? 'Página'}</h1></div>
          <div className="pages" key={route}>{content}</div>
        </main>
      </div>
    </div>
    {success && <div className="toast"><Alert ok>Operación guardada.</Alert></div>}
    {action && <ActionDialog spec={action} close={() => setAction(undefined)} onSuccess={() => { setAction(undefined); refresh(); setSuccess(true) }} />}
  </AppContext.Provider>
}
export default App

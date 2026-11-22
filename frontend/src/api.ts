export type Row = Record<string, unknown>
export type User = { id: number; full_name: string; username: string; role: 'gerente' | 'subgerente' | 'tecnico' | 'soporte' }
export type Session = { access_token: string; expires_at: string }
export type Method = 'POST' | 'PATCH' | 'GET'
export type Schema = {
  $ref?: string; anyOf?: Schema[]; type?: string; format?: string; pattern?: string;
  enum?: (string | boolean)[]; properties?: Record<string, Schema>; required?: string[];
  minLength?: number; maxLength?: number; minimum?: number; maximum?: number; exclusiveMinimum?: number;
}
type Operation = {
  requestBody?: { content: { 'application/json'?: { schema: Schema } } };
  parameters?: { name: string; in: string; required?: boolean; schema: Schema }[];
}
export type Contract = { paths: Record<string, Partial<Record<Lowercase<Method>, Operation>>>; components: { schemas: Record<string, Schema> } }
const api = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')
let token = ''
export function setToken(value: string) { token = value }

export function message(error: unknown) {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
}
export class ApiError extends Error {
  status: number
  constructor(status: number, detail: string) { super(detail); this.status = status }
}

export async function request<T>(path: string, method: Method = 'GET', body?: Row, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(api + (path === '/openapi.json' || path === '/health/db' ? path : '/api/v1' + path), {
      method, signal,
      headers: { ...(token && { Authorization: 'Bearer ' + token }), ...(body && { 'Content-Type': 'application/json' }) },
      body: body && JSON.stringify(body),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new Error('La API no está disponible. Verifica que el backend esté iniciado y vuelve a intentar.')
  }
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('peti:expired'))
    const detail = data?.detail
    const errors = Array.isArray(detail) ? detail.map(item => (item.loc?.at(-1) ?? 'Campo') + ' · ' + item.msg).join('. ') : ''
    throw new ApiError(response.status, response.status === 403 ? 'Tu perfil no tiene permiso para esta operación.' :
      errors || (typeof detail === 'string' ? detail : 'No se pudo completar la operación.'))
  }
  return data as T
}

export function query(path: string, values: Row) {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== '' && value != null) params.set(key, String(value))
  })
  return params.size ? path + '?' + params.toString() : path
}

export function resolve(contract: Contract, schema: Schema): Schema {
  if (schema.$ref) return resolve(contract, contract.components.schemas[schema.$ref.split('/').at(-1)!])
  if (schema.anyOf) {
    const subtype = schema.anyOf.find(item => item.type === 'string' && item.pattern) ?? schema.anyOf.find(item => item.type !== 'null')
    if (subtype) return { ...schema, ...resolve(contract, subtype) }
  }
  return schema
}

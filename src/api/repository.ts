/**
 * The data-access seam.
 *
 * A store never talks to `localStorage`, `fetch` or Axios directly. It depends on a
 * `Repository`, and exactly one line decides which adapter backs it. Swapping the
 * backend is therefore an adapter swap, not a rewrite of the store.
 *
 * The interface is deliberately small: `list` / `get` / `create` / `update` / `remove`.
 * Anything an adapter can do *extra* (bulk replace, synchronous reads) lives on the
 * adapter's own type, so replacing the adapter turns a silent behaviour change into a
 * compile error at the call site.
 *
 * See `docs/architecture.md` for the layer this sits in and `docs/data-adapters.md`
 * for the per-adapter contract.
 */
import { isApiError } from './errors'
import { request } from './http'
import type { ZodType } from 'zod'

/**
 * Query shape shared by every adapter.
 *
 * `page` / `pageSize` are optional on purpose: a local or in-memory repository returns
 * everything and the caller paginates in the view; a REST repository forwards them and
 * expects the server to page. A repository that ignores the fields is not broken — it
 * is documented as full-scan.
 */
export interface ListParams {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  filters?: Record<string, string>
}

export interface ListResult<T> {
  rows: T[]
  total: number
}

export interface Repository<T, TInput> {
  list(params?: ListParams, signal?: AbortSignal): Promise<ListResult<T>>
  get(id: string): Promise<T | null>
  create(input: TInput): Promise<T>
  update(id: string, input: TInput): Promise<T>
  remove(id: string): Promise<void>
}

/** Everything an entity needs for the local/memory adapters to address it. */
export interface Identifiable {
  id: string
}

/** How an adapter turns caller input into a stored entity, and merges an edit into one. */
export interface EntityCodec<T, TInput> {
  toEntity: (input: TInput) => T
  merge: (current: T, input: TInput) => T
}

export interface LocalRepositoryOptions<T extends Identifiable, TInput> extends EntityCodec<
  T,
  TInput
> {
  /** Versioned key, e.g. `orbit.tasks.v1`. A new shape means a new key, not a migration layer. */
  storageKey: string
  schema: ZodType<T[]>
  seed: () => T[]
}

/**
 * `localRepository` adds what only a local backend can offer. Keeping these off the
 * `Repository` interface is intentional: a REST adapter cannot store arbitrary rows, so
 * the compiler should stop you rather than the network.
 */
export type LocalRepository<T extends Identifiable, TInput> = Repository<T, TInput> & {
  /** Synchronous read for bootstrapping: `localStorage` is a synchronous API. */
  read: () => T[]
  /** Whole-collection replace. Demo tooling only — drop it when you switch to REST. */
  replaceAll: (rows: T[]) => Promise<void>
}

function ignorePersistenceFailure(): void {
  // Persistence is a progressive enhancement: the app stays usable when storage is full
  // or unavailable (private mode, hardened browser contexts).
}

export function localRepository<T extends Identifiable, TInput>(
  options: LocalRepositoryOptions<T, TInput>,
): LocalRepository<T, TInput> {
  const { storageKey, schema, seed, toEntity, merge } = options

  function read(): T[] {
    if (typeof localStorage === 'undefined') return seed()

    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return seed()

      const parsed: unknown = JSON.parse(raw)
      const result = schema.safeParse(parsed)
      return result.success ? result.data : seed()
    } catch {
      return seed()
    }
  }

  function write(rows: T[]): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(rows))
    } catch {
      ignorePersistenceFailure()
    }
  }

  return {
    read,

    async list(): Promise<ListResult<T>> {
      const rows = read()
      return { rows, total: rows.length }
    },

    async get(id: string): Promise<T | null> {
      return read().find((row) => row.id === id) ?? null
    },

    async create(input: TInput): Promise<T> {
      const entity = toEntity(input)
      write([entity, ...read()])
      return entity
    },

    async update(id: string, input: TInput): Promise<T> {
      const rows = read()
      const index = rows.findIndex((row) => row.id === id)
      const current = rows[index]

      if (!current) {
        throw new Error(`localRepository: no row with id "${id}" in ${storageKey}`)
      }

      const updated = merge(current, input)
      rows.splice(index, 1, updated)
      write(rows)
      return updated
    },

    async remove(id: string): Promise<void> {
      write(read().filter((row) => row.id !== id))
    },

    async replaceAll(rows: T[]): Promise<void> {
      write(rows)
    },
  }
}

export interface RestRepositoryOptions<T extends Identifiable> {
  /** Resource path relative to `VITE_API_BASE_URL`, e.g. `/tasks`. */
  basePath: string
  listSchema: ZodType<T[]>
  itemSchema: ZodType<T>
}

function toQuery(params?: ListParams): Record<string, string | number> | undefined {
  if (!params) return undefined

  const query: Record<string, string | number> = {}
  if (params.page !== undefined) query.page = params.page
  if (params.pageSize !== undefined) query.pageSize = params.pageSize
  if (params.search) query.search = params.search
  if (params.sortBy) query.sortBy = params.sortBy
  if (params.sortDir) query.sortDir = params.sortDir
  if (params.filters) Object.assign(query, params.filters)

  return Object.keys(query).length > 0 ? query : undefined
}

/**
 * The adapter a real backend uses. It forwards paging/sorting/filtering and validates
 * every response against a Zod schema, so the store keeps working with plain domain
 * objects no matter what the wire format looks like.
 *
 * Expected contract: a JSON array for `list`, a single object for the rest. If your
 * backend wraps responses in an envelope, unwrap it in `src/api/envelope.ts` first.
 */
export function restRepository<T extends Identifiable, TInput>(
  options: RestRepositoryOptions<T>,
): Repository<T, TInput> {
  const { basePath, listSchema, itemSchema } = options
  const itemUrl = (id: string): string => `${basePath}/${encodeURIComponent(id)}`

  return {
    async list(params?: ListParams, signal?: AbortSignal): Promise<ListResult<T>> {
      const payload = await request<unknown>({
        url: basePath,
        method: 'GET',
        params: toQuery(params),
        signal,
      })

      const rows = listSchema.parse(payload)
      return { rows, total: rows.length }
    },

    async get(id: string): Promise<T | null> {
      try {
        const payload = await request<unknown>({ url: itemUrl(id), method: 'GET' })
        return itemSchema.parse(payload)
      } catch (error) {
        if (isApiError(error) && error.code === 'notFound') return null
        throw error
      }
    },

    async create(input: TInput): Promise<T> {
      const payload = await request<unknown>({ url: basePath, method: 'POST', data: input })
      return itemSchema.parse(payload)
    },

    async update(id: string, input: TInput): Promise<T> {
      const payload = await request<unknown>({ url: itemUrl(id), method: 'PUT', data: input })
      return itemSchema.parse(payload)
    },

    async remove(id: string): Promise<void> {
      await request<void>({ url: itemUrl(id), method: 'DELETE' })
    },
  }
}

export interface MemoryRepositoryOptions<T extends Identifiable, TInput> extends EntityCodec<
  T,
  TInput
> {
  seed: () => T[]
}

/**
 * Zero-config adapter: no storage, no network. Use it for component tests and for demo
 * resources that must boot without a backend.
 */
export function memoryRepository<T extends Identifiable, TInput>(
  options: MemoryRepositoryOptions<T, TInput>,
): Repository<T, TInput> {
  const { seed, toEntity, merge } = options
  let rows = seed()

  return {
    async list(): Promise<ListResult<T>> {
      return { rows: [...rows], total: rows.length }
    },

    async get(id: string): Promise<T | null> {
      return rows.find((row) => row.id === id) ?? null
    },

    async create(input: TInput): Promise<T> {
      const entity = toEntity(input)
      rows = [entity, ...rows]
      return entity
    },

    async update(id: string, input: TInput): Promise<T> {
      const index = rows.findIndex((row) => row.id === id)
      const current = rows[index]

      if (!current) throw new Error(`memoryRepository: no row with id "${id}"`)

      const updated = merge(current, input)
      rows = rows.map((row, position) => (position === index ? updated : row))
      return updated
    },

    async remove(id: string): Promise<void> {
      rows = rows.filter((row) => row.id !== id)
    },
  }
}

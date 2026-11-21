import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ZodError, z } from 'zod'

import { http } from '@/api/http'
import type { Repository } from '@/api/repository'
import { localRepository, memoryRepository, restRepository } from '@/api/repository'

interface Widget {
  id: string
  name: string
  updatedAt: string
}

interface WidgetDraft {
  name: string
}

const widgetSchema = z.object({ id: z.string(), name: z.string(), updatedAt: z.string() })
const widgetListSchema = z.array(widgetSchema)

function seed(): Widget[] {
  return [
    { id: 'w1', name: 'alpha', updatedAt: 'stamp-0' },
    { id: 'w2', name: 'beta', updatedAt: 'stamp-0' },
  ]
}

/** Fresh counters per instance so ids and timestamps never collide across tests. */
function makeCodec(): {
  toEntity: (draft: WidgetDraft) => Widget
  merge: (current: Widget, draft: WidgetDraft) => Widget
} {
  let counter = 0

  return {
    toEntity: (draft) => {
      counter += 1
      return { id: `new-${counter}`, name: draft.name, updatedAt: `stamp-${counter}` }
    },
    merge: (current, draft) => {
      counter += 1
      return { ...current, ...draft, updatedAt: `stamp-${counter}` }
    },
  }
}

/**
 * The adapter contract. Every adapter that claims to be a `Repository` must pass these
 * unchanged — that is the whole point of the seam, and the reason this file exists.
 */
function runContract(makeRepository: () => Repository<Widget, WidgetDraft>): void {
  it('lists everything with a matching total', async () => {
    const repository = makeRepository()
    const { rows, total } = await repository.list()

    expect(total).toBe(2)
    expect(rows.map((row) => row.id)).toEqual(['w1', 'w2'])
  })

  it('creates without losing existing rows', async () => {
    const repository = makeRepository()
    const created = await repository.create({ name: 'gamma' })
    const { rows, total } = await repository.list()

    expect(total).toBe(3)
    expect(rows.filter((row) => row.id === created.id)).toHaveLength(1)
  })

  it('gets a row, and null for a missing id', async () => {
    const repository = makeRepository()

    expect((await repository.get('w1'))?.name).toBe('alpha')
    expect(await repository.get('nope')).toBeNull()
  })

  it('updates in place and moves updatedAt', async () => {
    const repository = makeRepository()
    const updated = await repository.update('w1', { name: 'renamed' })

    expect(updated.name).toBe('renamed')
    expect(updated.updatedAt).not.toBe('stamp-0')
    expect((await repository.get('w1'))?.name).toBe('renamed')
  })

  it('rejects updating an id it does not have', async () => {
    const repository = makeRepository()

    await expect(repository.update('nope', { name: 'x' })).rejects.toThrow(/no row with id/)
  })

  it('removes a row and leaves the rest', async () => {
    const repository = makeRepository()
    await repository.remove('w1')
    const { rows, total } = await repository.list()

    expect(total).toBe(1)
    expect(rows.some((row) => row.id === 'w1')).toBe(false)
  })
}

describe('localRepository', () => {
  beforeEach(() => localStorage.clear())

  runContract(() =>
    localRepository<Widget, WidgetDraft>({
      storageKey: 'test.widgets.v1',
      schema: widgetListSchema,
      seed,
      ...makeCodec(),
    }),
  )

  it('persists across instances (same storage key)', async () => {
    const makeRepository = (): Repository<Widget, WidgetDraft> =>
      localRepository<Widget, WidgetDraft>({
        storageKey: 'test.widgets.v1',
        schema: widgetListSchema,
        seed,
        ...makeCodec(),
      })

    await makeRepository().create({ name: 'durable' })

    const { total } = await makeRepository().list()
    expect(total).toBe(3)
  })

  it('falls back to the seed when stored data does not match the schema', async () => {
    localStorage.setItem('test.widgets.v1', JSON.stringify([{ id: 1 }]))

    const repository = localRepository<Widget, WidgetDraft>({
      storageKey: 'test.widgets.v1',
      schema: widgetListSchema,
      seed,
      ...makeCodec(),
    })

    expect((await repository.list()).total).toBe(2)
  })

  it('replaces the whole collection through replaceAll', async () => {
    const repository = localRepository<Widget, WidgetDraft>({
      storageKey: 'test.widgets.v1',
      schema: widgetListSchema,
      seed,
      ...makeCodec(),
    })

    await repository.replaceAll([{ id: 'only', name: 'solo', updatedAt: 'stamp-0' }])

    expect((await repository.list()).rows.map((row) => row.id)).toEqual(['only'])
  })
})

describe('memoryRepository', () => {
  runContract(() =>
    memoryRepository<Widget, WidgetDraft>({
      seed,
      ...makeCodec(),
    }),
  )

  it('does not touch storage', async () => {
    localStorage.clear()
    const repository = memoryRepository<Widget, WidgetDraft>({ seed, ...makeCodec() })

    await repository.create({ name: 'volatile' })

    expect(localStorage.length).toBe(0)
  })
})

describe('restRepository', () => {
  const originalAdapter = http.defaults.adapter

  afterEach(() => {
    http.defaults.adapter = originalAdapter
  })

  function respondWith(
    payload: unknown,
    onRequest?: (config: InternalAxiosRequestConfig) => void,
  ): void {
    const adapter: AxiosAdapter = async (config) => {
      onRequest?.(config)

      return {
        data: payload,
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config,
      }
    }

    http.defaults.adapter = adapter
  }

  function failWith(status: number): void {
    const adapter: AxiosAdapter = async (config) => {
      throw new AxiosError(`status ${status}`, 'ERR_BAD_REQUEST', config, undefined, {
        data: null,
        status,
        statusText: 'Error',
        headers: new AxiosHeaders(),
        config,
      })
    }

    http.defaults.adapter = adapter
  }

  const makeRest = (): Repository<Widget, WidgetDraft> =>
    restRepository<Widget, WidgetDraft>({
      basePath: '/widgets',
      listSchema: widgetListSchema,
      itemSchema: widgetSchema,
    })

  it('validates the list payload against the schema', async () => {
    respondWith([{ id: 'w9', name: 'server', updatedAt: 'stamp-0' }])

    const { rows, total } = await makeRest().list({ page: 1, pageSize: 20, search: 'ser' })

    expect(total).toBe(1)
    expect(rows[0]?.id).toBe('w9')
  })

  it('rejects a list payload that drifts from the schema', async () => {
    respondWith([{ id: 9 }])

    await expect(makeRest().list()).rejects.toThrow(ZodError)
  })

  it('forwards paging, sorting and filters as query params', async () => {
    let captured: InternalAxiosRequestConfig | undefined
    respondWith([], (config) => {
      captured = config
    })

    await makeRest().list({
      page: 2,
      pageSize: 50,
      search: 'abc',
      sortBy: 'name',
      sortDir: 'desc',
      filters: { status: 'todo' },
    })

    expect(captured?.params).toEqual({
      page: 2,
      pageSize: 50,
      search: 'abc',
      sortBy: 'name',
      sortDir: 'desc',
      status: 'todo',
    })
  })

  it('maps a 404 on get to null instead of throwing', async () => {
    failWith(404)

    expect(await makeRest().get('missing')).toBeNull()
  })

  it('sends create as POST and returns the parsed entity', async () => {
    let method: string | undefined
    respondWith({ id: 'w7', name: 'new', updatedAt: 'stamp-0' }, (config) => {
      method = config.method
    })

    const created = await makeRest().create({ name: 'new' })

    expect(method).toBe('post')
    expect(created.id).toBe('w7')
  })

  it('URL-encodes ids on update and delete', async () => {
    const urls: string[] = []
    respondWith({ id: 'a/b', name: 'x', updatedAt: 'stamp-0' }, (config) => {
      urls.push(config.url ?? '')
    })

    const repository = makeRest()
    await repository.update('a/b', { name: 'x' })
    await repository.remove('a/b')

    expect(urls).toEqual(['/widgets/a%2Fb', '/widgets/a%2Fb'])
  })
})

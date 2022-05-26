import * as fs from 'fs/promises'

export type DatabaseAdapterConfig = { type?: 'memory' } | { type: 'json', path: string }

export const createAdapter = async (config?: DatabaseAdapterConfig) => {
  if (!config || !config.type || config.type === 'memory') {
    console.log('INFO: Using in-memory database adapter')
    return createInMemoryAdapter()
  } else if (config.type === 'json') {
    console.log('INFO: Using json database adapter')
    return await createJsonAdapter(config.path)
  }
  console.log('WARN: Default to in memory adapter due to invalid config')
  return createInMemoryAdapter()
}

export type DatabaseAdapter = {
  get<T>(key: string): Promise<T | null>
  get<T>(key: string, defaultValue: T): Promise<T>
  set<T>(key: string, value: T): Promise<unknown>
  del(key: string): Promise<unknown>
}

export const createInMemoryAdapter = (): DatabaseAdapter => {
  const data = new Map<string, any>()

  return {
    get: (key, defaultValue = null) =>
      Promise.resolve(JSON.parse(data.get(key) ?? JSON.stringify(defaultValue))),
    set: (key, value) =>
      Promise.resolve(data.set(key, JSON.stringify(value))),
    del: key =>
      Promise.resolve(data.delete(key))
  }
}

export const createJsonAdapter = async (filename: string): Promise<DatabaseAdapter> => {
  const data = JSON.parse(await fs.readFile(filename, { encoding: 'utf-8' }).catch(() => '{}'))

  return {
    get: (key, defaultValue = null) =>
      Promise.resolve(JSON.parse(data[key] ?? JSON.stringify(defaultValue))),
    set: (key, value) => {
      data[key] = JSON.stringify(value)
      return fs.writeFile(filename, JSON.stringify(data, undefined, 2))
    },
    del: (key) => {
      delete data[key]
      return fs.writeFile(filename, JSON.stringify(data, undefined, 2))
    }
  }
}

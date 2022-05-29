import * as fs from 'fs/promises'

export type DatabaseAdapterConfig = { type?: 'memory' } | { type: 'json', path: string } | { type: 'dynamodb', table: string, region: string }

export const createAdapter = async (config?: DatabaseAdapterConfig) => {
  if (!config || !config.type || config.type === 'memory') {
    console.log('INFO: Using in-memory database adapter')
    return createInMemoryAdapter()
  } else if (config.type === 'json') {
    console.log('INFO: Using json database adapter')
    return await createJsonAdapter(config.path)
  } else if (config.type === 'dynamodb') {
    console.log('INFO: Using dynamodb adapter')
    return await createDynamoDBAdapter(config.table, config.region)
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

export const createDynamoDBAdapter = async (table: string, region: string): Promise<DatabaseAdapter> => {
  const { default: aws } = await import('aws-sdk')
  const ddb = new aws.DynamoDB({ region })

  return {
    get: async (key, defaultValue = null) => {
      const result = await ddb
        .getItem({
          TableName: table,
          Key: {
            Id: { S: key }
          }
        })
        .promise()

      return JSON.parse(result.Item?.Data.S ?? JSON.stringify(defaultValue))
    },
    set: async (key, value) => {
      await ddb
        .putItem({
          TableName: table,
          Item: {
            Id: { S: key },
            Data: { S: JSON.stringify(value) }
          }
        })
        .promise()
    },
    del: async (key) => {
      await ddb
        .deleteItem({
          TableName: table,
          Key: {
            Id: { S: key }
          }
        })
        .promise()
    }
  }
}

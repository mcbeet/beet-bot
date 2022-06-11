import { PoolRunner } from '@beet-bot/runner'
import { BuildInfo } from './report'

export const invokeBuild = async (runner: PoolRunner, name: string, config: any, input: string): Promise<BuildInfo> => {
  if (!Array.isArray(config.pipeline)) {
    config.pipeline = []
  }

  config.pipeline.unshift('lectern.contrib.messaging')

  if (typeof config.meta !== 'object') {
    config.meta = {}
  }

  if (typeof config.meta.messaging !== 'object') {
    config.meta.messaging = {}
  }

  config.meta.messaging.input = input

  try {
    return await runner(name, config)
  } catch (err) {
    return {
      status: 'error',
      error: {
        message: `${err}`
      }
    }
  }
}

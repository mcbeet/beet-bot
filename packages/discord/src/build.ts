import { PoolRunner } from '@beet-bot/runner'
import { BuildInfo } from './report'

export const invokeBuild = async (runner: PoolRunner, name: string, data: any, input: string, showReport: (info: BuildInfo) => Promise<void>) => {
  if (!data.pipeline) {
    data.pipeline = []
  }

  data.pipeline.unshift('lectern.contrib.messaging')

  if (!data.meta) {
    data.meta = {}
  }

  if (!data.meta.messaging) {
    data.meta.messaging = {}
  }

  data.meta.messaging.input = input

  let result

  try {
    result = await runner(name, data)
  } catch (err) {
    await showReport({
      status: 'error',
      error: {
        message: `${err}`
      }
    })
    return
  }

  await showReport(result)
}

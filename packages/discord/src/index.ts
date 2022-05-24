import { PoolRunner } from '@beet-bot/runner'

export type BeetBotOptions = {
  clientId: string
  token: string
  runner: PoolRunner
}

export const runBeetBot = async ({ runner }: BeetBotOptions) => {
  await new Promise(resolve => setTimeout(resolve, 4000))
  console.log(await runner('default', {
    require: ['bolt'],
    pipeline: ['lectern.contrib.messaging', 'mecha'],
    meta: {
      messaging: {
        input: `
        print("hey")
        import time
        say time.time()
      `
      }
    }
  }))
}

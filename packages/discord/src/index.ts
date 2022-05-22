import { createPool } from '@beet-bot/runner'

export type BeetBotOptions = {
  clientId: string
  token: string
}
export const runBeetBot = (_: BeetBotOptions) => {
  createPool()
}

import { createPoolRunner, EnvironmentOptions } from '@beet-bot/runner'
import { REST } from '@discordjs/rest'
import { Client, Intents } from 'discord.js'
import { handleInteractions } from './handle'
import { createAdapter, DatabaseAdapterConfig } from './adapter'
import { createDatabase } from './database'

export type BeetBotOptions = {
  clientId: string
  token: string
  database?: DatabaseAdapterConfig
  environments?: Record<string, EnvironmentOptions>
}

export const runBeetBot = async ({ clientId, token, database, environments }: BeetBotOptions) => {
  const discordClient = new Client({ intents: [Intents.FLAGS.GUILDS] })
  const discordApi = new REST({ version: '10' }).setToken(token)

  handleInteractions({
    clientId,
    discordClient,
    discordApi,
    db: createDatabase(await createAdapter(database)),
    environments: ['default', 'custom'], // Object.keys(environments ?? {}),
    runner: createPoolRunner(environments)
  })

  discordClient.login(token)
}

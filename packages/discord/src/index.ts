import { createPoolRunner, EnvironmentOptions } from '@beet-bot/runner'
import { REST } from '@discordjs/rest'
import { Client, Intents } from 'discord.js'
import { handleInteractions } from './handle'
import { createAdapter, DatabaseAdapterConfig } from './adapter'
import { createDatabase } from './database'

// TODO
// - dynamodb

export type BeetBotOptions = {
  clientId: string
  token: string
  awsRegion?: string
  database?: DatabaseAdapterConfig
  environments?: Record<string, EnvironmentOptions>
}

export const runBeetBot = async ({ clientId, token, awsRegion, database, environments }: BeetBotOptions) => {
  if (clientId.startsWith('ssm:') || token.startsWith('ssm:')) {
    const { default: aws } = await import('aws-sdk')
    const ssm = new aws.SSM({ region: awsRegion })

    if (clientId.startsWith('ssm:')) {
      const result = await ssm.getParameter({ Name: clientId.slice(4) }).promise()
      if (!result.Parameter?.Value) {
        console.log(`ERROR: Failed to retrieve clientId parameter "${clientId}"`)
        process.exit(1)
      }
      clientId = result.Parameter.Value
    }

    if (token.startsWith('ssm:')) {
      const result = await ssm.getParameter({ Name: token.slice(4), WithDecryption: true }).promise()
      if (!result.Parameter?.Value) {
        console.log(`ERROR: Failed to retrieve token parameter "${token}"`)
        process.exit(1)
      }
      token = result.Parameter.Value
    }
  }

  const discordClient = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] })
  const discordApi = new REST({ version: '10' }).setToken(token)

  handleInteractions({
    clientId,
    discordClient,
    discordApi,
    db: createDatabase(await createAdapter(database)),
    environments: Object.keys(environments ?? {}),
    runner: createPoolRunner(environments)
  })

  discordClient.login(token)
}

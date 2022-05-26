#!/usr/bin/env node
import * as fs from 'fs/promises'
import mri from 'mri'
import * as dotenv from 'dotenv'
import { runBeetBot } from '@beet-bot/discord'

const main = async () => {
  dotenv.config()
  const { clientId, token, config } = mri(process.argv.slice(2), {
    string: ['clientId', 'token', 'config'],
    default: {
      clientId: process.env.BEET_BOT_CLIENT_ID,
      token: process.env.BEET_BOT_TOKEN,
      config: process.env.BEET_BOT_CONFIG
    }
  })

  clientId || console.log('ERROR: Missing "--clientId=..." option or BEET_BOT_CLIENT_ID environment variable')
  token || console.log('ERROR: Missing "--token=..." option or BEET_BOT_TOKEN environment variable')

  if (!clientId || !token) {
    process.exit(1)
  }

  let database = {}
  let environments = {}

  if (config) {
    try {
      const data = JSON.parse(await fs.readFile(config, { encoding: 'utf-8' }))

      if (typeof data.database === 'object') {
        database = data.database
      }

      if (typeof data.environments === 'object') {
        environments = data.environments
      }
    } catch {
      console.log(`ERROR: Couldn't load runner config at "${config}"`)
      process.exit(1)
    }
  }

  console.log(`INFO: Starting bot with ${Object.keys(environments).length} environment(s)`)

  runBeetBot({
    clientId,
    token,
    database,
    environments
  })
}

main()

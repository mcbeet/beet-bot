import mri from 'mri'
import { config } from 'dotenv'
import { runBeetBot } from '@beet-bot/discord'

const main = () => {
  config()
  const { clientId, token } = mri(process.argv.slice(2), {
    string: ['clientId', 'token'],
    default: {
      clientId: process.env.BEET_BOT_CLIENT_ID,
      token: process.env.BEET_BOT_TOKEN
    }
  })

  clientId || console.log('ERROR: Missing "--clientId=..." option or BEET_BOT_CLIENT_ID environment variable')
  token || console.log('ERROR: Missing "--token=..." option or BEET_BOT_TOKEN environment variable')

  if (!clientId || !token) {
    process.exit(1)
  }

  runBeetBot({ clientId, token })
}

main()

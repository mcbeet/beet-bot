import { PoolRunner } from '@beet-bot/runner'
import { Message } from 'discord.js'
import { BuildInfo } from './report'
import { GuildInfo } from './database'
import { downloadAsBase64Url } from './download'

export const packMessage = async (message?: Message) => {
  let input = ''

  if (!message) {
    return input
  }

  for (const attachment of message.attachments.values()) {
    if (attachment.contentType === 'application/zip') {
      try {
        // Download the attachment now because python's urlopen() gets a 403 (user-agent issues)
        const base64 = await downloadAsBase64Url(attachment.url, attachment.contentType)
        input += '```\n@merge_zip(download)\n' + base64 + '\n```\n'
      } catch (err) {
        console.log(`ERROR: ${err}`)
      }
    }
  }

  input += message.content

  return input
}

export const resolveActionOverrides = (config: any, guildInfo: GuildInfo) : any => {
  if (Array.isArray(config.overrides)) {
    return {
      ...config,
      overrides: config.overrides.map((override: any) => {
        if (typeof override === 'string' && override.startsWith('!')) {
          const actionId = override.substring(1)
          const action = guildInfo.actions[actionId]
          if (action) {
            return JSON.stringify(resolveActionOverrides(action.config, guildInfo))
          }
        }
        return override
      })
    }
  }
  return config
}

export const invokeBuild = async (runner: PoolRunner, name: string, config: any, message?: Message): Promise<BuildInfo> => {
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

  config.meta.messaging.input = await packMessage(message)

  try {
    return await runner.build(name, config)
  } catch (err) {
    return {
      status: 'error',
      error: {
        message: `${err}`
      }
    }
  }
}

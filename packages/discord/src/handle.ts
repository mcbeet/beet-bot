import { Routes } from 'discord-api-types/v10'
import { CacheType, Client, SelectMenuInteraction } from 'discord.js'
import { REST } from '@discordjs/rest'
import { PoolRunner } from '@beet-bot/runner'
import { Database } from './database'
import { generateGuildCommands } from './commands'
import { ConfigDashboardOptions, createConfigChoice, createConfigDashboard, createEditConfigModal } from './widgets'
import { createReport } from './report'
import { invokeBuild } from './build'

export type BeetBotContext = {
  clientId: string
  discordClient: Client
  discordApi: REST
  db: Database
  environments: string[]
  runner: PoolRunner
}

export const handleInteractions = ({ clientId, discordClient, discordApi, db, environments, runner }: BeetBotContext) => {
  const updateGuildCommands = async (guildId: string) => {
    try {
      await discordApi.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: generateGuildCommands(await db.getGuildInfo(guildId))
      })
      console.log(`INFO: Updated commands for guild ${guildId}`)
    } catch (err) {
      console.log(`ERROR: Failed to update commands for guild ${guildId}`)
    }
  }

  discordClient.on('ready', async () => {
    console.log('INFO: Client is ready')
    const allGuilds = await db.getAllGuilds()
    await Promise.all(allGuilds.map(updateGuildCommands))
  })

  const addGuild = async (guildId: string) => {
    const allGuilds = await db.getAllGuilds()
    if (!allGuilds.includes(guildId)) {
      await db.setAllGuilds([...allGuilds, guildId])
      console.log(`INFO: Added ${guildId} to guild registry`)
    }
  }

  const removeGuild = async (guildId: string) => {
    const allGuilds = await db.getAllGuilds()
    if (allGuilds.includes(guildId)) {
      await db.setAllGuilds(allGuilds.filter(id => id !== guildId))
      console.log(`INFO: Removed ${guildId} from guild registry`)
    }
    await db.delGuildInfo(guildId)
  }

  discordClient.on('guildCreate', async (guild) => {
    console.log(`INFO: Joined guild ${guild.id}`)
    await addGuild(guild.id)
    await updateGuildCommands(guild.id)
  })

  discordClient.on('guildDelete', async (guild) => {
    console.log(`INFO: Left guild ${guild.id}`)
    await removeGuild(guild.id)
  })

  discordClient.on('roleUpdate', async (role) => {
    console.log(`INFO: Role updated in guild ${role.guild.id}`)
    await addGuild(role.guild.id)
    await updateGuildCommands(role.guild.id)
  })

  discordClient.on('messageCreate', async (message) => {
    if (!message.author.bot && message.inGuild() && message.mentions.users.has(clientId)) {
      const guildInfo = await db.getGuildInfo(message.guildId)

      const reply = await message.reply(createConfigChoice(guildInfo))

      let interaction: SelectMenuInteraction<CacheType>

      try {
        interaction = await reply.awaitMessageComponent({
          componentType: 'SELECT_MENU',
          time: 15000,
          filter: (interaction) => {
            if (interaction.user.id === message.author.id) {
              return true
            } else {
              interaction.deferUpdate()
              return false
            }
          }
        })
      } catch (err) {
        await reply.delete()
        return
      }

      const configId = interaction.values[0]
      const { runner: name, data } = guildInfo.configurations[configId]

      let deferred = false
      const tid = setTimeout(() => {
        deferred = true
        interaction.deferUpdate()
      }, 800)

      await invokeBuild(runner, name, data, message.content, async (info) => {
        if (deferred) {
          await interaction.editReply(createReport(info))
        } else {
          clearTimeout(tid)
          await interaction.update(createReport(info))
        }
      })
    }
  })

  discordClient.on('interactionCreate', async (interaction) => {
    if (interaction.inGuild() && interaction.isCommand()) {
      if (interaction.commandName === 'bconf') {
        const guildInfo = await db.getGuildInfo(interaction.guildId)
        const currentConfigs = Object.keys(guildInfo.configurations)
        const configId = interaction.options.getString('config')

        if (configId) {
          if (configId.match(/^>?[a-zA-Z0-9_]{3,20}$/)) {
            if (
              currentConfigs.includes(configId) ||
              !configId.startsWith('>') ||
              currentConfigs.filter(id => id.startsWith('>')).length < 5) {
              await interaction.showModal(createEditConfigModal({
                guildInfo,
                selected: configId,
                immediate: true
              }))
            } else {
              await interaction.reply(createConfigDashboard({
                guildInfo,
                error: 'Already reached limit of 5 context menu configurations'
              }))
            }
          } else {
            await interaction.reply(createConfigDashboard({
              guildInfo,
              error: `Invalid configuration id \`${configId}\``
            }))
          }
        } else {
          await interaction.reply(createConfigDashboard({
            guildInfo
          }))
        }
      }
    }

    if (interaction.inGuild() && interaction.isSelectMenu()) {
      const [scope, name] = interaction.customId.split('.')

      if (scope === 'configDashboard' && name === 'configId') {
        const guildInfo = await db.getGuildInfo(interaction.guildId)
        await interaction.update(createConfigDashboard({
          guildInfo,
          selected: interaction.values[0]
        }))
      }
    }

    if (interaction.inGuild() && interaction.isButton()) {
      const [scope, name, configId] = interaction.customId.split('.')

      if (scope === 'configDashboard') {
        const guildInfo = await db.getGuildInfo(interaction.guildId)

        if (name === 'buttonEditSelected') {
          await interaction.showModal(createEditConfigModal({
            guildInfo,
            selected: configId
          }))
        } else if (name === 'buttonDeleteSelected') {
          delete guildInfo.configurations[configId]
          await db.setGuildInfo(interaction.guildId, guildInfo)
          await interaction.update(createConfigDashboard({
            guildInfo,
            success: `Successfully deleted configuration \`${configId}\``
          }))
          await updateGuildCommands(interaction.guildId)
        }
      }
    }

    if (interaction.inGuild() && interaction.isModalSubmit()) {
      const [scope, name] = interaction.customId.split('.')

      if (scope === 'editConfig' || scope === 'editConfigImmediate') {
        const updateDashboard = (options: ConfigDashboardOptions) =>
          scope === 'editConfigImmediate'
            ? interaction.reply(createConfigDashboard(options))
            : interaction.update(createConfigDashboard(options))

        const guildInfo = await db.getGuildInfo(interaction.guildId)

        const configId = name
        const newConfigId = interaction.fields.getTextInputValue('editConfig.configId')
        const newConfigTitle = interaction.fields.getTextInputValue('editConfig.configTitle')
        const newConfigRunner = interaction.fields.getTextInputValue('editConfig.configRunner')
        let newConfigData = interaction.fields.getTextInputValue('editConfig.configData')

        if (!newConfigId.match(/^>?[a-zA-Z0-9_]{3,20}$/)) {
          await updateDashboard({
            guildInfo,
            selected: configId,
            error: `Invalid configuration id \`${newConfigId}\``
          })
          return
        }

        if (newConfigId !== configId &&
          newConfigId.startsWith('>') &&
          Object.keys(guildInfo.configurations).filter(id => id !== configId && id.startsWith('>')).length >= 5) {
          await updateDashboard({
            guildInfo,
            error: 'Already reached limit of 5 context menu configurations'
          })
          return
        }

        if (!environments.includes(newConfigRunner)) {
          await updateDashboard({
            guildInfo,
            selected: configId,
            error: `Invalid runner \`${newConfigRunner}\``
          })
          return
        }

        try {
          newConfigData = JSON.parse(newConfigData)
        } catch {
          await updateDashboard({
            guildInfo,
            selected: configId,
            error: "Couldn't parse json configuration\n```\n" + newConfigData + '\n```'
          })
          return
        }

        if (typeof newConfigData !== 'object') {
          await updateDashboard({
            guildInfo,
            selected: configId,
            error: 'Configuration must be a json object\n```\n' + JSON.stringify(newConfigData, undefined, 2) + '\n```'
          })
          return
        }

        delete guildInfo.configurations[configId]
        guildInfo.configurations[newConfigId] = {
          title: newConfigTitle,
          runner: newConfigRunner,
          data: newConfigData
        }

        await db.setGuildInfo(interaction.guildId, guildInfo)

        updateDashboard({
          guildInfo,
          selected: newConfigId,
          success: `Successfully updated configuration \`${newConfigId}\``
        })

        await updateGuildCommands(interaction.guildId)
      }
    }

    if (interaction.inGuild() && interaction.isMessageContextMenu()) {
      const guildInfo = await db.getGuildInfo(interaction.guildId)
      const configMatch = Object.values(guildInfo.configurations).filter(config => config.title === interaction.commandName)

      if (configMatch.length > 0) {
        const { runner: name, data } = configMatch[0]

        let deferred = false
        const tid = setTimeout(() => {
          deferred = true
          interaction.deferReply()
        }, 800)

        await invokeBuild(runner, name, data, interaction.targetMessage.content, async (info) => {
          if (deferred) {
            await interaction.editReply(createReport(info))
          } else {
            clearTimeout(tid)
            await interaction.reply(createReport(info))
          }
        })
      }
    }
  })
}

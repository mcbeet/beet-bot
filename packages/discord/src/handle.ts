import { Routes } from 'discord-api-types/v10'
import { Client } from 'discord.js'
import { REST } from '@discordjs/rest'
import { PoolRunner } from '@beet-bot/runner'
import { Database } from './database'
import { generateGuildCommands } from './commands'
import { createConfigDashboard, createEditConfigModal } from './widgets'

export type BeetBotContext = {
  clientId: string
  discordClient: Client
  discordApi: REST
  db: Database
  environments: string[]
  runner: PoolRunner
}

export const handleInteractions = ({ clientId, discordClient, discordApi, db, environments }: BeetBotContext) => {
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

  discordClient.on('interactionCreate', async (interaction) => {
    if (interaction.inGuild() && interaction.isCommand()) {
      if (interaction.commandName === 'bconf') {
        const guildInfo = await db.getGuildInfo(interaction.guildId)
        const configId = interaction.options.getString('id')

        if (configId) {
          if (configId.match(/^[a-zA-Z0-9_]{3,20}$/)) {
            await interaction.showModal(createEditConfigModal(guildInfo, configId))
          } else {
            await interaction.reply(createConfigDashboard({
              guildInfo,
              error: `Invalid configuration id \`${configId}\``,
              ephemeral: true
            }))
          }
        } else {
          await interaction.reply(createConfigDashboard({
            guildInfo,
            ephemeral: true
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

        if (name === 'actionEditSelected') {
          await interaction.showModal(createEditConfigModal(guildInfo, configId))
        } else if (name === 'actionDeleteSelected') {
          delete guildInfo.configurations[configId]
          await db.setGuildInfo(interaction.guildId, guildInfo)
          await interaction.update(createConfigDashboard({
            guildInfo,
            success: `Successfully deleted configuration \`${configId}\``
          }))
        }
      }
    }

    if (interaction.inGuild() && interaction.isModalSubmit()) {
      const [scope, name] = interaction.customId.split('.')

      if (scope === 'editConfig') {
        const guildInfo = await db.getGuildInfo(interaction.guildId)

        const configId = name
        const newConfigId = interaction.fields.getTextInputValue('editConfig.configId')
        const newConfigTitle = interaction.fields.getTextInputValue('editConfig.configTitle')
        const newConfigRunner = interaction.fields.getTextInputValue('editConfig.configRunner')
        let newConfigData = interaction.fields.getTextInputValue('editConfig.configData')

        if (!newConfigId.match(/^[a-zA-Z0-9_]{3,20}$/)) {
          return interaction.reply(createConfigDashboard({
            guildInfo,
            selected: configId,
            error: `Invalid configuration id \`${newConfigId}\``,
            ephemeral: true
          }))
        }

        if (!environments.includes(newConfigRunner)) {
          return interaction.reply(createConfigDashboard({
            guildInfo,
            selected: configId,
            error: `Invalid runner \`${newConfigRunner}\``,
            ephemeral: true
          }))
        }

        try {
          newConfigData = JSON.parse(newConfigData)
        } catch {
          return interaction.reply(createConfigDashboard({
            guildInfo,
            selected: configId,
            error: "Couldn't parse json configuration\n```\n" + newConfigData + '\n```',
            ephemeral: true
          }))
        }

        if (typeof newConfigData !== 'object') {
          return interaction.reply(createConfigDashboard({
            guildInfo,
            selected: configId,
            error: 'Configuration must be a json object\n```\n' + JSON.stringify(newConfigData, undefined, 2) + '\n```',
            ephemeral: true
          }))
        }

        delete guildInfo.configurations[configId]
        guildInfo.configurations[newConfigId] = {
          title: newConfigTitle,
          runner: newConfigRunner,
          data: newConfigData
        }

        await db.setGuildInfo(interaction.guildId, guildInfo)

        interaction.reply(createConfigDashboard({
          guildInfo,
          selected: newConfigId,
          success: `Successfully updated configuration \`${newConfigId}\``,
          ephemeral: true
        }))
      }
    }
  })
}

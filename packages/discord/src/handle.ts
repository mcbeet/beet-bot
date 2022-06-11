import { Routes } from 'discord-api-types/v10'
import { CacheType, Client, MessageEmbed, SelectMenuInteraction } from 'discord.js'
import { REST } from '@discordjs/rest'
import { PoolRunner } from '@beet-bot/runner'
import { version } from '../package.json'
import { Database } from './database'
import { generateGuildCommands } from './commands'
import { ActionDashboardOptions, createActionChoice, createActionDashboard, createEditActionModal } from './widgets'
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
      console.log(err)
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

      const reply = await message.reply(createActionChoice(guildInfo))

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

      const actionId = interaction.values[0]
      const { runner: name, config } = guildInfo.actions[actionId]

      let deferred = false
      const tid = setTimeout(() => {
        deferred = true
        interaction.deferUpdate()
      }, 800)

      const info = await invokeBuild(runner, name, config, message.content)

      if (deferred) {
        await interaction.editReply(createReport(info))
      } else {
        clearTimeout(tid)
        await interaction.update(createReport(info))
      }
    }
  })

  discordClient.on('interactionCreate', async (interaction) => {
    if (interaction.inGuild() && interaction.isCommand()) {
      if (interaction.commandName === 'bbinfo') {
        let info = 'beet-bot v' + version + '\nuptime: '
        let uptime = process.uptime()

        for (const [unit, resolution] of [['second', 60], ['minute', 60], ['hour', 24], ['day', Infinity]] as const) {
          if (uptime < resolution) {
            info += new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-Math.floor(uptime), unit)
            break
          } else {
            uptime /= resolution
          }
        }

        info += '\nenvironments: ' + environments.join(', ') + '\n'
        await interaction.reply('```' + info + '```')
      } else if (interaction.commandName === 'bbaction') {
        const guildInfo = await db.getGuildInfo(interaction.guildId)
        const currentActions = Object.keys(guildInfo.actions)
        const actionId = interaction.options.getString('action')

        if (actionId) {
          if (actionId.match(/^(?:menu:)?[a-zA-Z0-9_]{3,20}$/)) {
            if (
              currentActions.includes(actionId) ||
              !actionId.startsWith('menu:') ||
              currentActions.filter(id => id.startsWith('menu:')).length < 5) {
              await interaction.showModal(createEditActionModal({
                guildInfo,
                selected: actionId,
                immediate: true
              }))
            } else {
              await interaction.reply(createActionDashboard({
                guildInfo,
                error: 'Already reached limit of 5 context menu actions'
              }))
            }
          } else {
            await interaction.reply(createActionDashboard({
              guildInfo,
              error: `Invalid action id \`${actionId}\``
            }))
          }
        } else {
          await interaction.reply(createActionDashboard({
            guildInfo
          }))
        }
      } else if (interaction.commandName === 'bbstop') {
        await interaction.reply({
          embeds: [new MessageEmbed().setDescription('I don\'t feel so good...').setColor('#FFCC00')]
        })
        await discordClient.destroy()
        process.exit()
      }
    }

    if (interaction.inGuild() && interaction.isSelectMenu()) {
      const [scope, name] = interaction.customId.split('.')

      if (scope === 'actionDashboard' && name === 'actionId') {
        const guildInfo = await db.getGuildInfo(interaction.guildId)
        await interaction.update(createActionDashboard({
          guildInfo,
          selected: interaction.values[0]
        }))
      }
    }

    if (interaction.inGuild() && interaction.isButton()) {
      const [scope, name, actionId] = interaction.customId.split('.')

      if (scope === 'actionDashboard') {
        const guildInfo = await db.getGuildInfo(interaction.guildId)

        if (name === 'buttonEditSelected') {
          await interaction.showModal(createEditActionModal({
            guildInfo,
            selected: actionId
          }))
        } else if (name === 'buttonDeleteSelected') {
          delete guildInfo.actions[actionId]
          await db.setGuildInfo(interaction.guildId, guildInfo)
          await interaction.update(createActionDashboard({
            guildInfo,
            success: `Successfully deleted action \`${actionId}\``
          }))
          if (actionId.startsWith('menu:')) {
            await updateGuildCommands(interaction.guildId)
          }
        }
      }
    }

    if (interaction.inGuild() && interaction.isModalSubmit()) {
      const [scope, name] = interaction.customId.split('.')

      if (scope === 'editAction' || scope === 'editActionImmediate') {
        const updateDashboard = (options: ActionDashboardOptions) =>
          scope === 'editActionImmediate'
            ? interaction.reply(createActionDashboard(options))
            : interaction.update(createActionDashboard(options))

        const guildInfo = await db.getGuildInfo(interaction.guildId)

        const actionId = name
        const newActionId = interaction.fields.getTextInputValue('editAction.actionId')
        const newActionTitle = interaction.fields.getTextInputValue('editAction.actionTitle')
        const newActionRunner = interaction.fields.getTextInputValue('editAction.actionRunner')
        let newActionConfig = interaction.fields.getTextInputValue('editAction.actionConfig')

        if (!newActionId.match(/^(?:menu:)?[a-zA-Z0-9_]{3,20}$/)) {
          await updateDashboard({
            guildInfo,
            selected: actionId,
            error: `Invalid action id \`${newActionId}\``
          })
          return
        }

        if (newActionId !== actionId &&
          newActionId.startsWith('menu:') &&
          Object.keys(guildInfo.actions).filter(id => id !== actionId && id.startsWith('menu:')).length >= 5) {
          await updateDashboard({
            guildInfo,
            error: 'Already reached limit of 5 context menu actions'
          })
          return
        }

        if (!environments.includes(newActionRunner)) {
          await updateDashboard({
            guildInfo,
            selected: actionId,
            error: `Invalid runner \`${newActionRunner}\``
          })
          return
        }

        try {
          newActionConfig = JSON.parse(newActionConfig)
        } catch {
          await updateDashboard({
            guildInfo,
            selected: actionId,
            error: "Couldn't parse json config\n```\n" + newActionConfig + '\n```'
          })
          return
        }

        if (typeof newActionConfig !== 'object') {
          await updateDashboard({
            guildInfo,
            selected: actionId,
            error: 'Action config must be a json object\n```\n' + JSON.stringify(newActionConfig, undefined, 2) + '\n```'
          })
          return
        }

        delete guildInfo.actions[actionId]
        guildInfo.actions[newActionId] = {
          title: newActionTitle,
          runner: newActionRunner,
          config: newActionConfig
        }

        await db.setGuildInfo(interaction.guildId, guildInfo)

        updateDashboard({
          guildInfo,
          selected: newActionId,
          success: `Successfully updated action \`${newActionId}\``
        })

        if (actionId.startsWith('menu:') || newActionId.startsWith('menu:')) {
          await updateGuildCommands(interaction.guildId)
        }
      }
    }

    if (interaction.inGuild() && interaction.isMessageContextMenu()) {
      const guildInfo = await db.getGuildInfo(interaction.guildId)
      const actionMatch = Object.values(guildInfo.actions).filter(action => action.title === interaction.commandName)

      if (actionMatch.length > 0) {
        const { runner: name, config } = actionMatch[0]

        let deferred = false
        const tid = setTimeout(() => {
          deferred = true
          interaction.deferReply()
        }, 800)

        const info = await invokeBuild(runner, name, config, interaction.targetMessage.content)

        if (deferred) {
          await interaction.editReply(createReport(info))
        } else {
          clearTimeout(tid)
          await interaction.reply(createReport(info))
        }
      }
    }
  })
}

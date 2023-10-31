import { Client, StringSelectMenuInteraction, REST, ComponentType, Routes } from 'discord.js'
import { PoolRunner } from '@beet-bot/runner'
import { version } from '../package.json'
import { Database } from './database'
import { generateGuildCommands } from './commands'
import { ActionDashboardOptions, createActionChoice, createActionDashboard, createEditActionModal } from './widgets'
import { createReport } from './report'
import { invokeBuild, resolveActionOverrides } from './build'
import { download } from './download'

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

  const pingRegex = new RegExp(`<@!?${clientId}>( *[a-zA-Z0-9_]{3,20})?`)

  discordClient.on('messageCreate', async (message) => {
    if (!message.author.bot && message.inGuild() && message.mentions.users.has(clientId)) {
      const guildInfo = await db.getGuildInfo(message.guildId)

      let actionId = message.content.match(pingRegex)?.[1]?.trim()
      if (actionId && guildInfo.actions[actionId]) {
        const { runner: name, config, zip } = guildInfo.actions[actionId]
        const resolvedConfig = resolveActionOverrides(config, guildInfo)
        const info = await invokeBuild(runner, name, resolvedConfig, message)
        await message.reply(createReport(info, zip))
        return
      }

      const reply = await message.reply(createActionChoice(guildInfo))

      let interaction: StringSelectMenuInteraction

      try {
        interaction = await reply.awaitMessageComponent({
          componentType: ComponentType.StringSelect,
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

      actionId = interaction.values[0]
      const { runner: name, config, zip } = guildInfo.actions[actionId]
      const resolvedConfig = resolveActionOverrides(config, guildInfo)

      let deferred: Promise<any> | undefined
      const tid = setTimeout(() => {
        deferred = interaction.deferUpdate()
      }, 800)

      const info = await invokeBuild(runner, name, resolvedConfig, message)

      if (deferred) {
        await deferred
        await interaction.editReply(createReport(info, zip))
      } else {
        clearTimeout(tid)
        await interaction.update(createReport(info, zip))
      }
    }
  })

  discordClient.on('interactionCreate', async (interaction) => {
    if (interaction.inGuild() && interaction.isCommand()) {
      if (interaction.commandName === 'bbhelp') {
        const guildInfo = await db.getGuildInfo(interaction.guildId)
        if (guildInfo.actions.help) {
          const { runner: name, config, zip } = guildInfo.actions.help
          const resolvedConfig = resolveActionOverrides(config, guildInfo)
          const info = await invokeBuild(runner, name, resolvedConfig)
          await interaction.reply(createReport(info, zip))
          return
        }
      } else if (interaction.commandName === 'bbinfo') {
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

        info += '\nenvironments: ' + environments.join(', ')
        await interaction.reply('```\n' + info + '\n```')
      } else if (interaction.commandName === 'bbrefresh') {
        const name = interaction.options.get('environment')?.value
        if (typeof name === 'string') {
          await interaction.deferReply()
          try {
            await runner.refresh(name)
            await interaction.editReply('```\nSuccessfully refreshed "' + name + '" environment\n```')
          } catch (err) {
            await interaction.editReply('```\n' + err + '\n```')
          }
        } else {
          await interaction.reply('```\nSpecify an environment name\n```')
        }
      } else if (interaction.commandName === 'bbaction') {
        const guildInfo = await db.getGuildInfo(interaction.guildId)
        const currentActions = Object.keys(guildInfo.actions)
        const actionId = interaction.options.get('action')?.value

        if (typeof actionId === 'string') {
          if (actionId.match(/^(?:menu:)?[a-zA-Z0-9_]{3,20}$/)) {
            if (
              currentActions.includes(actionId) ||
              !actionId.startsWith('menu:') ||
              currentActions.filter(id => id.startsWith('menu:')).length < 5) {
              await interaction.showModal(createEditActionModal({
                guildInfo,
                selected: actionId
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
      } else if (interaction.commandName === 'bbexport') {
        const guildInfo = await db.getGuildInfo(interaction.guildId)
        await interaction.reply({
          ephemeral: true,
          files: [{
            attachment: Buffer.from(JSON.stringify(guildInfo, undefined, 2), 'utf-8'),
            name: 'actionDatabase.json'
          }]
        })
      } else if (interaction.commandName === 'bbimport') {
        const attachment = interaction.options.getAttachment('database')
        if (attachment) {
          try {
            const content = await download(attachment.url, 'utf-8')
            const actionDatabase = JSON.parse(content)
            const actionCount = Object.keys(actionDatabase.actions).length
            await db.setGuildInfo(interaction.guildId, actionDatabase)
            await updateGuildCommands(interaction.guildId)
            await interaction.reply({
              ephemeral: true,
              embeds: [{ description: `Successfully imported ${actionCount} action(s) from attached json`, color: 0x00FF00 }]
            })
          } catch (err) {
            console.log(`ERROR: ${err}`)
            await interaction.reply({
              ephemeral: true,
              embeds: [{ description: 'Failed to import actions from attached json', color: 0xFF0000 }]
            })
          }
        } else {
          await interaction.reply({
            ephemeral: true,
            embeds: [{ description: 'Missing json attachment for action database', color: 0xFF0000 }]
          })
        }
      } else if (interaction.commandName === 'bbresolve') {
        const guildInfo = await db.getGuildInfo(interaction.guildId)
        const actionId = interaction.options.get('action')?.value
        if (typeof actionId === 'string' && guildInfo.actions[actionId]) {
          const resolvedConfig = resolveActionOverrides(guildInfo.actions[actionId].config, guildInfo)
          await interaction.reply({
            ephemeral: true,
            files: [{
              attachment: Buffer.from(JSON.stringify(resolvedConfig, undefined, 2), 'utf-8'),
              name: `${actionId.replace('menu:', '')}.json`
            }]
          })
        } else {
          await interaction.reply({
            ephemeral: true,
            embeds: [{ description: `Could not find action \`${actionId}\``, color: 0xFF0000 }]
          })
        }
      } else if (interaction.commandName === 'bbstop') {
        await interaction.reply('```\nShutting down...\n```')
        discordClient.destroy()
        process.exit()
      }
    }

    if (interaction.inGuild() && interaction.isStringSelectMenu()) {
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

      if (scope === 'editAction') {
        const updateDashboard = (options: ActionDashboardOptions) =>
          interaction.isFromMessage()
            ? interaction.update(createActionDashboard(options))
            : interaction.reply(createActionDashboard(options))

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
          config: newActionConfig,
          zip: newActionId.includes('zip')
        }

        await db.setGuildInfo(interaction.guildId, guildInfo)

        updateDashboard({
          guildInfo,
          selected: newActionId,
          success: `Successfully updated action \`${newActionId}\``
        })

        if (actionId.startsWith('menu:') || newActionId.startsWith('menu:') || actionId === 'help' || newActionId === 'help') {
          await updateGuildCommands(interaction.guildId)
        }
      }
    }

    if (interaction.inGuild() && interaction.isMessageContextMenuCommand()) {
      const guildInfo = await db.getGuildInfo(interaction.guildId)
      const actionMatch = Object.values(guildInfo.actions).filter(action => action.title === interaction.commandName)

      if (actionMatch.length > 0) {
        const { runner: name, config, zip } = actionMatch[0]
        const resolvedConfig = resolveActionOverrides(config, guildInfo)

        let deferred: Promise<any> | undefined
        const tid = setTimeout(() => {
          deferred = interaction.deferReply()
        }, 800)

        const info = await invokeBuild(runner, name, resolvedConfig, interaction.targetMessage)

        if (deferred) {
          await deferred
          await interaction.editReply(createReport(info, zip))
        } else {
          clearTimeout(tid)
          await interaction.reply(createReport(info, zip))
        }
      }
    }
  })
}

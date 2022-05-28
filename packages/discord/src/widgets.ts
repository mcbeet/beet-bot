import { MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu, Modal, TextInputComponent } from 'discord.js'
import { GuildInfo } from './database'

export const createActionChoice = (guildInfo: GuildInfo) => {
  const options = Object.entries(guildInfo.actions)
    .flatMap(([actionId, action]) => actionId.startsWith('>')
      ? []
      : [{ label: action.title, value: actionId }]
    )

  return {
    components: [
      new MessageActionRow({
        components: [
          options.length > 0
            ? new MessageSelectMenu()
              .setCustomId('actionChoice.actionId')
              .setPlaceholder('Select action')
              .setOptions(options)
            : new MessageSelectMenu()
              .setCustomId('actionChoice.actionIdPlaceholder')
              .setPlaceholder('Use /bba my_new_action to create an action')
              .setDisabled(true)
              .setOptions({
                label: 'x',
                value: 'x'
              })
        ]
      })
    ]
  }
}

export type ActionDashboardOptions = {
  guildInfo: GuildInfo
  selected?: string
  success?: string
  error?: string
}

export const createActionDashboard = ({ guildInfo, selected, success, error }: ActionDashboardOptions) => {
  const options = Object.entries(guildInfo.actions)
    .map(([actionId, action]) => ({
      label: actionId,
      description: action.title,
      value: actionId,
      default: actionId === selected
    }))

  return {
    ephemeral: true,
    embeds: success
      ? [new MessageEmbed().setDescription(success).setColor('#00FF00')]
      : error
        ? [new MessageEmbed().setDescription(error).setColor('#FF0000')]
        : [],
    components: [
      new MessageActionRow({
        components: [
          options.length > 0
            ? new MessageSelectMenu()
              .setCustomId('actionDashboard.actionId')
              .setPlaceholder('Select action')
              .setOptions(options)
            : new MessageSelectMenu()
              .setCustomId('actionDashboard.actionIdPlaceholder')
              .setPlaceholder('Use /bba my_new_action to create an action')
              .setDisabled(true)
              .setOptions({
                label: 'x',
                value: 'x'
              })
        ]
      }),
      new MessageActionRow({
        components: [
          new MessageButton()
            .setCustomId(selected ? `actionDashboard.buttonEditSelected.${selected}` : 'actionDashboard.buttonEdit')
            .setLabel('Edit')
            .setStyle('PRIMARY')
            .setDisabled(!selected),
          new MessageButton()
            .setCustomId(selected ? `actionDashboard.buttonDeleteSelected.${selected}` : 'actionDashboard.buttonDelete')
            .setLabel('Delete')
            .setStyle('DANGER')
            .setDisabled(!selected)
        ]
      })
    ]
  }
}

export type EditActionModalOptions = {
  guildInfo: GuildInfo
  selected: string
  immediate?: boolean
}

export const createEditActionModal = ({ guildInfo, selected, immediate = false }: EditActionModalOptions) => {
  const action = guildInfo.actions[selected] ?? {}

  const id = new TextInputComponent()
    .setCustomId('editAction.actionId')
    .setLabel('Action id')
    .setPlaceholder('build_message')
    .setStyle('SHORT')
    .setMinLength(3)
    .setMaxLength(20)
    .setRequired(true)

  const title = new TextInputComponent()
    .setCustomId('editAction.actionTitle')
    .setLabel('Action title')
    .setPlaceholder('Build message')
    .setStyle('SHORT')
    .setMaxLength(40)
    .setRequired(true)

  const runner = new TextInputComponent()
    .setCustomId('editAction.actionRunner')
    .setLabel('Runner environment')
    .setPlaceholder('default')
    .setStyle('SHORT')
    .setMinLength(3)
    .setMaxLength(20)
    .setRequired(true)

  const config = new TextInputComponent()
    .setCustomId('editAction.actionConfig')
    .setLabel('Json config')
    .setPlaceholder('{\n  "pipeline": [\n    "mecha"\n  ]\n}')
    .setStyle('PARAGRAPH')
    .setRequired(true)

  id.setValue(selected)
  if (action.title) {
    title.setValue(action.title)
  }
  if (action.runner) {
    runner.setValue(action.runner)
  }
  if (action.config) {
    config.setValue(JSON.stringify(action.config, undefined, 2))
  }

  return new Modal()
    .setCustomId(`editAction${immediate ? 'Immediate' : ''}.${selected}`)
    .setTitle('Edit action')
    .setComponents(
      new MessageActionRow({ components: [id] }),
      new MessageActionRow({ components: [title] }),
      new MessageActionRow({ components: [runner] }),
      new MessageActionRow({ components: [config] })
    )
}

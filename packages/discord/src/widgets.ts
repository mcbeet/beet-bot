import { MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu, Modal, TextInputComponent } from 'discord.js'
import { GuildInfo } from './database'

export type ConfigDashboardOptions = {
  guildInfo: GuildInfo
  selected?: string
  success?: string
  error?: string
}

export const createConfigDashboard = ({ guildInfo, selected, success, error }: ConfigDashboardOptions) => {
  const options = Object.entries(guildInfo.configurations)
    .map(([configId, config]) => ({
      label: configId,
      description: config.title,
      value: configId,
      default: configId === selected
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
              .setCustomId('configDashboard.configId')
              .setPlaceholder('Select beet bot configuration')
              .setOptions(options)
            : new MessageSelectMenu()
              .setCustomId('configDashboard.configIdPlaceholder')
              .setPlaceholder('Use /bconf my_new_config to create a configuration')
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
            .setCustomId(selected ? `configDashboard.actionEditSelected.${selected}` : 'configDashboard.actionEdit')
            .setLabel('Edit')
            .setStyle('PRIMARY')
            .setDisabled(!selected),
          new MessageButton()
            .setCustomId(selected ? `configDashboard.actionDeleteSelected.${selected}` : 'configDashboard.actionDelete')
            .setLabel('Delete')
            .setStyle('DANGER')
            .setDisabled(!selected)
        ]
      })
    ]
  }
}

export type EditConfigModalOptions = {
  guildInfo: GuildInfo
  selected: string
  immediate?: boolean
}

export const createEditConfigModal = ({ guildInfo, selected, immediate = false }: EditConfigModalOptions) => {
  const config = guildInfo.configurations[selected] ?? {}

  const id = new TextInputComponent()
    .setCustomId('editConfig.configId')
    .setLabel('Config id')
    .setPlaceholder('build_message')
    .setStyle('SHORT')
    .setMinLength(3)
    .setMaxLength(20)
    .setRequired(true)

  const title = new TextInputComponent()
    .setCustomId('editConfig.configTitle')
    .setLabel('Action title')
    .setPlaceholder('Build message')
    .setStyle('SHORT')
    .setMaxLength(40)
    .setRequired(true)

  const runner = new TextInputComponent()
    .setCustomId('editConfig.configRunner')
    .setLabel('Runner environment')
    .setPlaceholder('default')
    .setStyle('SHORT')
    .setMinLength(3)
    .setMaxLength(20)
    .setRequired(true)

  const data = new TextInputComponent()
    .setCustomId('editConfig.configData')
    .setLabel('Json config')
    .setPlaceholder('{\n  "pipeline": [\n    "mecha"\n  ]\n}')
    .setStyle('PARAGRAPH')
    .setRequired(true)

  id.setValue(selected)
  if (config.title) {
    title.setValue(config.title)
  }
  if (config.runner) {
    runner.setValue(config.runner)
  }
  if (config.data) {
    data.setValue(JSON.stringify(config.data, undefined, 2))
  }

  return new Modal()
    .setCustomId(`editConfig${immediate ? 'Immediate' : ''}.${selected}`)
    .setTitle('Edit configuration')
    .setComponents(
      new MessageActionRow({ components: [id] }),
      new MessageActionRow({ components: [title] }),
      new MessageActionRow({ components: [runner] }),
      new MessageActionRow({ components: [data] })
    )
}

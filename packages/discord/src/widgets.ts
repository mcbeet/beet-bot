import { ButtonStyle, TextInputStyle, ComponentType } from 'discord.js'
import { GuildInfo } from './database'

export const createActionChoice = (guildInfo: GuildInfo) => {
  const options = Object.entries(guildInfo.actions)
    .flatMap(([actionId, action]) => actionId.startsWith('menu:')
      ? []
      : [{ label: action.title, value: actionId }]
    )

  return {
    components: [
      {
        type: ComponentType.ActionRow,
        components: [
          options.length > 0
            ? {
                type: ComponentType.SelectMenu as const,
                customId: 'actionChoice.actionId',
                placeholder: 'Select action',
                options
              }
            : {
                type: ComponentType.SelectMenu as const,
                customId: 'actionChoice.actionIdPlaceholder',
                placeholder: 'Use /bbaction my_new_action to create an action',
                disabled: true,
                options: [{ label: 'x', value: 'x' }]
              }
        ]
      }
    ]
  }
}

export const createActionChoiceDisabled = (message: string) => {
  return {
    components: [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.SelectMenu as const,
            customId: 'actionChoice.actionIdDisabled',
            placeholder: message,
            disabled: true,
            options: [{ label: message, value: 'x' }]
          }
        ]
      }
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
      label: action.title,
      description: actionId,
      value: actionId,
      default: actionId === selected
    }))

  return {
    ephemeral: true,
    embeds: success
      ? [{ description: success, color: 0x00FF00 }]
      : error
        ? [{ description: error, color: 0xFF0000 }]
        : [],
    components: [
      {
        type: ComponentType.ActionRow,
        components: [
          options.length > 0
            ? {
                type: ComponentType.SelectMenu as const,
                customId: 'actionDashboard.actionId',
                placeholder: 'Select action',
                options
              }
            : {
                type: ComponentType.SelectMenu as const,
                customId: 'actionDashboard.actionIdPlaceholder',
                placeholder: 'Use /bbaction my_new_action to create an action',
                disabled: true,
                options: [{ label: 'x', value: 'x' }]
              }
        ]
      },
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button,
            customId: selected ? `actionDashboard.buttonEditSelected.${selected}` : 'actionDashboard.buttonEdit',
            label: 'Edit',
            style: ButtonStyle.Primary as const,
            disabled: !selected
          },
          {
            type: ComponentType.Button,
            customId: selected ? `actionDashboard.buttonDeleteSelected.${selected}` : 'actionDashboard.buttonDelete',
            label: 'Delete',
            style: ButtonStyle.Danger as const,
            disabled: !selected
          }
        ]
      }
    ]
  }
}

export type EditActionModalOptions = {
  guildInfo: GuildInfo
  selected: string
  immediate?: boolean
}

export const createEditActionModal = ({ guildInfo, selected }: EditActionModalOptions) => {
  const action = guildInfo.actions[selected] ?? {}

  const id = {
    type: ComponentType.TextInput,
    customId: 'editAction.actionId',
    label: 'Action id',
    placeholder: 'build_message',
    style: TextInputStyle.Short,
    minLength: 3,
    maxLength: 20,
    required: true,
    value: selected
  } as const

  const title = {
    type: ComponentType.TextInput,
    customId: 'editAction.actionTitle',
    label: 'Action title',
    placeholder: 'Build message',
    style: TextInputStyle.Short,
    maxLength: 40,
    required: true,
    value: action.title
  } as const

  const runner = {
    type: ComponentType.TextInput,
    customId: 'editAction.actionRunner',
    label: 'Runner environment',
    placeholder: 'default',
    style: TextInputStyle.Short,
    minLength: 3,
    maxLength: 20,
    required: true,
    value: action.runner
  } as const

  const config = {
    type: ComponentType.TextInput,
    customId: 'editAction.actionConfig',
    label: 'Json config',
    placeholder: '{\n  "pipeline": [\n    "mecha"\n  ]\n}',
    style: TextInputStyle.Paragraph,
    required: true,
    value: JSON.stringify(action.config, undefined, 2)
  } as const

  return {
    customId: `editAction.${selected}`,
    title: 'Edit action',
    components: [
      { type: ComponentType.ActionRow, components: [id] },
      { type: ComponentType.ActionRow, components: [title] },
      { type: ComponentType.ActionRow, components: [runner] },
      { type: ComponentType.ActionRow, components: [config] }
    ]
  }
}

import { ContextMenuCommandBuilder, SlashCommandBuilder } from '@discordjs/builders'
import { ApplicationCommandType } from 'discord-api-types/v10'
import { GuildInfo } from './database'

export const BUILTIN_COMMANDS = [
  new SlashCommandBuilder()
    .setName('bba')
    .setDescription('Manage beet bot actions')
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('The id of the action')
    )
]

export const generateGuildCommands = ({ actions }: GuildInfo) => [
  ...Object.entries(actions)
    .flatMap(([actionId, action]) => actionId.startsWith('>')
      ? [new ContextMenuCommandBuilder().setName(action.title).setType(ApplicationCommandType.Message)]
      : []),
  ...BUILTIN_COMMANDS
]

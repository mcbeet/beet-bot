import { ContextMenuCommandBuilder, SlashCommandBuilder } from '@discordjs/builders'
import { ApplicationCommandType } from 'discord-api-types/v10'
import { GuildInfo } from './database'

export const BUILTIN_COMMANDS = [
  new SlashCommandBuilder()
    .setName('bconf')
    .setDescription('Manage beet bot configuration')
    .addStringOption(option =>
      option
        .setName('id')
        .setDescription('The id of the configuration')
    )
]

export const generateGuildCommands = ({ configurations }: GuildInfo) => [
  ...Object.values(configurations)
    .flatMap(config => [
      new ContextMenuCommandBuilder()
        .setName(config.title)
        .setType(ApplicationCommandType.Message)
    ]),
  ...BUILTIN_COMMANDS
]
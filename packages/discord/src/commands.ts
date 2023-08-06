import { ContextMenuCommandBuilder, SlashCommandBuilder, ApplicationCommandType, PermissionFlagsBits } from 'discord.js'
import { GuildInfo } from './database'

export const BUILTIN_COMMANDS = [
  new SlashCommandBuilder()
    .setName('bbinfo')
    .setDescription('Show information about the beet bot'),
  new SlashCommandBuilder()
    .setName('bbaction')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDescription('Manage beet bot actions')
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('The id of the action')
    ),
  new SlashCommandBuilder()
    .setName('bbstop')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDescription('Stop the beet bot')
]

export const generateRefreshCommand = (environmentNames: string[]) =>
  new SlashCommandBuilder()
    .setName('bbrefresh')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDescription('Refresh beet bot environment')
    .addStringOption(option =>
      option
        .setName('environment')
        .setDescription('The name of the environment to refresh')
        .setRequired(true)
        .addChoices(...environmentNames.map(name => ({ name, value: name })))
    )

export const generateGuildCommands = ({ actions }: GuildInfo) => [
  ...Object.entries(actions)
    .flatMap(([actionId, action]) => actionId.startsWith('menu:')
      ? [new ContextMenuCommandBuilder().setName(action.title).setType(ApplicationCommandType.Message)]
      : []),
  generateRefreshCommand([...new Set(Object.values(actions).map(({ runner }) => runner))]),
  ...BUILTIN_COMMANDS
]

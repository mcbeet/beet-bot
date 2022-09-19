import { DatabaseAdapter } from './adapter'

export type GuildInfo = {
  actions: Record<string, {
    title: string
    runner: string
    config: any
    zip: boolean
  }>
}

export const createDatabase = (adapter: DatabaseAdapter) => {
  return {
    getAllGuilds: () => adapter.get<string[]>('allGuilds', []),
    setAllGuilds: (allGuilds: string[]) => adapter.set('allGuilds', allGuilds),
    getGuildInfo: (guildId: string) => adapter.get<GuildInfo>(`guildInfo.${guildId}`, { actions: {} }),
    setGuildInfo: (guildId: string, commands: GuildInfo) => adapter.set(`guildInfo.${guildId}`, commands),
    delGuildInfo: (guildId: string) => adapter.del(`guildInfo.${guildId}`)
  }
}

export type Database = ReturnType<typeof createDatabase>

import { Builder, createBuilder } from './build'
import { deleteDockerBuilder, setupDockerBuilder } from './docker'

export type PoolRunner = {
  refresh(name: string): Promise<void>
  build(name: string, options: any): Promise<any>
}

export type EnvironmentOptions = {
  warmup: number
  timeout: number
  isolated: boolean
  path: string
  overrides?: string[]
}

export const createPoolRunner = (environments: Record<string, EnvironmentOptions> = {}): PoolRunner => {
  const builders = new Map<string, Builder>()

  for (const name in environments) {
    const { warmup, timeout, isolated, path, overrides } = environments[name]
    builders.set(name, createBuilder({
      warmup,
      timeout,
      setup: async (refresh: boolean) => {
        if (refresh) {
          await deleteDockerBuilder(path)
        }
        return await setupDockerBuilder(name, path, isolated, overrides)
      }
    }))
  }

  const refresh = async (name: string) => {
    const environment = environments[name]

    if (environment) {
      await Promise.all(
        Object.entries(environments)
          .filter(([, { path }]) => path === environment.path)
          .map(([name]) => builders.get(name)?.refresh())
      )
    } else {
      throw new Error(`Invalid environment "${name}"`)
    }
  }

  const build = async (name: string, options: any) => {
    const builder = builders.get(name)

    if (builder) {
      console.log(`INFO: Trigger build in "${name}" environment`)
      return await builder.build(options)
    } else {
      throw new Error(`Invalid environment "${name}"`)
    }
  }

  return { refresh, build }
}

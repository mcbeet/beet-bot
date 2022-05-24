import { Builder, createBuilder } from './build'
import { setupDockerBuilder } from './docker'

export type PoolRunner = (name: string, options: any) => Promise<any>

export type EnvironmentOptions = {
  warmup: number
  timeout: number
  path: string
}

export const createPoolRunner = (environments: Record<string, EnvironmentOptions> = {}): PoolRunner => {
  const builders = new Map<string, Builder>()

  for (const name in environments) {
    const { warmup, timeout, path } = environments[name]
    builders.set(name, createBuilder({
      warmup,
      timeout,
      setup: () => setupDockerBuilder(name, path)
    }))
  }

  return async (name, options) => {
    const build = builders.get(name)

    if (build) {
      return await build(options)
    } else {
      throw new Error(`Invalid environment "${name}"`)
    }
  }
}

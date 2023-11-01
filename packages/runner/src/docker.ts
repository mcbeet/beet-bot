import { execa } from 'execa'

export const getDockerImageTag = (name: string) => `beet-bot-${name}`

export const deleteDockerBuilder = async (name: string) => {
  const tag = getDockerImageTag(name)

  try {
    console.log(`INFO: Deleting "${name}" environment`)
    await execa('docker', ['rmi', '--force', tag], { stdio: 'inherit' })
    console.log(`INFO: Deleted "${name}" environment`)
  } catch {
    console.log(`WARN: Error deleting "${name}" environment`)
  }
}

export const setupDockerBuilder = async (name: string, path: string, isolated: boolean, overrides: string[] = []) => {
  const tag = getDockerImageTag(name)

  try {
    console.log(`INFO: Start building "${name}" environment`)
    await execa('docker', ['build', path, '--tag', tag], { stdio: 'inherit' })
    console.log(`INFO: Done building "${name}" environment`)
  } catch {
    console.log(`WARN: Error building "${name}" environment`)
    return () => Promise.reject(new Error(`Environment "${name}" is broken`))
  }

  return (id: number) => {
    const container = `${tag}-${id}`

    const handle = execa('docker', [
      'run', '--name', container, ...(isolated ? ['--network', 'none'] : []), '--rm', '-i', tag,
      'beet', '-p', '@beet/preset_stdin.yml', ...overrides.flatMap(override => ['-s', override]), 'build', '--json'
    ])

    const stop = async () => {
      try {
        await execa('docker', ['rm', '-f', container], { stdio: 'inherit' })
      } catch {
        console.log(`WARN: Stopping build #${handle.pid} failed`)
      }
    }

    return Promise.resolve({ handle, stop })
  }
}

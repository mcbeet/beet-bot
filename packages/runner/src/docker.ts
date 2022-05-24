import { execa } from 'execa'

export const setupDockerBuilder = async (name: string, path: string) => {
  const tag = `beet-bot-${name}`

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
      'run', '--name', container, '--rm', '-i', tag,
      'beet', '-p', '@beet/preset_stdin.yml', 'build', '--json'
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

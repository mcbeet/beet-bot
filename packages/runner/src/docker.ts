import { execa } from 'execa'

type DockerImage = {
  tag: string
  status: 'toBuild' | 'buildingImage' | 'ready' | 'broken' | 'deletingImage'
  promise: Promise<void>
}

const imageRegistry: Map<string, DockerImage> = new Map()
const getDockerImage = (path: string) => {
  let image = imageRegistry.get(path)
  if (!image) {
    image = {
      tag: `beet-bot-env${imageRegistry.size}`,
      status: 'toBuild',
      promise: Promise.resolve()
    }
    imageRegistry.set(path, image)
  }
  return image
}

const runDockerBuild = async (image: DockerImage, path: string) => {
  try {
    console.log(`INFO: Start building image "${image.tag}"`)
    await execa('docker', ['build', path, '--tag', image.tag], { stdio: 'inherit' })
    console.log(`INFO: Done building image "${image.tag}"`)
    image.status = 'ready'
  } catch {
    console.log(`WARN: Error building image "${image.tag}"`)
    image.status = 'broken'
  }
}

const runDockerRmi = async (image: DockerImage) => {
  try {
    console.log(`INFO: Deleting image "${image.tag}"`)
    await execa('docker', ['rmi', '--force', image.tag], { stdio: 'inherit' })
    console.log(`INFO: Deleted image "${image.tag}"`)
    image.status = 'toBuild'
  } catch {
    console.log(`WARN: Error deleting image "${image.tag}"`)
    image.status = 'ready'
  }
}

const buildDockerImage = async (path: string): Promise<DockerImage> => {
  const image = getDockerImage(path)

  switch (image.status) {
    case 'deletingImage':
      await image.promise
      return await buildDockerImage(path)
    case 'toBuild':
    case 'broken':
      image.status = 'buildingImage'
      image.promise = runDockerBuild(image, path)
      break
  }

  await image.promise
  return image
}

const deleteDockerImage = async (path: string): Promise<DockerImage> => {
  const image = getDockerImage(path)

  switch (image.status) {
    case 'buildingImage':
      await image.promise
      return await deleteDockerImage(path)
    case 'ready':
      image.status = 'deletingImage'
      image.promise = runDockerRmi(image)
      break
  }

  await image.promise
  return image
}

export const setupDockerBuilder = async (
  name: string,
  path: string,
  isolated: boolean,
  overrides: string[] = []
) => {
  const image = await buildDockerImage(path)

  if (image.status === 'broken') {
    return () => Promise.reject(new Error(`Environment "${name}" is broken`))
  }

  return (id: number) => {
    const container = `${image.tag}-${name}-${id}`

    const handle = execa('docker', [
      'run', '--name', container, ...(isolated ? ['--network', 'none'] : []), '--rm', '-i', image.tag,
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

export const deleteDockerBuilder = async (path: string) => {
  await deleteDockerImage(path)
}

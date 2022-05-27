export type BuildPackInfo = {
  name?: string
  description?: any
  pack_format?: number
  empty?: boolean
  text_files?: Record<string, string>
  binary_files?: Record<string, string>
  zip?: string
}

export type BuildInfo = {
  status: 'success' | 'error' | 'unknown'
  error?: {
    message: string
    exception?: string
  }
  stdout?: string
  data_pack?: BuildPackInfo
  resource_pack?: BuildPackInfo
}

const formatPackContents = ({ empty, text_files, binary_files }: BuildPackInfo) => {
  const textCount = Object.keys(text_files ?? {}).length
  const binaryCount = Object.keys(binary_files ?? {}).length

  const images = Object.entries(binary_files ?? {})
    .filter(([path, _]) => path.endsWith('.png'))
    .slice(0, 3)

  const sections = []

  if (text_files && textCount < 16) {
    for (const path in text_files) {
      if (path !== 'pack.mcmeta') {
        const content = text_files[path]
        if (content.trim()) {
          sections.push('`' + path + '`\n```\n' + content + '\n```\n')
        }
      }
    }
  }

  return [!empty && (binaryCount > images.length || textCount > 6), sections, images] as const
}

const reduceLargestSection = (sections: string[]) => {
  let maxLength = 0
  let maxIndex = 0

  for (let i = 0; i < sections.length; i++) {
    if (sections[i].length >= maxLength) {
      maxLength = sections[i].length
      maxIndex = i
    }
  }

  sections.splice(maxIndex, 1)
  return sections
}

export const createReport = ({ error, stdout, data_pack, resource_pack }: BuildInfo) => {
  let attachStdout = ''
  let attachTraceback = ''

  let stdoutSection = stdout ? '```\n' + stdout + '\n```\n' : ''
  let errorSection = error ? '```\n' + error.message + (error?.exception ? '\n\n' + error.exception : '') + '\n```' : ''

  // eslint-disable-next-line prefer-const
  let [shouldZipDataPack, dataPackSections, dataPackImages] = formatPackContents(data_pack ?? {})
  // eslint-disable-next-line prefer-const
  let [shouldZipResourcePack, resourcePackSections, resourcePackImages] = formatPackContents(resource_pack ?? {})

  const joinContent = () => stdoutSection + errorSection + dataPackSections.join('') + resourcePackSections.join('')
  let content = joinContent()

  while (content.length > 2000) {
    if (stdoutSection.length > content.length / 2) {
      stdoutSection = ''
      if (stdout) {
        attachStdout = stdout
      }
    } else if (errorSection.length > content.length / 2) {
      errorSection = error ? '```\n' + error.message + '\n```' : ''
      if (error?.exception) {
        attachTraceback = error.exception
      }
    } else if (dataPackSections.length > resourcePackSections.length) {
      dataPackSections = reduceLargestSection(dataPackSections)
      shouldZipDataPack = true
    } else {
      resourcePackSections = reduceLargestSection(resourcePackSections)
      shouldZipResourcePack = true
    }
    const previousLength = content.length
    content = joinContent()
    if (content.length === previousLength) {
      content = '```\nCould not summarize in less than 2000 characters. Check out attachments for more details.\n```'
      break
    }
  }

  if (content === dataPackSections[0] || content === resourcePackSections[0]) {
    content = content.slice(content.indexOf('\n') + 1)
  }

  const files = []

  for (const [path, data] of [...dataPackImages, ...resourcePackImages]) {
    files.push({ attachment: Buffer.from(data, 'base64'), name: path.split('/').at(-1) })
  }

  if (attachStdout) {
    files.push({ attachment: Buffer.from(attachStdout, 'utf-8'), name: 'stdout.txt' })
  }

  if (attachTraceback) {
    files.push({ attachment: Buffer.from(attachTraceback, 'utf-8'), name: 'traceback.txt' })
  }

  if (shouldZipDataPack && data_pack?.zip) {
    files.push({ attachment: Buffer.from(data_pack?.zip, 'base64'), name: (data_pack?.name ?? 'data_pack') + '.zip' })
  }

  if (shouldZipResourcePack && resource_pack?.zip) {
    files.push({ attachment: Buffer.from(resource_pack?.zip, 'base64'), name: (resource_pack?.name ?? 'resource_pack') + '.zip' })
  }

  if (!content && files.length === 0) {
    content = '```\nNo output\n```'
  }

  return { content: content || undefined, files }
}

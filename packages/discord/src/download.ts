import { get } from 'https'

export const download = (url: string, encoding: BufferEncoding) => {
  return new Promise<string>((resolve, reject) => {
    get(url, (res) => {
      res.setEncoding(encoding)
      let body = ''
      res.on('data', (data) => { body += data })
      res.on('end', () => resolve(body))
    }).on('error', err => reject(err))
  })
}

export const downloadAsBase64Url = async (url: string, contentType: string) => {
  const content = await download(url, 'base64')
  return `data:${contentType};base64,${content}`
}

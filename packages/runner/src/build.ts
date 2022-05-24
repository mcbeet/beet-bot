import type { ChildProcess } from 'child_process'

export type Builder = (options: any) => Promise<any>

export type WorkerInfo = {
  handle: ChildProcess
  stop(): void
}

export type BuilderOptions = {
  warmup: number
  timeout: number
  setup: () => Promise<(id: number) => Promise<WorkerInfo>>
}

export const createBuilder = ({ warmup, timeout, setup }: BuilderOptions) => {
  let count = 0
  const sentinel = setup()

  const createWorker = async () => {
    const spawn = await sentinel
    const { handle, stop } = await spawn(count++)

    return new Promise<WorkerInfo>((resolve, reject) => {
      handle.on('spawn', () => {
        console.log(`INFO: Successfully spawned worker #${handle.pid}`)
        resolve({ handle, stop })
      })

      handle.on('error', (err) => {
        console.log('WARN: Failed to spawn worker')
        reject(err)
      })
    })
  }

  const idle = Array.from({ length: warmup }, createWorker)

  return async (options: any) => {
    const worker = idle.shift() ?? createWorker()
    idle.push(createWorker())

    const { handle, stop } = await worker

    return new Promise<any>((resolve, reject) => {
      if (!handle.stdout || !handle.stdin) {
        throw new Error(`Worker #${handle.pid} does't have stdio`)
      }

      let output = ''
      handle.stdout.on('data', (chunk) => {
        output += chunk
      })

      let expired = false
      const tid = setTimeout(() => {
        console.log(`WARN: No response from worker #${handle.pid}`)
        expired = true
        stop()
      }, timeout)

      handle.stdin.on('error', () => {
        console.log(`WARN: Failed to communicate with worker #${handle.pid}`)
      })

      const start = process.hrtime()
      console.log(`INFO: Start build #${handle.pid}`)
      handle.stdin.end(JSON.stringify(options))

      handle.on('close', (code, signal) => {
        const stop = process.hrtime(start)
        console.log(`INFO: Build complete #${handle.pid} (took ${Math.round((stop[0] * 1e9 + stop[1]) / 1e6) / 1000}s)`)

        if (expired) {
          reject(new Error(`Build #${handle.pid} timed out after ${timeout}ms`))
        } else {
          clearTimeout(tid)
          if (signal) {
            reject(new Error(`Build #${handle.pid} shut down with ${signal}`))
          } else if (code !== 0) {
            reject(new Error(`Build #${handle.pid} exited with error code ${code}`))
          } else {
            try {
              resolve(JSON.parse(output))
            } catch (error) {
              reject(new Error(`Build #${handle.pid} emitted invalid json data`))
            }
          }
        }
      })
    })
  }
}

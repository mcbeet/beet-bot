import type { ChildProcess } from 'child_process'

export type Builder = {
  refresh(): Promise<void>
  build(options: any): Promise<any>
}

export type WorkerInfo = {
  handle: ChildProcess
  stop(): Promise<void>
}

export type BuilderOptions = {
  warmup: number
  timeout: number
  setup: (refresh: boolean) => Promise<(id: number) => Promise<WorkerInfo>>
}

export const createBuilder = ({ warmup, timeout, setup }: BuilderOptions): Builder => {
  let count = 0
  let sentinel = setup(false)

  const createWorker = async () => {
    const spawn = await sentinel
    const { handle, stop } = await spawn(count++)

    return new Promise<WorkerInfo>((resolve, reject) => {
      handle.on('spawn', () => {
        console.log(`INFO: Successfully spawned idle worker #${handle.pid}`)
        resolve({ handle, stop })
      })

      handle.on('error', (err) => {
        console.log('WARN: Failed to spawn idle worker')
        reject(err)
      })
    })
  }

  let idle = Array.from({ length: warmup }, createWorker)

  let refreshing = false
  const refresh = async () => {
    if (refreshing) {
      throw new Error('Already refreshing')
    }
    console.log('INFO: Begin environment refresh')
    refreshing = true

    await Promise.all(idle.map(worker => worker.then(({ stop }) => stop())))
    sentinel = setup(true)
    await sentinel
    idle = Array.from({ length: warmup }, createWorker)

    console.log('INFO: Successfully refreshed environment')
    refreshing = false
  }

  const build = async (options: any) => {
    if (refreshing) {
      throw new Error('Refreshing environment')
    }

    const worker = idle.shift() ?? createWorker()
    idle.push(createWorker())

    const { handle, stop } = await worker

    return new Promise<any>((resolve, reject) => {
      if (!handle.stdout || !handle.stdin) {
        throw new Error(`Worker #${handle.pid} does't have stdio`)
      }

      let expired = false
      const tid = setTimeout(() => {
        console.log(`WARN: No response from worker #${handle.pid}`)
        expired = true
        stop()
      }, timeout)

      let doneEarly = false
      const start = process.hrtime()

      let output = ''
      handle.stdout.on('data', (chunk) => {
        if (expired || doneEarly) {
          return
        }

        output += chunk

        try {
          const result = JSON.parse(output)

          const stop = process.hrtime(start)
          console.log(`INFO: Build complete #${handle.pid} (took ${Math.round((stop[0] * 1e9 + stop[1]) / 1e6) / 1000}s)`)

          clearTimeout(tid)
          doneEarly = true
          resolve(result)
        } catch { }
      })

      handle.stdin.on('error', () => {
        console.log(`WARN: Failed to communicate with worker #${handle.pid}`)
      })

      console.log(`INFO: Start build #${handle.pid}`)
      handle.stdin.end(JSON.stringify(options))

      handle.on('close', (code, signal) => {
        if (doneEarly) {
          return
        } else {
          console.log(`INFO: Finalize build #${handle.pid}`)
        }

        if (expired) {
          const stop = process.hrtime(start)
          reject(new Error(`Build #${handle.pid} timed out after ${Math.round((stop[0] * 1e9 + stop[1]) / 1e6) / 1000}s`))
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

  return { refresh, build }
}

import { randomBytes } from 'crypto'
import { createWriteStream, existsSync, lstatSync, mkdirSync, readdirSync, renameSync, utimesSync } from 'fs'
import { IncomingMessage } from 'http'
import { basename, dirname, join } from 'path'
import { RequestManager } from '..'
import { RequestData } from '../core/request'
import { formatTime, humanFileSize, sleep, watchForProgress } from '../utils/misc'
import { Client } from './client'

export interface DownloadEntry {
  resolve: (data: string) => void
  reject: (error: Error) => void

  maxRetry: number
  curRetry: number

  requestData: DownloadRequestData
  destinationFile: string
}

export interface DownloadRequestData extends RequestData {
  listeners?: RequestData['listeners'] & {
    onQueue?: (position: number) => void
    onProgress?: (current: number, total: number | undefined) => void
  }
}

export class DownloadQueue {
  public readonly manager: DownloadManager
  public readonly pending: Array<DownloadEntry>
  public readonly ongoing: Array<DownloadEntry>
  public running: boolean

  public log (message: string) {
    return this.manager.client.log('Download Queue', message)
  }

  public async runQueue () {
    const { pending, manager, ongoing, manager: { client: { options: { downloadParallelCount } } } } = this

    if (!this.running) {
      this.log('Queue is running.')
      this.running = true
      while (pending.length || ongoing.length) {
        while (ongoing.length < downloadParallelCount) {
          const downloadEntry = pending.shift()

          if (!downloadEntry) {
            break
          }

          const queueIndex = ongoing.push(downloadEntry) - 1
          downloadEntry.requestData.listeners?.onQueue?.(queueIndex)
          manager.execDownload(downloadEntry.requestData, downloadEntry.destinationFile)
            .then(downloadEntry.resolve)
            .catch(downloadEntry.reject)
            .finally(() => {
              const index = ongoing.indexOf(downloadEntry)

              if (index > -1) {
                ongoing.splice(index, 1)
              }
            })
        }

        await sleep(100)
      }
      this.running = false
      this.log('Queue is stopped.')
    }
  }

  public constructor (manager: DownloadManager) {
    this.manager = manager
    this.pending = []
    this.ongoing = []
    this.running = false
  }
}

export class DownloadManager {
  public readonly client: Client
  public readonly queue: DownloadQueue
  public readonly requestManager: RequestManager

  public log (message: string) {
    return this.client.log('Download Manager', message)
  }

  public dlLog (file: string, message: string) {
    return this.log(`[File: ${basename(file)}]: ${message}`)
  }

  public async execDownload (requestData: DownloadRequestData, destinationFile: string, getHeaders: boolean = true): Promise<string> {
    const { requestManager } = this
    const { listeners } = requestData
    const destinationFileBase = basename(destinationFile)

    if (existsSync(destinationFile)) {
      this.dlLog(destinationFile, 'Already downloaded')
      return destinationFile
    }

    this.dlLog(destinationFile, 'Fetching headers')
    const headers = getHeaders
      ? await new Promise<IncomingMessage['headers']>((resolve, reject) => {
        requestManager
          .executeRequest({
            ...requestData,
            listeners: {
              onResponse: (response) => resolve(response.headers)
            }
          })
          .catch(reject)
      })
      : undefined

    const tmpFile = (() => {
      const dir = dirname(destinationFile)
      const base = basename(destinationFile)

      this.dlLog(destinationFile, 'Scanning for potential resumable download...')
      for (const otherFile of (existsSync(dir) ? readdirSync(dir) : [])) {
        const otherFileSplit = otherFile.split('.')
        const parsedExtension = otherFileSplit[otherFileSplit.length - 1]
        const parsedBase = otherFileSplit.slice(1, -2).join('.')
        const parsedhash = otherFileSplit.slice(-2, -1)[0]

        if (
          (parsedExtension === 'tmp') &&
          (parsedBase === base) &&
          (parsedhash)
        ) {
          this.dlLog(destinationFile, 'Resumable download found.')
          return join(dir, otherFile)
        }
      }

      this.dlLog(destinationFile, 'No resumable download found.')
      return join(dir, `.${base}.${randomBytes(8).toString('hex')}.tmp`)
    })()

    const offset = (() => {
      if (headers?.['accept-ranges'] !== 'bytes') {
        this.dlLog(destinationFile, 'The server does not support ranges. Resuming is not possible.')
      } else if (existsSync(tmpFile)) {
        const size = lstatSync(tmpFile).size

        if (!headers?.['content-length']) {
          this.dlLog(destinationFile, 'Content length is not available. Resuming is not possible.')
        } if (Number(headers?.['content-length']) > size) {
          this.dlLog(destinationFile, 'Resuming is possible.')
          return size
        }
      }

      return 0
    })()

    if (offset) {
      this.dlLog(destinationFile, `Sending range headers (offset: ${offset})...`)
      requestData.headers = requestData.headers || (requestData.headers = {})
      requestData.headers.Range = `bytes=${offset}-`
    }

    return new Promise<string>((resolve, reject) => {
      requestData.listeners = {
        onDone: (data, error) => {
          listeners?.onDone?.(data, error)

          if (error) {
            reject(error)
          } else {
            resolve(<any> data)
          }
        },

        onQueue: (position: number) => {
          listeners?.onQueue?.(position)

          this.dlLog(destinationFile, `Queued ${position}`)
        },

        onRequest: (request) => {
          listeners?.onRequest?.(request)

          const progress = watchForProgress(request)
          progress.on('progress', (state: {
            speed: number | null
            size: {
              total: number | null
              transferred: number
            }
            time: {
              elapsed: number
              remaining: number | null
            }
          }) => {
            const { speed, size: { total, transferred }, time: { remaining } } = state
            if (total === transferred) {
              return
            }

            const remainingTime = remaining
              ? ((time) => {
                  let output: string = `${time.hours}:${time.minutes}:${time.seconds}`

                  while (output.startsWith('0:')) {
                    output = output.slice(2)
                  }

                  return output
                })(formatTime(remaining))
              : null

            this.dlLog(destinationFile, `Progress: ${humanFileSize(transferred)}/${total !== null ? humanFileSize(total) : '?'} (${total ? `${Math.round((transferred / total) * 100)}%, ` : ''}${speed ? humanFileSize(speed) : '?'}/s) ${remainingTime || '?'} remaining`)
          })
        },

        onResponse: (response) => {
          listeners?.onResponse?.(response)

          if (!existsSync(dirname(tmpFile))) {
            this.dlLog(destinationFile, 'Directory not found. Creating a new one...')
            mkdirSync(dirname(tmpFile), { recursive: true })
          }

          if ([200, 206].includes(<any> response.statusCode)) {
            const destinationStream = createWriteStream(tmpFile, offset ? { flags: 'a', start: offset } : {})

            response.pipe(destinationStream)
            response.on('end', () => {
              destinationStream.close()
              this.log(`Download finished for ${destinationFileBase}`)

              if (existsSync(tmpFile)) {
                renameSync(tmpFile, destinationFile)
                utimesSync(destinationFile, new Date(), (((input) => {
                  if (input) {
                    const date = new Date(input)

                    if (!Number.isNaN(date.getTime())) {
                      return date
                    }
                  }
                })(response.headers['last-modified']) || new Date()))
              }
            })
          }
        }
      }

      this.log(`Starting download for ${destinationFileBase}.`)
      requestManager.executeRequest(requestData)
    })
  }

  public async download (requestData: RequestData, destinationFile: string): Promise<string> {
    const { queue, client: { options: { downloadMaxRetries } } } = this
    const errors: Array<Error> = []
    let curRetry = 0

    while (curRetry < downloadMaxRetries) {
      try {
        return await new Promise<string>((resolve, reject) => {
          queue.pending.push({ resolve, reject, requestData, curRetry, maxRetry: downloadMaxRetries, destinationFile })

          if (!queue.running) {
            queue.runQueue()
          }
        })
      } catch (error: any) {
        errors.unshift(error)

        curRetry++
      }
    }

    throw errors[0]
  }

  public constructor (client: Client) {
    this.client = client
    this.requestManager = client.requestManager
    this.queue = new DownloadQueue(this)
  }
}

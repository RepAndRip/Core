import { join } from 'path'
import { RequestManager } from './request'
import { EventEmitter } from 'events'
import { DownloadManager } from './download'
import { Manager } from '@accitro/configmanager'

export interface ClientOptions {
  dataDir: string
  downloadParallelCount: number
  downloadMaxRetries: number
  customHeaders: { [key: string]: string }
  clients?: {
  }
  rateLimitTime: number
}

export class Client {
  public static mergeOptions (options?: Partial<ClientOptions>) {
    const defaultOptions: ClientOptions = {
      dataDir: join(process.cwd(), '.rnr'),
      downloadParallelCount: 2,
      downloadMaxRetries: 5,
      customHeaders: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1'
      },
      rateLimitTime: 1000
    }

    return Object.assign(defaultOptions, options)
  }

  private readonly _subClients: {
  }

  public readonly options: ClientOptions
  public readonly requestManager: RequestManager
  public readonly downloadManager: DownloadManager
  public readonly events: EventEmitter
  public readonly config: Manager

  public on <T extends keyof ClientEvents> (event: T, listener: (...args: ClientEvents[T]) => void) {
    this.events.on(event, <any> listener)

    return this
  }

  public once <T extends keyof ClientEvents> (event: T, listener: (...args: ClientEvents[T]) => void) {
    this.events.once(event, <any> listener)

    return this
  }

  public log (scope: string, message: string) {
    this.events.emit('debug', `[${scope}]: ${message}`)
  }

  public constructor (options?: Partial<ClientOptions>) {
    this.options = Client.mergeOptions(options)
    this.config = new Manager({ path: join(this.options.dataDir), name: 'Config' })
    this.requestManager = new RequestManager(this)
    this.downloadManager = new DownloadManager(this)
    this.events = new EventEmitter()
    this._subClients = {}
  }
}

export interface ClientEvents {
  debug: [message: string]
}

import { Client } from './client'
import { RequestManager } from './request'
import { DownloadManager } from './download'

export class SubClient {
  public readonly main: Client
  public readonly requestManager: RequestManager
  public readonly downloadManager: DownloadManager

  public toJSON () { return {} }

  public constructor (client: Client) {
    this.main = client
    this.requestManager = client.requestManager
    this.downloadManager = client.downloadManager
  }
}

export class BaseSubClass {
  public readonly client: SubClient
  public readonly main: Client

  public toJSON () { return {} }

  public constructor (subClient: SubClient) {
    this.client = subClient
    this.main = subClient.main
  }
}

export class BaseManager extends BaseSubClass {
  public readonly requestManager: RequestManager
  public readonly downloadManager: DownloadManager

  public log (message: string) {
    return this.main.log('Resource Manager', message)
  }

  public generateURL (input: string, query?: { [key: string]: string }) {
    const inputURL = new URL(input)
    const { searchParams } = inputURL

    if (query) {
      for (const queryKey in query) {
        searchParams.set(queryKey, query[queryKey])
      }
    }

    return inputURL
  }

  public readonly request: (...params: Parameters<RequestManager['request']>) => ReturnType<RequestManager['request']>

  public toJSON () { return {} }

  public constructor (subClient: SubClient) {
    const { main } = subClient

    super(subClient)
    this.request = main.requestManager.request.bind(main.requestManager)
    this.requestManager = main.requestManager
    this.downloadManager = main.downloadManager
  }
}

export class BaseResource extends BaseSubClass {
  protected readonly _rawData?: any
  protected readonly _lazyData: { [key: string]: any }

  protected _lazyGet (name: string, callback: (rawData: any) => any) {
    const { _lazyData, _rawData } = this

    if (!(name in _lazyData)) {
      const result = callback(_rawData)

      _lazyData[name] = result
    }

    return _lazyData[name]
  }

  public toJSON () {
    let proto = Object.getPrototypeOf(this)
    let descriptors: Array<{ [key: string]: ReturnType<typeof Object['getOwnPropertyDescriptor']> }> = []

    while (proto) {
      descriptors = { ...Object.getOwnPropertyDescriptors(proto), ...descriptors }

      proto = Object.getPrototypeOf(proto)
    }

    const obj: { [key: string]: any } = {}

    for (const descriptorKey in descriptors) {
      const descriptor = descriptors[descriptorKey]

      if (typeof (descriptor.get) === 'function') {
        obj[descriptorKey] = (<any> this)[descriptorKey]

        if (typeof (obj[descriptorKey]?.toJSON) === 'function') {
          obj[descriptorKey] = obj[descriptorKey].toJSON()
        }
      }
    }

    return obj
  }

  public constructor (client: SubClient, rawData?: any) {
    super(client)

    this._rawData = rawData
    this._lazyData = {}
  }
}

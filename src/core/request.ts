import { Manager as ConfigManager } from '@accitro/configmanager'
import { request as requestHTTP, ClientRequest, IncomingMessage } from 'http'
import { request as requestHTTPS } from 'https'
import { generateRandomHex, waitUntil } from '../utils/misc'
import { BaseClass } from './base'
import { Client } from './client'

export interface Cookie {
  key: string
  value: string

  expiry?: number
  ephemeralID?: string

  secure: boolean
  httpOnly: boolean

  domain: string
  path: string
}

export interface CookieData {
  [key: string]: undefined | {
    [key: string]: {
      [key: string]: Cookie
    }
  }
}

export class CookieJar extends BaseClass {
  public static parse (domain: string, path: string, isSecure: boolean, isHTTP: boolean, cookieHeader: string): Cookie {
    const headerSplit = cookieHeader.split(';')
    const [key, value] = headerSplit.splice(0, 1)[0].split('=').map((string) => decodeURI(string))

    let secure = isSecure
    let httpOnly = isHTTP
    let expiry = 0

    for (const headerSplitEntry of headerSplit) {
      const [optionName, optionValue] = headerSplitEntry.split('=')

      switch (optionName.toLowerCase().trim()) {
        case 'expires':
          expiry = new Date(optionValue).getTime() / 1000
          break

        case 'max-age': {
          const parsed = Number.parseInt(optionValue)
          expiry = parsed > 0 ? (Date.now() / 1000) + parsed : 1
        } break

        case 'domain':
          domain = optionValue
          break

        case 'path':
          path = optionValue
          break

        case 'secure':
          secure = true
          break

        case 'httponly':
          httpOnly = true
          break
      }
    }

    return { key, value, domain, path, secure, expiry, httpOnly }
  }

  public requestManager: RequestManager
  public config: ConfigManager
  public ephemeralID: string

  public getAll () {
    const { config } = this
    const cookies: CookieData = config.defaults('Cookies', {})

    return cookies
  }

  public setAll (cookies: CookieData) {
    const { config } = this

    config.set('Cookies', cookies)
  }

  public filterGet (domain: string, path: string, secure: boolean, http: boolean) {
    domain = domain.toLowerCase()
    const allCookies = this.getAll()
    const domainMatchedCookies: Array<CookieData['']> = (() => {
      const matched: Array<CookieData['']> = []

      if (allCookies[domain]) {
        matched.push(allCookies[domain])
      }

      for (const cookieDomain in allCookies) {
        if (
          (cookieDomain === domain) ||
          (cookieDomain.startsWith('.') && (domain.endsWith(cookieDomain.slice(1))))
        ) {
          matched.push(allCookies[cookieDomain])
        }
      }

      return matched
    })()

    const result: Array<Cookie> = []
    for (const matchedCookie of domainMatchedCookies) {
      for (const cookiePath in matchedCookie) {
        if (path.startsWith(cookiePath)) {
          for (const cookieKey in matchedCookie[cookiePath]) {
            const cookie = matchedCookie[cookiePath][cookieKey]

            if (!(
              (!(cookie && (cookie.value !== undefined))) ||
              (cookie.secure && (!secure)) ||
              (cookie.httpOnly && (!http)) ||
              !((cookie.expiry && (cookie.expiry >= (Date.now() / 1000))) ||
              (cookie.ephemeralID === this.ephemeralID))
            )) {
              result.push(cookie)
            }
          }
        }
      }
    }

    return result
  }

  public get (domain: string, path: string, secure: boolean, http: boolean, key: string) {
    return this.filterGet(domain, path, secure, http).find((cookie) => cookie.key === key)
  }

  public set (domain: string, path: string, key: string, value: string, secure: boolean, expiry: number = 0, httpOnly: boolean = false) {
    domain = domain.toLowerCase()

    const cookiesPerDomain = this.getAll()
    const cookieDomain = cookiesPerDomain[domain] || (cookiesPerDomain[domain] = {})
    const cookiePath = cookieDomain[path] || (cookieDomain[path] = {})
    cookiePath[key] = { domain, path, key, value, expiry, secure, httpOnly, ephemeralID: this.ephemeralID }

    this.setAll(cookiesPerDomain)
  }

  public bind (request: ClientRequest) {
    const isSecure = request.protocol === 'https:'
    const isHTTP = ['https:', 'http:'].includes(request.protocol)

    if (!request.writableEnded) {
      const cookies = this.filterGet(request.host, request.path, isSecure, isHTTP)
      let cookiesStr = ''

      for (const cookie of cookies) {
        cookiesStr += `${encodeURIComponent(cookie.key)}=${encodeURIComponent(cookie.value)}; `
      }

      if (cookiesStr) {
        request.setHeader('Cookie', cookiesStr)
      }
    }

    request.on('response', (response) => {
      const cookieHeaders = response.headers['set-cookie']

      if (cookieHeaders) {
        for (const cookieHeader of cookieHeaders) {
          const { domain, path, key, value, secure, expiry, httpOnly } = CookieJar.parse(request.host, request.path, isSecure, isHTTP, cookieHeader)
          this.set(domain, path, key, value, secure, expiry, httpOnly)
        }
      }
    })
  }

  public constructor (requestManager: RequestManager) {
    super(requestManager.client)

    this.requestManager = requestManager
    this.config = this.client.config.summon({ name: 'CookieJar' })
    this.ephemeralID = generateRandomHex()
  }
}

export interface RequestData {
  link: string
  method: 'POST' | 'GET' | 'HEAD'
  query?: { [key: string]: string }
  payload?: {
    type: 'URLENCODED' | 'JSON'
    data: { [key: string]: any }
  } | {
    type: 'RAW'
    data: string
  }
  headers?: { [key: string]: string }
  cookieJar?: CookieJar
  is404Error?: boolean
  listeners?: {
    onRequest?: (request: ClientRequest) => void
    onResponse?: (response: IncomingMessage) => void
    onDone?: (data: string | undefined, error: Error | undefined) => void
  }
  returnOutput?: boolean
}

export class MainRequestQueue {
  public readonly client: Client
  public readonly requestManager: RequestManager
  public readonly perHost: { [key: string]: PerHostRequestQueue }

  public getByHost (host: string): PerHostRequestQueue {
    const { perHost } = this

    return perHost[host] || (perHost[host] = new PerHostRequestQueue(this))
  }

  public constructor (requestManager: RequestManager) {
    this.requestManager = requestManager
    this.client = requestManager.client
    this.perHost = {}
  }
}

export interface PerHostRequestQueueEntry {
  requestData: RequestData
  resolve: (data: string | undefined) => void
  reject: (error: Error) => void
}

export class PerHostRequestQueue {
  public readonly client: Client
  public readonly mainQueue: MainRequestQueue
  public readonly entries: Array<PerHostRequestQueueEntry>
  public isRunning: boolean
  public lastRequest: number

  public push (entry: PerHostRequestQueueEntry) {
    this.entries.push(entry)

    if (!this.isRunning) {
      this.runQueue()
    }
  }

  public async runQueue () {
    if (this.isRunning) {
      return
    }

    this.isRunning = true
    try {
      const { entries, mainQueue } = this

      while (this.entries.length) {
        const entry = <PerHostRequestQueueEntry> entries.shift()

        await waitUntil(this.lastRequest + 1500)
        this.lastRequest = Date.now()
        await mainQueue.requestManager.executeRequest(entry.requestData)
          .then(entry.resolve)
          .catch(entry.reject)
      }
    } finally {
      this.isRunning = false
    }
  }

  public constructor (queue: MainRequestQueue) {
    this.mainQueue = queue
    this.client = queue.client
    this.entries = []

    this.lastRequest = 0
    this.isRunning = false
  }
}

export class RequestManager {
  public readonly client: Client
  public readonly cookieJar: CookieJar
  public readonly queue: MainRequestQueue

  public log (message: string) {
    this.client.log('Request Manager', message)
  }

  public generateURL (linkString: string, query?: { [key: string]: string }) {
    const link = new URL(linkString)

    if (query) {
      const { searchParams } = link

      for (const queryKey in query) {
        searchParams.set(queryKey, query[queryKey])
      }
    }

    return link
  }

  public generateRequest (requestData: RequestData) {
    const { method, payload, headers, cookieJar, query, link } = requestData
    const url = this.generateURL(link, query)
    const request = (() => {
      switch (url.protocol) {
        case 'http:': return requestHTTP(url)
        case 'https:': return requestHTTPS(url)

        default: throw new Error(`Unknown protocol: ${url.protocol}`)
      }
    })()

    request.method = method

    const { customHeaders } = this.client.options
    const joinedHeaders = { ...customHeaders, ...headers }
    for (const headerKey in joinedHeaders) {
      request.setHeader(headerKey, joinedHeaders[headerKey])
    }

    cookieJar?.bind(request)

    if ((method === 'POST') && payload) {
      let payloadType: string = ''
      let payloadData: string = ''

      switch (payload.type) {
        case 'RAW':
          payloadType = 'text/plain'
          payloadData = payload.data
          break

        case 'JSON':
          payloadType = 'text/plain'
          payloadData = JSON.stringify(payload.data)
          break

        case 'URLENCODED':
          payloadType = 'application/x-www-form-urlencoded'
          payloadData = (() => {
            const link = new URL('https://a/')
            const { searchParams } = link

            for (const dataKey in payload.data) {
              searchParams.set(dataKey, payload.data[dataKey])
            }

            return link.search.slice(1)
          })()
          break
      }

      if (payloadData && payloadType) {
        request.setHeader('Content-Type', payloadType)
        request.write(payload)
      }
    } else if ((method !== 'POST') && payload) {
      throw new Error('Unexpected payload data')
    }

    return request
  }

  public request (requestData: RequestData) {
    const { link, query } = requestData

    return new Promise<string | undefined>((resolve, reject) => this.queue.getByHost(this.generateURL(link, query).hostname).push({ requestData, resolve, reject }))
  }

  public async executeRequest (data: RequestData): Promise<string | undefined> {
    const request = this.generateRequest(data)
    const returnOutput = typeof (data.returnOutput) === 'boolean' ? data.returnOutput : true
    const { listeners } = data

    this.cookieJar.bind(request)
    listeners?.onRequest?.(request)
    return new Promise((resolve, reject) => {
      const proxyReject = (error: Error) => {
        this.log(`${error.stack}`)

        if (listeners?.onDone) {
          listeners.onDone(undefined, error)
        } else {
          reject(error)
        }
      }
      const proxyResolve = (responseText: string | undefined) => {
        if (listeners?.onDone) {
          listeners.onDone(responseText, undefined)
        } else {
          resolve(responseText)
        }
      }

      request.on('error', proxyReject)
      request.on('response', (response) => {
        let responseText: string = ''

        response.on('error', proxyReject)

        listeners?.onResponse?.(response)
        switch (response.statusCode) {
          case 200:
          case 206:
            response.on('data', (chunk) => returnOutput && (responseText += chunk))
            response.on('end', () => proxyResolve(returnOutput ? responseText : undefined))
            break

          case 301:
            this.executeRequest({ ...data, link: `${response.headers.location}` }).then(resolve).catch(reject)
            break

          case 404:
            if (!data.is404Error) {
              proxyResolve(undefined)
              break
            }

          // eslint-disable-next-line no-fallthrough
          default:
            proxyReject(new Error(`HTTP ${response.statusCode} hit on ${data.link}`))
            break
        }
      })

      this.log(`HTTP ${data.method} ${this.generateURL(data.link, data.query)}`)
      request.end()
    })
  }

  public constructor (client: Client) {
    this.client = client
    this.cookieJar = new CookieJar(this)
    this.queue = new MainRequestQueue(this)
  }
}

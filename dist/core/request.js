"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestManager = exports.PerHostRequestQueue = exports.MainRequestQueue = exports.CookieJar = void 0;
const http_1 = require("http");
const https_1 = require("https");
const misc_1 = require("../utils/misc");
const base_1 = require("./base");
class CookieJar extends base_1.BaseClass {
    static parse(domain, path, isSecure, isHTTP, cookieHeader) {
        const headerSplit = cookieHeader.split(';');
        const [key, value] = headerSplit.splice(0, 1)[0].split('=').map((string) => decodeURI(string));
        let secure = isSecure;
        let httpOnly = isHTTP;
        let expiry = 0;
        for (const headerSplitEntry of headerSplit) {
            const [optionName, optionValue] = headerSplitEntry.split('=');
            switch (optionName.toLowerCase().trim()) {
                case 'expires':
                    expiry = new Date(optionValue).getTime() / 1000;
                    break;
                case 'max-age':
                    {
                        const parsed = Number.parseInt(optionValue);
                        expiry = parsed > 0 ? (Date.now() / 1000) + parsed : 1;
                    }
                    break;
                case 'domain':
                    domain = optionValue;
                    break;
                case 'path':
                    path = optionValue;
                    break;
                case 'secure':
                    secure = true;
                    break;
                case 'httponly':
                    httpOnly = true;
                    break;
            }
        }
        return { key, value, domain, path, secure, expiry, httpOnly };
    }
    requestManager;
    config;
    ephemeralID;
    getAll() {
        const { config } = this;
        const cookies = config.defaults('Cookies', {});
        return cookies;
    }
    setAll(cookies) {
        const { config } = this;
        config.set('Cookies', cookies);
    }
    filterGet(domain, path, secure, http) {
        domain = domain.toLowerCase();
        const allCookies = this.getAll();
        const domainMatchedCookies = (() => {
            const matched = [];
            if (allCookies[domain]) {
                matched.push(allCookies[domain]);
            }
            for (const cookieDomain in allCookies) {
                if ((cookieDomain === domain) ||
                    (cookieDomain.startsWith('.') && (domain.endsWith(cookieDomain.slice(1))))) {
                    matched.push(allCookies[cookieDomain]);
                }
            }
            return matched;
        })();
        const result = [];
        for (const matchedCookie of domainMatchedCookies) {
            for (const cookiePath in matchedCookie) {
                if (path.startsWith(cookiePath)) {
                    for (const cookieKey in matchedCookie[cookiePath]) {
                        const cookie = matchedCookie[cookiePath][cookieKey];
                        if (!((!(cookie && (cookie.value !== undefined))) ||
                            (cookie.secure && (!secure)) ||
                            (cookie.httpOnly && (!http)) ||
                            !((cookie.expiry && (cookie.expiry >= (Date.now() / 1000))) ||
                                (cookie.ephemeralID === this.ephemeralID)))) {
                            result.push(cookie);
                        }
                    }
                }
            }
        }
        return result;
    }
    get(domain, path, secure, http, key) {
        return this.filterGet(domain, path, secure, http).find((cookie) => cookie.key === key);
    }
    set(domain, path, key, value, secure, expiry = 0, httpOnly = false) {
        domain = domain.toLowerCase();
        const cookiesPerDomain = this.getAll();
        const cookieDomain = cookiesPerDomain[domain] || (cookiesPerDomain[domain] = {});
        const cookiePath = cookieDomain[path] || (cookieDomain[path] = {});
        cookiePath[key] = { domain, path, key, value, expiry, secure, httpOnly, ephemeralID: this.ephemeralID };
        this.setAll(cookiesPerDomain);
    }
    bind(request) {
        const isSecure = request.protocol === 'https:';
        const isHTTP = ['https:', 'http:'].includes(request.protocol);
        if (!request.writableEnded) {
            const cookies = this.filterGet(request.host, request.path, isSecure, isHTTP);
            let cookiesStr = '';
            for (const cookie of cookies) {
                cookiesStr += `${encodeURIComponent(cookie.key)}=${encodeURIComponent(cookie.value)}; `;
            }
            if (cookiesStr) {
                request.setHeader('Cookie', cookiesStr);
            }
        }
        request.on('response', (response) => {
            const cookieHeaders = response.headers['set-cookie'];
            if (cookieHeaders) {
                for (const cookieHeader of cookieHeaders) {
                    const { domain, path, key, value, secure, expiry, httpOnly } = CookieJar.parse(request.host, request.path, isSecure, isHTTP, cookieHeader);
                    this.set(domain, path, key, value, secure, expiry, httpOnly);
                }
            }
        });
    }
    constructor(requestManager) {
        super(requestManager.client);
        this.requestManager = requestManager;
        this.config = this.client.config.summon({ name: 'CookieJar' });
        this.ephemeralID = (0, misc_1.generateRandomHex)();
    }
}
exports.CookieJar = CookieJar;
class MainRequestQueue {
    client;
    requestManager;
    perHost;
    getByHost(host) {
        const { perHost } = this;
        return perHost[host] || (perHost[host] = new PerHostRequestQueue(this));
    }
    constructor(requestManager) {
        this.requestManager = requestManager;
        this.client = requestManager.client;
        this.perHost = {};
    }
}
exports.MainRequestQueue = MainRequestQueue;
class PerHostRequestQueue {
    client;
    mainQueue;
    entries;
    isRunning;
    lastRequest;
    push(entry) {
        this.entries.push(entry);
        if (!this.isRunning) {
            this.runQueue();
        }
    }
    async runQueue() {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        try {
            const { entries, mainQueue } = this;
            while (this.entries.length) {
                const entry = entries.shift();
                await (0, misc_1.waitUntil)(this.lastRequest + 1500);
                this.lastRequest = Date.now();
                await mainQueue.requestManager.executeRequest(entry.requestData)
                    .then(entry.resolve)
                    .catch(entry.reject);
            }
        }
        finally {
            this.isRunning = false;
        }
    }
    constructor(queue) {
        this.mainQueue = queue;
        this.client = queue.client;
        this.entries = [];
        this.lastRequest = 0;
        this.isRunning = false;
    }
}
exports.PerHostRequestQueue = PerHostRequestQueue;
class RequestManager {
    client;
    cookieJar;
    queue;
    log(message) {
        this.client.log('Request Manager', message);
    }
    generateURL(linkString, query) {
        const link = new URL(linkString);
        if (query) {
            const { searchParams } = link;
            for (const queryKey in query) {
                searchParams.set(queryKey, query[queryKey]);
            }
        }
        return link;
    }
    generateRequest(requestData) {
        const { method, payload, headers, cookieJar, query, link } = requestData;
        const url = this.generateURL(link, query);
        const request = (() => {
            switch (url.protocol) {
                case 'http:': return (0, http_1.request)(url);
                case 'https:': return (0, https_1.request)(url);
                default: throw new Error(`Unknown protocol: ${url.protocol}`);
            }
        })();
        request.method = method;
        const { customHeaders } = this.client.options;
        const joinedHeaders = { ...customHeaders, ...headers };
        for (const headerKey in joinedHeaders) {
            request.setHeader(headerKey, joinedHeaders[headerKey]);
        }
        cookieJar?.bind(request);
        if ((method === 'POST') && payload) {
            let payloadType = '';
            let payloadData = '';
            switch (payload.type) {
                case 'RAW':
                    payloadType = 'text/plain';
                    payloadData = payload.data;
                    break;
                case 'JSON':
                    payloadType = 'text/plain';
                    payloadData = JSON.stringify(payload.data);
                    break;
                case 'URLENCODED':
                    payloadType = 'application/x-www-form-urlencoded';
                    payloadData = (() => {
                        const link = new URL('https://a/');
                        const { searchParams } = link;
                        for (const dataKey in payload.data) {
                            searchParams.set(dataKey, payload.data[dataKey]);
                        }
                        return link.search.slice(1);
                    })();
                    break;
            }
            if (payloadData && payloadType) {
                request.setHeader('Content-Type', payloadType);
                request.write(payload);
            }
        }
        else if ((method !== 'POST') && payload) {
            throw new Error('Unexpected payload data');
        }
        return request;
    }
    request(requestData) {
        const { link, query } = requestData;
        return new Promise((resolve, reject) => this.queue.getByHost(this.generateURL(link, query).hostname).push({ requestData, resolve, reject }));
    }
    async executeRequest(data) {
        const request = this.generateRequest(data);
        const returnOutput = typeof (data.returnOutput) === 'boolean' ? data.returnOutput : true;
        const { listeners } = data;
        this.cookieJar.bind(request);
        listeners?.onRequest?.(request);
        return new Promise((resolve, reject) => {
            const proxyReject = (error) => {
                this.log(`${error.stack}`);
                if (listeners?.onDone) {
                    listeners.onDone(undefined, error);
                }
                else {
                    reject(error);
                }
            };
            const proxyResolve = (responseText) => {
                if (listeners?.onDone) {
                    listeners.onDone(responseText, undefined);
                }
                else {
                    resolve(responseText);
                }
            };
            request.on('error', proxyReject);
            request.on('response', (response) => {
                let responseText = '';
                response.on('error', proxyReject);
                listeners?.onResponse?.(response);
                switch (response.statusCode) {
                    case 200:
                    case 206:
                        response.on('data', (chunk) => returnOutput && (responseText += chunk));
                        response.on('end', () => proxyResolve(returnOutput ? responseText : undefined));
                        break;
                    case 301:
                        this.executeRequest({ ...data, link: `${response.headers.location}` }).then(resolve).catch(reject);
                        break;
                    case 404:
                        if (!data.is404Error) {
                            proxyResolve(undefined);
                            break;
                        }
                    // eslint-disable-next-line no-fallthrough
                    default:
                        proxyReject(new Error(`HTTP ${response.statusCode} hit on ${data.link}`));
                        break;
                }
            });
            this.log(`HTTP ${data.method} ${this.generateURL(data.link, data.query)}`);
            request.end();
        });
    }
    constructor(client) {
        this.client = client;
        this.cookieJar = new CookieJar(this);
        this.queue = new MainRequestQueue(this);
    }
}
exports.RequestManager = RequestManager;

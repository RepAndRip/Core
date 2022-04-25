/// <reference types="node" />
import { Manager as ConfigManager } from '@accitro/configmanager';
import { ClientRequest, IncomingMessage } from 'http';
import { BaseClass } from './base';
import { Client } from './client';
export interface Cookie {
    key: string;
    value: string;
    expiry?: number;
    ephemeralID?: string;
    secure: boolean;
    httpOnly: boolean;
    domain: string;
    path: string;
}
export interface CookieData {
    [key: string]: undefined | {
        [key: string]: {
            [key: string]: Cookie;
        };
    };
}
export declare class CookieJar extends BaseClass {
    static parse(domain: string, path: string, isSecure: boolean, isHTTP: boolean, cookieHeader: string): Cookie;
    requestManager: RequestManager;
    config: ConfigManager;
    ephemeralID: string;
    getAll(): CookieData;
    setAll(cookies: CookieData): void;
    filterGet(domain: string, path: string, secure: boolean, http: boolean): Cookie[];
    get(domain: string, path: string, secure: boolean, http: boolean, key: string): Cookie | undefined;
    set(domain: string, path: string, key: string, value: string, secure: boolean, expiry?: number, httpOnly?: boolean): void;
    bind(request: ClientRequest): void;
    constructor(requestManager: RequestManager);
}
export interface RequestData {
    link: string;
    method: 'POST' | 'GET' | 'HEAD';
    query?: {
        [key: string]: string;
    };
    payload?: {
        type: 'URLENCODED' | 'JSON';
        data: {
            [key: string]: any;
        };
    } | {
        type: 'RAW';
        data: string;
    };
    headers?: {
        [key: string]: string;
    };
    cookieJar?: CookieJar;
    is404Error?: boolean;
    listeners?: {
        onRequest?: (request: ClientRequest) => void;
        onResponse?: (response: IncomingMessage) => void;
        onDone?: (data: string | undefined, error: Error | undefined) => void;
    };
    returnOutput?: boolean;
}
export declare class MainRequestQueue {
    readonly client: Client;
    readonly requestManager: RequestManager;
    readonly perHost: {
        [key: string]: PerHostRequestQueue;
    };
    getByHost(host: string): PerHostRequestQueue;
    constructor(requestManager: RequestManager);
}
export interface PerHostRequestQueueEntry {
    requestData: RequestData;
    resolve: (data: string | undefined) => void;
    reject: (error: Error) => void;
}
export declare class PerHostRequestQueue {
    readonly client: Client;
    readonly mainQueue: MainRequestQueue;
    readonly entries: Array<PerHostRequestQueueEntry>;
    isRunning: boolean;
    lastRequest: number;
    push(entry: PerHostRequestQueueEntry): void;
    runQueue(): Promise<void>;
    constructor(queue: MainRequestQueue);
}
export declare class RequestManager {
    readonly client: Client;
    readonly cookieJar: CookieJar;
    readonly queue: MainRequestQueue;
    log(message: string): void;
    generateURL(linkString: string, query?: {
        [key: string]: string;
    }): URL;
    generateRequest(requestData: RequestData): ClientRequest;
    request(requestData: RequestData): Promise<string | undefined>;
    executeRequest(data: RequestData): Promise<string | undefined>;
    constructor(client: Client);
}

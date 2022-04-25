/// <reference types="node" />
import { RequestManager } from './request';
import { EventEmitter } from 'events';
import { DownloadManager } from './download';
import { Manager } from '@accitro/configmanager';
export interface ClientOptions {
    dataDir: string;
    downloadParallelCount: number;
    downloadMaxRetries: number;
    customHeaders: {
        [key: string]: string;
    };
    clients?: {};
    rateLimitTime: number;
}
export declare class Client {
    static mergeOptions(options?: Partial<ClientOptions>): ClientOptions & Partial<ClientOptions>;
    private readonly _subClients;
    readonly options: ClientOptions;
    readonly requestManager: RequestManager;
    readonly downloadManager: DownloadManager;
    readonly events: EventEmitter;
    readonly config: Manager;
    on<T extends keyof ClientEvents>(event: T, listener: (...args: ClientEvents[T]) => void): this;
    once<T extends keyof ClientEvents>(event: T, listener: (...args: ClientEvents[T]) => void): this;
    log(scope: string, message: string): void;
    constructor(options?: Partial<ClientOptions>);
}
export interface ClientEvents {
    debug: [message: string];
}

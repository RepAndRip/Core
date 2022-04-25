import { Client } from './client';
import { RequestManager } from './request';
import { DownloadManager } from './download';
export declare class SubClient {
    readonly main: Client;
    readonly requestManager: RequestManager;
    readonly downloadManager: DownloadManager;
    toJSON(): {};
    constructor(client: Client);
}
export declare class BaseSubClass {
    readonly client: SubClient;
    readonly main: Client;
    toJSON(): {};
    constructor(subClient: SubClient);
}
export declare class BaseManager extends BaseSubClass {
    readonly requestManager: RequestManager;
    readonly downloadManager: DownloadManager;
    log(message: string): void;
    generateURL(input: string, query?: {
        [key: string]: string;
    }): URL;
    readonly request: (...params: Parameters<RequestManager['request']>) => ReturnType<RequestManager['request']>;
    toJSON(): {};
    constructor(subClient: SubClient);
}
export declare class BaseResource extends BaseSubClass {
    protected readonly _rawData?: any;
    protected readonly _lazyData: {
        [key: string]: any;
    };
    protected _lazyGet(name: string, callback: (rawData: any) => any): any;
    toJSON(): {
        [key: string]: any;
    };
    constructor(client: SubClient, rawData?: any);
}

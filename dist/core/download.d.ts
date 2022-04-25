import { RequestManager } from '..';
import { RequestData } from '../core/request';
import { Client } from './client';
export interface DownloadEntry {
    resolve: (data: string) => void;
    reject: (error: Error) => void;
    maxRetry: number;
    curRetry: number;
    requestData: DownloadRequestData;
    destinationFile: string;
}
export interface DownloadRequestData extends RequestData {
    listeners?: RequestData['listeners'] & {
        onQueue?: (position: number) => void;
        onProgress?: (current: number, total: number | undefined) => void;
    };
}
export declare class DownloadQueue {
    readonly manager: DownloadManager;
    readonly pending: Array<DownloadEntry>;
    readonly ongoing: Array<DownloadEntry>;
    running: boolean;
    log(message: string): void;
    runQueue(): Promise<void>;
    constructor(manager: DownloadManager);
}
export declare class DownloadManager {
    readonly client: Client;
    readonly queue: DownloadQueue;
    readonly requestManager: RequestManager;
    log(message: string): void;
    dlLog(file: string, message: string): void;
    execDownload(requestData: DownloadRequestData, destinationFile: string, getHeaders?: boolean): Promise<string>;
    download(requestData: RequestData, destinationFile: string): Promise<string>;
    constructor(client: Client);
}

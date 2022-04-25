"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DownloadManager = exports.DownloadQueue = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const misc_1 = require("../utils/misc");
class DownloadQueue {
    manager;
    pending;
    ongoing;
    running;
    log(message) {
        return this.manager.client.log('Download Queue', message);
    }
    async runQueue() {
        const { pending, manager, ongoing, manager: { client: { options: { downloadParallelCount } } } } = this;
        if (!this.running) {
            this.log('Queue is running.');
            this.running = true;
            while (pending.length || ongoing.length) {
                while (ongoing.length < downloadParallelCount) {
                    const downloadEntry = pending.shift();
                    if (!downloadEntry) {
                        break;
                    }
                    const queueIndex = ongoing.push(downloadEntry) - 1;
                    downloadEntry.requestData.listeners?.onQueue?.(queueIndex);
                    manager.execDownload(downloadEntry.requestData, downloadEntry.destinationFile)
                        .then(downloadEntry.resolve)
                        .catch(downloadEntry.reject)
                        .finally(() => {
                        const index = ongoing.indexOf(downloadEntry);
                        if (index > -1) {
                            ongoing.splice(index, 1);
                        }
                    });
                }
                await (0, misc_1.sleep)(100);
            }
            this.running = false;
            this.log('Queue is stopped.');
        }
    }
    constructor(manager) {
        this.manager = manager;
        this.pending = [];
        this.ongoing = [];
        this.running = false;
    }
}
exports.DownloadQueue = DownloadQueue;
class DownloadManager {
    client;
    queue;
    requestManager;
    log(message) {
        return this.client.log('Download Manager', message);
    }
    dlLog(file, message) {
        return this.log(`[File: ${(0, path_1.basename)(file)}]: ${message}`);
    }
    async execDownload(requestData, destinationFile, getHeaders = true) {
        const { requestManager } = this;
        const { listeners } = requestData;
        const destinationFileBase = (0, path_1.basename)(destinationFile);
        if ((0, fs_1.existsSync)(destinationFile)) {
            this.dlLog(destinationFile, 'Already downloaded');
            return destinationFile;
        }
        this.dlLog(destinationFile, 'Fetching headers');
        const headers = getHeaders
            ? await new Promise((resolve, reject) => {
                requestManager
                    .executeRequest({
                    ...requestData,
                    listeners: {
                        onResponse: (response) => resolve(response.headers)
                    }
                })
                    .catch(reject);
            })
            : undefined;
        const tmpFile = (() => {
            const dir = (0, path_1.dirname)(destinationFile);
            const base = (0, path_1.basename)(destinationFile);
            this.dlLog(destinationFile, 'Scanning for potential resumable download...');
            for (const otherFile of ((0, fs_1.existsSync)(dir) ? (0, fs_1.readdirSync)(dir) : [])) {
                const otherFileSplit = otherFile.split('.');
                const parsedExtension = otherFileSplit[otherFileSplit.length - 1];
                const parsedBase = otherFileSplit.slice(1, -2).join('.');
                const parsedhash = otherFileSplit.slice(-2, -1)[0];
                if ((parsedExtension === 'tmp') &&
                    (parsedBase === base) &&
                    (parsedhash)) {
                    this.dlLog(destinationFile, 'Resumable download found.');
                    return (0, path_1.join)(dir, otherFile);
                }
            }
            this.dlLog(destinationFile, 'No resumable download found.');
            return (0, path_1.join)(dir, `.${base}.${(0, crypto_1.randomBytes)(8).toString('hex')}.tmp`);
        })();
        const offset = (() => {
            if (headers?.['accept-ranges'] !== 'bytes') {
                this.dlLog(destinationFile, 'The server does not support ranges. Resuming is not possible.');
            }
            else if ((0, fs_1.existsSync)(tmpFile)) {
                const size = (0, fs_1.lstatSync)(tmpFile).size;
                if (!headers?.['content-length']) {
                    this.dlLog(destinationFile, 'Content length is not available. Resuming is not possible.');
                }
                if (Number(headers?.['content-length']) > size) {
                    this.dlLog(destinationFile, 'Resuming is possible.');
                    return size;
                }
            }
            return 0;
        })();
        if (offset) {
            this.dlLog(destinationFile, `Sending range headers (offset: ${offset})...`);
            requestData.headers = requestData.headers || (requestData.headers = {});
            requestData.headers.Range = `bytes=${offset}-`;
        }
        return new Promise((resolve, reject) => {
            requestData.listeners = {
                onDone: (data, error) => {
                    listeners?.onDone?.(data, error);
                    if (error) {
                        reject(error);
                    }
                    else {
                        resolve(data);
                    }
                },
                onQueue: (position) => {
                    listeners?.onQueue?.(position);
                    this.dlLog(destinationFile, `Queued ${position}`);
                },
                onRequest: (request) => {
                    listeners?.onRequest?.(request);
                    const progress = (0, misc_1.watchForProgress)(request);
                    progress.on('progress', (state) => {
                        const { speed, size: { total, transferred }, time: { remaining } } = state;
                        if (total === transferred) {
                            return;
                        }
                        const remainingTime = remaining
                            ? ((time) => {
                                let output = `${time.hours}:${time.minutes}:${time.seconds}`;
                                while (output.startsWith('0:')) {
                                    output = output.slice(2);
                                }
                                return output;
                            })((0, misc_1.formatTime)(remaining))
                            : null;
                        this.dlLog(destinationFile, `Progress: ${(0, misc_1.humanFileSize)(transferred)}/${total !== null ? (0, misc_1.humanFileSize)(total) : '?'} (${total ? `${Math.round((transferred / total) * 100)}%, ` : ''}${speed ? (0, misc_1.humanFileSize)(speed) : '?'}/s) ${remainingTime || '?'} remaining`);
                    });
                },
                onResponse: (response) => {
                    listeners?.onResponse?.(response);
                    if (!(0, fs_1.existsSync)((0, path_1.dirname)(tmpFile))) {
                        this.dlLog(destinationFile, 'Directory not found. Creating a new one...');
                        (0, fs_1.mkdirSync)((0, path_1.dirname)(tmpFile), { recursive: true });
                    }
                    if ([200, 206].includes(response.statusCode)) {
                        const destinationStream = (0, fs_1.createWriteStream)(tmpFile, offset ? { flags: 'a', start: offset } : {});
                        response.pipe(destinationStream);
                        response.on('end', () => {
                            destinationStream.close();
                            this.log(`Download finished for ${destinationFileBase}`);
                            if ((0, fs_1.existsSync)(tmpFile)) {
                                (0, fs_1.renameSync)(tmpFile, destinationFile);
                                (0, fs_1.utimesSync)(destinationFile, new Date(), (((input) => {
                                    if (input) {
                                        const date = new Date(input);
                                        if (!Number.isNaN(date.getTime())) {
                                            return date;
                                        }
                                    }
                                })(response.headers['last-modified']) || new Date()));
                            }
                        });
                    }
                }
            };
            this.log(`Starting download for ${destinationFileBase}.`);
            requestManager.executeRequest(requestData);
        });
    }
    async download(requestData, destinationFile) {
        const { queue, client: { options: { downloadMaxRetries } } } = this;
        const errors = [];
        let curRetry = 0;
        while (curRetry < downloadMaxRetries) {
            try {
                return await new Promise((resolve, reject) => {
                    queue.pending.push({ resolve, reject, requestData, curRetry, maxRetry: downloadMaxRetries, destinationFile });
                    if (!queue.running) {
                        queue.runQueue();
                    }
                });
            }
            catch (error) {
                errors.unshift(error);
                curRetry++;
            }
        }
        throw errors[0];
    }
    constructor(client) {
        this.client = client;
        this.requestManager = client.requestManager;
        this.queue = new DownloadQueue(this);
    }
}
exports.DownloadManager = DownloadManager;

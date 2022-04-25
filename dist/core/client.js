"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = void 0;
const path_1 = require("path");
const request_1 = require("./request");
const events_1 = require("events");
const download_1 = require("./download");
const configmanager_1 = require("@accitro/configmanager");
class Client {
    static mergeOptions(options) {
        const defaultOptions = {
            dataDir: (0, path_1.join)(process.cwd(), '.rnr'),
            downloadParallelCount: 2,
            downloadMaxRetries: 5,
            customHeaders: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1'
            },
            rateLimitTime: 1000
        };
        return Object.assign(defaultOptions, options);
    }
    _subClients;
    options;
    requestManager;
    downloadManager;
    events;
    config;
    on(event, listener) {
        this.events.on(event, listener);
        return this;
    }
    once(event, listener) {
        this.events.once(event, listener);
        return this;
    }
    log(scope, message) {
        this.events.emit('debug', `[${scope}]: ${message}`);
    }
    constructor(options) {
        this.options = Client.mergeOptions(options);
        this.config = new configmanager_1.Manager({ path: (0, path_1.join)(this.options.dataDir), name: 'Config' });
        this.requestManager = new request_1.RequestManager(this);
        this.downloadManager = new download_1.DownloadManager(this);
        this.events = new events_1.EventEmitter();
        this._subClients = {};
    }
}
exports.Client = Client;

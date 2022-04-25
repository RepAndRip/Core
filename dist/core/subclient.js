"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseResource = exports.BaseManager = exports.BaseSubClass = exports.SubClient = void 0;
class SubClient {
    main;
    requestManager;
    downloadManager;
    toJSON() { return {}; }
    constructor(client) {
        this.main = client;
        this.requestManager = client.requestManager;
        this.downloadManager = client.downloadManager;
    }
}
exports.SubClient = SubClient;
class BaseSubClass {
    client;
    main;
    toJSON() { return {}; }
    constructor(subClient) {
        this.client = subClient;
        this.main = subClient.main;
    }
}
exports.BaseSubClass = BaseSubClass;
class BaseManager extends BaseSubClass {
    requestManager;
    downloadManager;
    log(message) {
        return this.main.log('Resource Manager', message);
    }
    generateURL(input, query) {
        const inputURL = new URL(input);
        const { searchParams } = inputURL;
        if (query) {
            for (const queryKey in query) {
                searchParams.set(queryKey, query[queryKey]);
            }
        }
        return inputURL;
    }
    request;
    toJSON() { return {}; }
    constructor(subClient) {
        const { main } = subClient;
        super(subClient);
        this.request = main.requestManager.request.bind(main.requestManager);
        this.requestManager = main.requestManager;
        this.downloadManager = main.downloadManager;
    }
}
exports.BaseManager = BaseManager;
class BaseResource extends BaseSubClass {
    _rawData;
    _lazyData;
    _lazyGet(name, callback) {
        const { _lazyData, _rawData } = this;
        if (!(name in _lazyData)) {
            const result = callback(_rawData);
            _lazyData[name] = result;
        }
        return _lazyData[name];
    }
    toJSON() {
        let proto = Object.getPrototypeOf(this);
        let descriptors = [];
        while (proto) {
            descriptors = { ...Object.getOwnPropertyDescriptors(proto), ...descriptors };
            proto = Object.getPrototypeOf(proto);
        }
        const obj = {};
        for (const descriptorKey in descriptors) {
            const descriptor = descriptors[descriptorKey];
            if (typeof (descriptor.get) === 'function') {
                obj[descriptorKey] = this[descriptorKey];
                if (typeof (obj[descriptorKey]?.toJSON) === 'function') {
                    obj[descriptorKey] = obj[descriptorKey].toJSON();
                }
            }
        }
        return obj;
    }
    constructor(client, rawData) {
        super(client);
        this._rawData = rawData;
        this._lazyData = {};
    }
}
exports.BaseResource = BaseResource;

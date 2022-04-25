"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseClass = void 0;
class BaseClass {
    client;
    toJSON() { return {}; }
    constructor(client) {
        this.client = client;
    }
}
exports.BaseClass = BaseClass;

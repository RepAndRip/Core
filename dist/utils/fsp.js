"use strict";
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
var FSP;
(function (FSP) {
    async function mkdir(path, options) {
        return new Promise((resolve, reject) => {
            fs_1.default.mkdir(path, options, (error) => error ? reject(error) : resolve());
        });
    }
    FSP.mkdir = mkdir;
    async function lstat(path) {
        return new Promise((resolve, reject) => {
            fs_1.default.lstat(path, (error, stats) => error ? reject(error) : resolve(stats));
        });
    }
    FSP.lstat = lstat;
    async function unlink(path) {
        return new Promise((resolve, reject) => {
            fs_1.default.unlink(path, (error) => error ? reject(error) : resolve());
        });
    }
    FSP.unlink = unlink;
    async function utimes(path, aTime, mTime) {
        return new Promise((resolve, reject) => {
            fs_1.default.utimes(path, aTime, mTime, (error) => error ? reject(error) : resolve());
        });
    }
    FSP.utimes = utimes;
})(FSP || (FSP = {}));
module.exports = FSP;

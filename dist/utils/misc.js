"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.watchForProgress = exports.waitUntil = exports.sleep = exports.cloneObject = exports.formatTime = exports.humanFileSize = exports.generateRandomHex = void 0;
const crypto_1 = require("crypto");
const generateRandomHex = () => (0, crypto_1.randomBytes)(16).toString('hex');
exports.generateRandomHex = generateRandomHex;
const humanFileSize = (size) => {
    if (size === 0) {
        return '0B';
    }
    const i = Math.floor(Math.log(size) / Math.log(1024));
    return (size / Math.pow(1024, i)).toFixed(2) + ['B', 'KB', 'MB', 'GB', 'TB'][i];
};
exports.humanFileSize = humanFileSize;
const formatTime = (seconds) => {
    let hours = 0;
    let minutes = 0;
    hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;
    return { hours, minutes, seconds };
};
exports.formatTime = formatTime;
const cloneObject = (obj) => JSON.parse(JSON.stringify(obj));
exports.cloneObject = cloneObject;
const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));
exports.sleep = sleep;
const waitUntil = (time) => (0, exports.sleep)(time - Date.now());
exports.waitUntil = waitUntil;
exports.watchForProgress = require('request-progress');

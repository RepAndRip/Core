export declare const generateRandomHex: () => string;
export declare const humanFileSize: (size: number) => string;
export declare const formatTime: (seconds: number) => {
    hours: number;
    minutes: number;
    seconds: number;
};
export declare const cloneObject: <T>(obj: T) => T;
export declare const sleep: (time: number) => Promise<void>;
export declare const waitUntil: (time: number) => Promise<void>;
export declare const watchForProgress: any;

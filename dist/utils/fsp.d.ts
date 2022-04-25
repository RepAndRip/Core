/// <reference types="node" />
import FS from 'fs';
declare module FSP {
    function mkdir(path: FS.PathLike, options?: FS.MakeDirectoryOptions): Promise<void>;
    function lstat(path: FS.PathLike): Promise<FS.Stats>;
    function unlink(path: FS.PathLike): Promise<void>;
    function utimes(path: FS.PathLike, aTime: Date, mTime: Date): Promise<void>;
}
export = FSP;

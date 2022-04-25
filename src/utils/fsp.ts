import FS from 'fs'

module FSP {
  export async function mkdir (path: FS.PathLike, options?: FS.MakeDirectoryOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      FS.mkdir(path, options, (error) => error ? reject(error) : resolve())
    })
  }

  export async function lstat (path: FS.PathLike): Promise<FS.Stats> {
    return new Promise((resolve, reject) => {
      FS.lstat(path, (error, stats) => error ? reject(error) : resolve(stats))
    })
  }

  export async function unlink (path: FS.PathLike): Promise<void> {
    return new Promise((resolve, reject) => {
      FS.unlink(path, (error) => error ? reject(error) : resolve())
    })
  }

  export async function utimes (path: FS.PathLike, aTime: Date, mTime: Date): Promise<void> {
    return new Promise((resolve, reject) => {
      FS.utimes(path, aTime, mTime, (error) => error ? reject(error) : resolve())
    })
  }
}

export = FSP

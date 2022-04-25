import { randomBytes } from 'crypto'

export const generateRandomHex = () => randomBytes(16).toString('hex')

export const humanFileSize = (size: number) => {
  if (size === 0) {
    return '0B'
  }

  const i = Math.floor(Math.log(size) / Math.log(1024))
  return (size / Math.pow(1024, i)).toFixed(2) + ['B', 'KB', 'MB', 'GB', 'TB'][i]
}

export const formatTime = (seconds: number) => {
  let hours: number = 0
  let minutes: number = 0

  hours = Math.floor(seconds / 3600)
  seconds -= hours * 3600

  minutes = Math.floor(seconds / 60)
  seconds -= minutes * 60

  return { hours, minutes, seconds }
}

export const cloneObject = <T> (obj: T): T => JSON.parse(JSON.stringify(obj))

export const sleep = (time: number) => new Promise<void>((resolve) => setTimeout(resolve, time))

export const waitUntil = (time: number) => sleep(time - Date.now())

export const watchForProgress = require('request-progress')

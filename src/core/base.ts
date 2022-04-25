import { Client } from './client'

export class BaseClass {
  public readonly client: Client

  public toJSON () { return {} }

  public constructor (client: Client) {
    this.client = client
  }
}

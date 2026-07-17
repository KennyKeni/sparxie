export class ValedictorianHttpError<Body = unknown> extends Error {
  readonly status: number
  readonly body: Body

  constructor({ body, message, status }: { body: Body; message: string; status: number }) {
    super(message)
    this.name = 'ValedictorianHttpError'
    this.status = status
    this.body = body
  }
}

export class Position {
  constructor(
    public readonly offset: number,
    public readonly line: number,
    public readonly column: number,
    public readonly filename?: string
  ) {}

  get isValid() {
    return this.line > 0
  }

  toString() {
    let s = this.filename || ''
    if (this.isValid) {
      if (s) s += ':'
      s += this.line
      if (this.column) s += `:${this.column}`
    } else {
      s += '<none>'
    }

    return s || '-'
  }
}

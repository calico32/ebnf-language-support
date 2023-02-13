import { Position } from './position.js'

export class FileSet {
  files: File[] = []
  last?: File
  base = 1

  addFile(name: string, base: number, size: number) {
    if (base < 0) base = this.base
    if (base < this.base) {
      throw new Error('Cannot add file with base < current base')
    }
    if (size < 0) {
      throw new Error('Cannot add file with negative size')
    }

    const f = new File(this, name, base, size, [0])
    base += size + 1
    this.base = base
    this.files.push(f)
    this.last = f
    return f
  }

  position(pos: number): Position {
    if (pos < 0) {
      return new Position(0, 0, 0)
    }

    for (const f of this.files) {
      if (f.base <= pos && pos <= f.base + f.size) {
        return f.position(pos)
      }
    }

    return new Position(0, 1, 1, '<unknown>')
  }
}

export class File {
  constructor(
    public readonly set: FileSet,
    public readonly name: string,
    public readonly base: number,
    public readonly size: number,
    public lines: number[]
  ) {}

  pos(offset: number) {
    if (offset > this.size) {
      throw new Error('Offset is out of bounds')
    }

    return this.base + offset
  }

  offset(pos: number) {
    if (pos < this.base || pos > this.base + this.size) {
      throw new Error('Position is out of bounds')
    }

    return pos - this.base
  }

  setLnesForContent(content: string) {
    let lines: number[] = []
    let line = 0
    for (const [offset, char] of [...content].entries()) {
      if (line >= 0) {
        lines.push(line)
      }
      line = -1
      if (char === '\n') {
        line = offset + 1
      }
    }

    this.lines = lines
  }

  addLine(offset: number) {
    const lineCount = this.lines.length

    if (offset > this.size) {
      throw new Error('Offset is out of bounds')
    }

    if (lineCount !== 0 && offset <= this.lines[lineCount - 1]) {
      throw new Error('Cannot add line before last line')
    }

    this.lines.push(offset)
  }

  position(pos: number): Position {
    const offset = pos - this.base

    const i = searchInts(this.lines, offset)

    if (i < 0) {
      return new Position(offset, 0, 0, this.name)
    }

    const line = i + 1
    const column = offset - this.lines[i] + 1

    return new Position(offset, line, column, this.name)
  }
}

function searchInts(a: number[], x: number): number {
  // This function body is a manually inlined version of:
  // return sort.Search(len(a), func(i int) bool { return a[i] > x }) - 1

  let i = 0
  let j = a.length
  while (i < j) {
    const h = ((i + j) / 2) | 0 // avoid overflow when computing h
    // i ≤ h < j
    if (a[h] <= x) {
      i = h + 1
    } else {
      j = h
    }
  }
  return i - 1
}

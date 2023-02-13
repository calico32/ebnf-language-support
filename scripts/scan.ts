import * as fs from 'node:fs/promises'
import { FileSet } from '../language/file.js'
import { Scanner } from '../language/scanner.js'
import { toString } from '../language/token.js'

if (process.argv.length !== 4) {
  console.error('Usage: node scan.js <file>')
  process.exit(1)
}

const file = process.argv[3]
const fileContents = await fs.readFile(file, 'utf8')

const fset = new FileSet()
const f = fset.addFile(file, -1, fileContents.length)

const scanner = new Scanner(f, fileContents)

while (scanner.peek() !== '\0') {
  const [pos, tok, lit] = scanner.scan()
  console.log(`${f.position(pos)}\t| ${toString(tok).padEnd(15)}| ${lit}`)
}

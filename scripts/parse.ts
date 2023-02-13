import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { inspect } from 'node:util'
import { FileSet } from '../language/file.js'
import { Parser } from '../language/parser.js'

if (process.argv.length !== 3) {
  console.error('Usage: node parse.js <file>')
  process.exit(1)
}

const file = process.argv[2]
const fileContents = await fs.readFile(file, 'utf8')

const fset = new FileSet()
const parser = new Parser(fset, path.basename(file), fileContents)
const ast = parser.parseGrammar()
console.log(inspect(ast, { depth: null, colors: true }))

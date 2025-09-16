import { test } from 'bun:test'
import { readFileSync } from 'node:fs'
import * as ast from '../language/ast'
import { FileSet } from '../language/file'
import { Parser } from '../language/parser'
import { ebnfGrammar } from './ebnf-grammar'
import { type Matcher } from './matchers'

const parseTests = [
  ['ebnf.ebnf', readFileSync('ebnf.ebnf', 'utf8'), ebnfGrammar],
  [
    'ebnf-no-commas.ebnf',
    readFileSync('test/ebnf-no-commas.ebnf', 'utf8'),
    ebnfGrammar,
  ],
] as [string, string, Matcher<ast.Grammar>][]

function parse(input: string): ast.Grammar {
  const fset = new FileSet()
  const parser = new Parser(fset, 'test.ebnf', input)
  return parser.parseGrammar()
}

for (let [label, input, matcher] of parseTests) {
  label ||= input
  test(`parses ${label}`, () => {
    matcher(parse(input))
  })
}

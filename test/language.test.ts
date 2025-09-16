import { test } from 'bun:test'
import { readFileSync } from 'node:fs'
import * as ast from '../language/ast'
import { FileSet } from '../language/file'
import { Parser } from '../language/parser'
import { ebnfGrammar } from './ebnf-grammar'
import {
  concatenation,
  except,
  grammar,
  ident,
  oneOrMoreMinus,
  oneOrMorePlus,
  repetition,
  rule,
  type Matcher,
} from './matchers'

const parseTests = [
  ['ebnf.ebnf', readFileSync('ebnf.ebnf', 'utf8'), ebnfGrammar],
  [
    'ebnf-no-commas.ebnf',
    readFileSync('test/ebnf-no-commas.ebnf', 'utf8'),
    ebnfGrammar,
  ],
  [
    '',
    'foo = { bar } - baz ;',
    grammar([rule('foo', except(repetition(ident('bar')), ident('baz')))]),
  ],
  [
    '',
    'foo = { bar }- ;',
    grammar([rule('foo', oneOrMoreMinus(repetition(ident('bar'))))]),
  ],
  [
    '',
    'foo = { bar }-, baz ;',
    grammar([
      rule(
        'foo',
        concatenation(oneOrMoreMinus(repetition(ident('bar'))), ident('baz'))
      ),
    ]),
  ],
  [
    '',
    'foo = {bar}+ ;',
    grammar([rule('foo', oneOrMorePlus(repetition(ident('bar'))))]),
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

import { test } from 'bun:test'
import { readFileSync } from 'node:fs'
import * as ast from '../language/ast'
import { FileSet } from '../language/file'
import { Parser } from '../language/parser'
import {
  $many,
  alternation,
  concatenation,
  except,
  grammar,
  group,
  ident,
  type Matcher,
  optional,
  range,
  repetition,
  rule,
  special,
  string,
} from './matchers'

const ebnfGrammar = grammar([
  rule('grammar', repetition(alternation(ident('comment'), ident('rule')))),
  rule(
    'comment',
    $many(concatenation, [
      string('(*'),
      except(special('? any string ?'), string('*)')),
      string('*)'),
    ])
  ),
  rule(
    'rule',
    $many(concatenation, [
      ident('name'),
      string('='),
      ident('expression'),
      string(';'),
    ])
  ),
  rule(
    'name',
    concatenation(
      ident('name_start_character'),
      repetition(ident('name_character'))
    )
  ),
  rule(
    'name_start_character',
    $many(alternation, [ident('letter'), ident('digit'), string('_')])
  ),
  rule(
    'name_character',
    alternation(ident('name_start_character'), string('-'))
  ),
  rule(
    'letter',
    alternation(
      range(string('a'), string('z')),
      range(string('A'), string('Z'))
    )
  ),
  rule('digit', range(string('0'), string('9'))),
  rule(
    'expression',
    $many(alternation, [
      ident('name'),
      ident('literal'),
      ident('special'),
      ident('group'),
      ident('repetition'),
      ident('alternation'),
      ident('concatenation'),
      ident('optional'),
      ident('range'),
    ])
  ),
  rule(
    'literal',
    alternation(
      group(
        $many(concatenation, [
          string('"'),
          except(special('? any string ?'), string('"')),
          string('"'),
        ])
      ),
      group(
        $many(concatenation, [
          string("'"),
          except(special('? any string ?'), string("'")),
          string("'"),
        ])
      )
    )
  ),
  rule(
    'special',
    $many(concatenation, [
      string('?'),
      except(special('? any string ?'), string('?')),
      string('?'),
    ])
  ),
  rule(
    'group',
    $many(concatenation, [string('('), ident('expression'), string(')')])
  ),
  rule(
    'repetition',
    $many(concatenation, [string('{'), ident('expression'), string('}')])
  ),
  rule(
    'alternation',
    $many(concatenation, [
      ident('expression'),
      string('|'),
      ident('expression'),
    ])
  ),
  rule(
    'concatenation',
    $many(concatenation, [
      ident('expression'),
      optional(string(',')),
      ident('expression'),
    ])
  ),
  rule(
    'optional',
    $many(concatenation, [string('['), ident('expression'), string(']')])
  ),
  rule(
    'range',
    $many(concatenation, [ident('literal'), string('..'), ident('literal')])
  ),
])

const parseTests = [
  [readFileSync('ebnf.ebnf', 'utf8'), ebnfGrammar],
  [readFileSync('test/ebnf-no-commas.ebnf', 'utf8'), ebnfGrammar],
] as [string, Matcher<ast.Grammar>][]

function parse(input: string): ast.Grammar {
  const fset = new FileSet()
  const parser = new Parser(fset, 'test.ebnf', input)
  return parser.parseGrammar()
}

test.each(parseTests)('parses %s', (input, matcher) => {
  matcher(parse(input))
})

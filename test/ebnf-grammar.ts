import {
  $many,
  alternation,
  concatenation,
  except,
  grammar,
  group,
  ident,
  optional,
  range,
  repetition,
  rule,
  special,
  string,
} from './matchers'

export const ebnfGrammar = grammar([
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
      ident('name-start-character'),
      repetition(ident('name-character'))
    )
  ),
  rule(
    'name-start-character',
    $many(alternation, [ident('letter'), ident('digit'), string('_')])
  ),
  rule(
    'name-character',
    alternation(ident('name-start-character'), string('-'))
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
      ident('optional'),
      ident('alternation'),
      ident('concatenation'),
      ident('range'),
      ident('except'),
      ident('one-or-more'),
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
    'optional',
    $many(concatenation, [string('['), ident('expression'), string(']')])
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
    'range',
    $many(concatenation, [
      ident('expression'),
      string('..'),
      ident('expression'),
    ])
  ),
  rule(
    'except',
    $many(concatenation, [
      ident('expression'),
      string('-'),
      ident('expression'),
    ])
  ),
  rule(
    'one-or-more',
    alternation(
      group(concatenation(ident('expression'), string('+'))),
      group(concatenation(ident('expression'), string('-')))
    )
  ),
])

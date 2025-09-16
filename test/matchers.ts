import { expect } from 'bun:test'
import * as ast from '../language/ast'
import * as token from '../language/token'

const internal = Symbol('internal')
export function $serialize(value: any): any | undefined {
  if (internal in value) {
    return value[internal]
  }
  return undefined
}

export type Matcher<T = ast.Expr> = (value: T) => void
type ArrayAtLeast<
  T,
  MinLength extends number,
  _A extends T[] = []
> = _A['length'] extends MinLength
  ? [..._A, ...T[]]
  : ArrayAtLeast<T, MinLength, [..._A, T]>

export function $many(
  factory: (left: Matcher, right: Matcher) => Matcher,
  values: ArrayAtLeast<Matcher, 2>
): Matcher {
  let m: Matcher<any> = values[0]
  for (let i = 1; i < values.length; i++) {
    m = factory(m, values[i])
  }
  return m
}

export function grammar(
  ruleMatchers: Matcher<ast.Rule>[]
): Matcher<ast.Grammar> {
  const f = (grammar: ast.Grammar) => {
    expect(grammar).toBeInstanceOf(ast.Grammar)
    let unmatchedRules = grammar.rules.size
    for (const ruleMatcher of ruleMatchers) {
      const rule = grammar.rules.get($serialize(ruleMatcher).name)
      if (!rule) {
        expect().fail(`rule ${$serialize(ruleMatcher).name} not found`)
      } else {
        ruleMatcher(rule)
        unmatchedRules--
      }
    }

    expect(unmatchedRules, 'unmatched rules').toBe(0)
  }
  Object.defineProperty(f, 'name', { value: `matchGrammar` })
  Object.defineProperty(f, internal, {
    value: { type: 'grammar', rules: ruleMatchers.map($serialize) },
  })
  return f
}

export function rule(name: string, valueMatcher: Matcher): Matcher<ast.Rule> {
  const f = (rule: ast.Rule) => {
    expect(rule).toBeInstanceOf(ast.Rule)
    expect(rule.name.name).toBe(name)
    valueMatcher(rule.value)
  }
  Object.defineProperty(f, 'name', { value: `matchRule(name="${name}")` })
  Object.defineProperty(f, internal, {
    value: { type: 'rule', name, value: $serialize(valueMatcher) },
  })
  return f
}

export function group(exprMatcher: Matcher): Matcher {
  const f = (group: ast.Expr) => {
    expect(group).toBeInstanceOf(ast.Group)
    exprMatcher((group as ast.Group).expr)
  }
  Object.defineProperty(f, 'name', { value: 'matchGroup' })
  Object.defineProperty(f, internal, {
    value: { type: 'group', expr: $serialize(exprMatcher) },
  })
  return f
}

export function ident(name: string): Matcher {
  const f = (expr: ast.Expr) => {
    expect(expr).toBeInstanceOf(ast.Ident)
    expect((expr as ast.Ident).name).toBe(name)
  }
  Object.defineProperty(f, 'name', { value: `matchIdent(name="${name}")` })
  Object.defineProperty(f, internal, {
    value: { type: 'ident', name },
  })
  return f
}

export function string(value: string): Matcher {
  const f = (expr: ast.Expr) => {
    expect(expr).toBeInstanceOf(ast.String)
    expect((expr as ast.String).value.slice(1, -1)).toBe(value)
  }
  Object.defineProperty(f, 'name', { value: `matchString(value="${value}")` })
  Object.defineProperty(f, internal, {
    value: { type: 'string', value },
  })
  return f
}

export function special(value: string): Matcher {
  const f = (expr: ast.Expr) => {
    expect(expr).toBeInstanceOf(ast.Special)
    expect((expr as ast.Special).value).toBe(value)
  }
  Object.defineProperty(f, 'name', { value: `matchSpecial(value="${value}")` })
  Object.defineProperty(f, internal, {
    value: { type: 'special', value },
  })
  return f
}

export function repetition(exprMatcher: Matcher): Matcher {
  const f = (expr: ast.Expr) => {
    expect(expr).toBeInstanceOf(ast.Repitition)
    exprMatcher((expr as ast.Repitition).expr)
  }
  Object.defineProperty(f, 'name', { value: 'matchRepetition' })
  Object.defineProperty(f, internal, {
    value: { type: 'repetition', expr: $serialize(exprMatcher) },
  })
  return f
}

export function optional(exprMatcher: Matcher): Matcher {
  const f = (expr: ast.Expr) => {
    expect(expr).toBeInstanceOf(ast.Optional)
    exprMatcher((expr as ast.Optional).expr)
  }
  Object.defineProperty(f, 'name', { value: 'matchOptional' })
  Object.defineProperty(f, internal, {
    value: { type: 'optional', expr: $serialize(exprMatcher) },
  })
  return f
}

export function binaryExpr(
  op: token.Token,
  leftMatcher: Matcher,
  rightMatcher: Matcher
): Matcher {
  const f = (expr: ast.Expr) => {
    expect(expr).toBeInstanceOf(ast.BinaryExpr)
    expect((expr as ast.BinaryExpr).op).toBe(op)
    leftMatcher((expr as ast.BinaryExpr).left)
    rightMatcher((expr as ast.BinaryExpr).right)
  }
  Object.defineProperty(f, 'name', {
    value: `matchBinaryExpr(op="${token.toString(op)}")`,
    writable: true,
  })
  Object.defineProperty(f, internal, {
    value: {
      type: 'binaryExpr',
      op,
      left: $serialize(leftMatcher),
      right: $serialize(rightMatcher),
    },
    writable: true,
  })
  return f
}

export function concatenation(
  leftMatcher: Matcher,
  rightMatcher: Matcher
): Matcher {
  const f = binaryExpr(token.Token.Concatenate, leftMatcher, rightMatcher)
  Object.defineProperty(f, 'name', { value: 'matchConcatenation' })
  Object.defineProperty(f, internal, {
    value: {
      type: 'concatenation',
      left: $serialize(leftMatcher),
      right: $serialize(rightMatcher),
    },
    writable: false,
  })
  return f
}

export function alternation(
  leftMatcher: Matcher,
  rightMatcher: Matcher
): Matcher {
  const f = binaryExpr(token.Token.Alternate, leftMatcher, rightMatcher)
  Object.defineProperty(f, 'name', { value: 'matchAlternation' })
  Object.defineProperty(f, internal, {
    value: {
      type: 'alternation',
      left: $serialize(leftMatcher),
      right: $serialize(rightMatcher),
    },
    writable: false,
  })
  return f
}

export function range(leftMatcher: Matcher, rightMatcher: Matcher): Matcher {
  const f = binaryExpr(token.Token.Range, leftMatcher, rightMatcher)
  Object.defineProperty(f, 'name', { value: 'matchRange' })
  Object.defineProperty(f, internal, {
    value: {
      type: 'range',
      left: $serialize(leftMatcher),
      right: $serialize(rightMatcher),
    },
    writable: false,
  })
  return f
}

export function except(leftMatcher: Matcher, rightMatcher: Matcher): Matcher {
  const f = binaryExpr(token.Token.Except, leftMatcher, rightMatcher)
  Object.defineProperty(f, 'name', { value: 'matchExcept' })
  Object.defineProperty(f, internal, {
    value: {
      type: 'except',
      left: $serialize(leftMatcher),
      right: $serialize(rightMatcher),
    },
    writable: false,
  })
  return f
}

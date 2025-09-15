import { Token, toString } from './token.js'

export class Node {
  constructor(public readonly pos: number, public readonly end: number) {}

  get children(): Node[] {
    return []
  }
}

export class Expr extends Node {}

export class BadExpr extends Expr {
  constructor(pos: number) {
    super(pos, pos)
  }
}

export class Ident extends Expr {
  constructor(pos: number, public readonly name: string) {
    super(pos, pos + name.length)
  }
}

export class String extends Expr {
  constructor(pos: number, public readonly value: string) {
    super(pos, pos + value.length)
  }
}

export class Special extends Expr {
  constructor(pos: number, public readonly value: string) {
    super(pos, pos + value.length)
  }
}

export class Rule extends Node {
  constructor(
    pos: number,
    public readonly name: Ident,
    public readonly equals: number,
    public readonly value: Expr
  ) {
    super(pos, value.end)
  }

  get children(): Expr[] {
    return [this.name, this.value]
  }
}

export class Group extends Expr {
  constructor(pos: number, public readonly expr: Expr, end: number) {
    super(pos, end)
  }

  get children(): Expr[] {
    return [this.expr]
  }
}

export class Repitition extends Expr {
  constructor(pos: number, public readonly expr: Expr, end: number) {
    super(pos, end)
  }

  get children(): Expr[] {
    return [this.expr]
  }
}

export class Optional extends Expr {
  constructor(pos: number, public readonly expr: Expr, end: number) {
    super(pos, end)
  }

  get children(): Expr[] {
    return [this.expr]
  }
}

export class BinaryExpr extends Expr {
  constructor(
    pos: number,
    public readonly left: Expr,
    public readonly op: Token,
    public readonly opPos: number,
    public readonly right: Expr
  ) {
    super(pos, right.end)
  }

  get children(): Expr[] {
    return [this.left, this.right]
  }
}

export class Grammar extends Node {
  readonly rules: Map<string, Rule> = new Map()

  constructor(pos: number, rules: Rule[]) {
    super(pos, rules[rules.length - 1].end)
    for (const rule of rules) {
      this.rules.set(rule.name.name, rule)
    }
  }

  get children(): Rule[] {
    return [...this.rules.values()]
  }
}

export const stringify = (node: Node): string => {
  if (node instanceof BadExpr) {
    return '??'
  }

  if (node instanceof Ident) {
    return node.name
  }

  if (node instanceof String) {
    return node.value
  }

  if (node instanceof Special) {
    return node.value
  }

  if (node instanceof Rule) {
    return `${stringify(node.name)} = ${stringify(node.value)} ;`
  }

  if (node instanceof Group) {
    return `( ${stringify(node.expr)} )`
  }

  if (node instanceof Repitition) {
    return `{ ${stringify(node.expr)} }`
  }

  if (node instanceof Optional) {
    return `[ ${stringify(node.expr)} ]`
  }

  if (node instanceof BinaryExpr) {
    if (node.op === Token.Concatenate) {
      return `${stringify(node.left)}, ${stringify(node.right)}`
    }
    return `${stringify(node.left)} ${toString(node.op)} ${stringify(
      node.right
    )}`
  }

  if (node instanceof Grammar) {
    return node.children.map(stringify).join('\n')
  }

  throw new Error(`unknown node type: ${node}`)
}

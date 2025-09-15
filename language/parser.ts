import * as ast from './ast.js'
import { File, FileSet } from './file.js'
import { Scanner } from './scanner.js'
import {
  Token,
  isLiteral,
  isOperator,
  lowestPrecedence,
  precedenceOf,
  toString,
} from './token.js'

const doTrace = false

// trace decorator
function trace(msg: string): MethodDecorator {
  return (target: Object, key: PropertyKey, descriptor: PropertyDescriptor) => {
    if (!doTrace) return descriptor

    const original = descriptor.value
    descriptor.value = function (this: Parser, ...args: any[]) {
      this.trace(msg)
      const result = original.apply(this, args)
      this.untrace()
      return result
    }

    return descriptor
  }
}

export type ParserError = {
  pos: number
  msg: string
}

export class Parser {
  indent: number = 0

  pos!: number
  tok!: Token
  lit!: string

  file: File

  scanner: Scanner

  errors: ParserError[] = []

  constructor(fset: FileSet, filename: string, src: string) {
    this.file = fset.addFile(filename, -1, src.length)
    this.scanner = new Scanner(this.file, src)
    this.next()
  }

  _next() {
    if (doTrace && this.tok) {
      const s = toString(this.tok)

      if (isLiteral(this.tok)) {
        this.printTrace(s, this.lit)
      } else if (isOperator(this.tok)) {
        this.printTrace(`'${s}'`)
      } else {
        this.printTrace(s)
      }
    }

    try {
      const [pos, tok, lit] = this.scanner.scan()
      this.pos = pos
      this.tok = tok
      this.lit = lit
    } catch (err) {
      if (err instanceof Error) {
        this.error(this.scanner.offset, err.message)
      } else {
        this.error(this.scanner.offset, String(err))
      }
      this.next()
    }
  }

  error(pos: number, msg: string) {
    this.errors.push({ pos, msg })
  }

  next() {
    this._next()
    while (this.tok === Token.Comment) {
      this._next()
    }
  }

  printTrace(...a: any[]) {
    const dots =
      '. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . '
    const n = dots.length
    const pos = this.file.position(this.pos)
    let line = `${pos.line}:${pos.column}: `.padEnd(12)
    let i = 2 * this.indent
    while (i > n) {
      line += dots
      i -= n
    }
    line += dots.slice(0, i)
    console.debug(line, ...a)
  }

  trace(message: string) {
    this.printTrace(message, '(')
    this.indent++
  }

  untrace() {
    this.indent--
    this.printTrace(')')
  }

  expect(tok: Token): [pos: number, ok: boolean] {
    const pos = this.pos
    const ok = this.tok === tok
    if (!ok) {
      this.error(pos, `expected ${toString(tok)}, got ${toString(this.tok)}`)
    }
    this.next()
    return [pos, ok]
  }

  @trace('Rule')
  parseRule(): ast.Rule {
    const name = this.parseIdent()
    const [equals] = this.expect(Token.Assign)
    const expr = this.parseExpr()
    const [semi, ok] = this.expect(Token.Semi)
    if (!ok) {
      // just read until the next semicolon
      while (this.tok !== Token.Semi && this.tok !== Token.EOF) {
        this.next()
      }

      // if we found a semicolon, consume it
      if (this.tok === Token.Semi) {
        this.next()
      }
    }

    return new ast.Rule(name.pos, name, equals, expr)
  }

  @trace('Expr')
  parseExpr(): ast.Expr {
    return this.parseBinaryExpr(lowestPrecedence + 1)
  }

  @trace('BinaryExpr')
  parseBinaryExpr(precedence: number, x?: ast.Expr): ast.Expr {
    if (!x) {
      x = this.parseOperand()
    }

    while (true) {
      let operator = this.tok
      let opPos: number | undefined
      let y: ast.Expr
      if (!isOperator(operator)) {
        switch (operator) {
          case Token.Ident:
          case Token.String:
          case Token.Special:
          case Token.LParen:
          case Token.LBrace:
          case Token.LBracket:
            // potential start of a new expression
            // try parsing as implicit concatenation
            operator = Token.Concatenate
            opPos = -1
            break
          default:
            // fallback to regular binary expression
            break
        }
      }

      const opPrecedence = precedenceOf(operator)
      if (opPrecedence < precedence) {
        return x
      }
      if (!opPos) {
        ;[opPos] = this.expect(operator)
      }
      y = this.parseBinaryExpr(opPrecedence + 1)

      x = new ast.BinaryExpr(x.pos, x, operator, opPos, y)
    }
  }

  @trace('Operand')
  parseOperand(): ast.Expr {
    switch (this.tok) {
      case Token.Ident:
        return this.parseIdent()
      case Token.String:
        return this.parseString()
      case Token.Special:
        return this.parseSpecial()
      case Token.LParen:
        return this.parseGroup()
      case Token.LBrace:
        return this.parseRepitition()
      case Token.LBracket:
        return this.parseOptional()
      default:
        this.error(this.pos, `unexpected token: ${toString(this.tok)}`)
        this.next()
        return new ast.BadExpr(this.pos)
    }
  }

  @trace('Ident')
  parseIdent(): ast.Ident {
    const name = this.lit
    const [pos] = this.expect(Token.Ident)
    return new ast.Ident(pos, name)
  }

  @trace('String')
  parseString(): ast.String {
    const value = this.lit
    const [pos] = this.expect(Token.String)
    return new ast.String(pos + 1, value)
  }

  @trace('Special')
  parseSpecial(): ast.Special {
    const value = this.lit
    const [pos] = this.expect(Token.Special)
    return new ast.Special(pos + 1, value)
  }

  @trace('Group')
  parseGroup(): ast.Group {
    const [lparen] = this.expect(Token.LParen)
    const expr = this.parseExpr()
    const [rparen] = this.expect(Token.RParen)
    return new ast.Group(lparen, expr, rparen)
  }

  @trace('Repitition')
  parseRepitition(): ast.Repitition {
    const [lbrace] = this.expect(Token.LBrace)
    const expr = this.parseExpr()
    const [rbrace] = this.expect(Token.RBrace)
    return new ast.Repitition(lbrace, expr, rbrace)
  }

  @trace('Optional')
  parseOptional(): ast.Optional {
    const [lbracket] = this.expect(Token.LBracket)
    const expr = this.parseExpr()
    const [rbracket] = this.expect(Token.RBracket)
    return new ast.Optional(lbracket, expr, rbracket)
  }

  @trace('Grammar')
  parseGrammar(): ast.Grammar {
    const rules: ast.Rule[] = []
    const names = new Set<string>()
    while (this.tok !== Token.EOF) {
      const rule = this.parseRule()

      if (rule) {
        if (names.has(rule.name.name)) {
          this.error(rule.name.pos, `duplicate rule name: ${rule.name.name}`)
          this.error(
            rules.find((r) => r.name.name === rule.name.name)!.name.pos,
            `duplicate rule name: ${rule.name.name}`
          )
        }

        names.add(rule.name.name)
        rules.push(rule)
      } else {
        break
      }
    }

    return new ast.Grammar(0, rules)
  }
}

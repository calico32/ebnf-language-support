import { File } from './file.js'
import { Token } from './token.js'

type TokenTree = {
  // @ts-ignore
  0?: Token
  [key: string]: Token | TokenTree
}

function tokens(tokens: Omit<TokenTree, 0>): TokenTree
function tokens(self: Token, tokens: Omit<TokenTree, 0>): TokenTree
function tokens(
  selfOrTokens: Token | Omit<TokenTree, 0>,
  tokens: Omit<TokenTree, 0> = {}
): TokenTree {
  const self = typeof selfOrTokens === 'number' ? selfOrTokens : Token.Illegal
  const result = {
    ...(typeof selfOrTokens === 'object' ? selfOrTokens : tokens),
  }

  if (self !== Token.Illegal) {
    result[0] = self
  }

  return result
}

const tokenTree = tokens({
  ';': Token.Semi,
  '=': Token.Assign,
  '|': Token.Alternate,
  '-': Token.Except,
  '+': Token.OneOrMore,
  '.': tokens({
    '.': Token.Range,
  }),
  ',': Token.Concatenate,
  '{': Token.LBrace,
  '}': Token.RBrace,
  '(': Token.LParen,
  ')': Token.RParen,
  '[': Token.LBracket,
  ']': Token.RBracket,
})

const EOF = '\0'
const BOM = '\uFEFF'

export class Scanner {
  ch: string = ' '
  readOffset = 0
  lineOffset = 0
  offset = 0
  src: string
  file: File

  next() {
    if (this.readOffset >= this.src.length) {
      this.offset = this.src.length
      if (this.ch === '\n') {
        this.lineOffset = this.offset
        this.file.addLine(this.offset)
      }
      this.ch = EOF
      return
    }

    this.offset = this.readOffset
    if (this.ch === '\n') {
      this.lineOffset = this.offset
      this.file.addLine(this.offset)
    }
    const char = this.src.charAt(this.readOffset)
    this.readOffset += char.length
    this.ch = char
  }

  peek() {
    if (this.readOffset >= this.src.length) {
      return '\0'
    }
    return this.src.charAt(this.readOffset)
  }

  constructor(file: File, src: string) {
    if (file.size !== src.length) {
      throw new Error('file size does not match source length')
    }
    this.file = file
    this.src = src
    this.next()
    if (this.ch === BOM) {
      this.next()
    }
  }

  lookup(
    tokens: TokenTree,
    literal = ''
  ): [tok: Token, lit: string, ok: boolean] {
    const ch = this.ch
    literal += ch

    // check if it's in the table
    if (ch in tokens) {
      const next = tokens[ch]
      if (typeof next === 'number') {
        this.next()
        return [next, literal, true]
      } else {
        // the current sequence is a prefix of a token, consume the character and continue
        this.next()
        return this.lookup(next, literal)
      }
    }

    if (0 in tokens && typeof tokens[0] === 'number') {
      // everything we already consumed is a token
      return [tokens[0], literal.slice(0, -1), true]
    }

    // didn't find a token
    return [Token.Illegal, literal, false]
  }

  scanIdentifier(): string {
    let literal = ''
    while (/[a-zA-Z0-9_-]/.test(this.ch)) {
      literal += this.ch
      this.next()
    }
    return literal
  }

  scanComment(): [pos: number, tok: Token, lit: string] {
    let offset = this.offset
    this.next() // consume '('
    this.next() // consume '*'
    let closed = false
    while (this.ch !== EOF) {
      const ch = this.ch
      this.next()
      if (ch === '*' && this.ch === ')') {
        this.next()
        closed = true
        break
      }
    }

    if (!closed) {
      throw new Error('unterminated comment')
    }

    return [offset, Token.Comment, this.src.slice(offset, this.offset)]
  }

  skipWhitespace() {
    while (/\s/.test(this.ch)) {
      this.next()
    }
  }

  scanString(): [pos: number, tok: Token, lit: string] {
    let offset = this.offset
    let quote = this.ch
    this.next() // consume quote
    let closed = false
    while (this.ch !== EOF) {
      const ch = this.ch
      this.next()
      if (ch === quote) {
        closed = true
        break
      }
    }

    if (!closed) {
      throw new Error('unterminated string')
    }

    return [offset, Token.String, this.src.slice(offset, this.offset)]
  }

  scanSpecial(): [pos: number, tok: Token, lit: string] {
    let offset = this.offset
    this.next() // consume "?"
    let closed = false
    while (this.ch !== EOF) {
      const ch = this.ch
      this.next()
      if (ch === '?') {
        closed = true
        break
      }
    }

    if (!closed) {
      throw new Error('unterminated special')
    }

    return [offset, Token.Special, this.src.slice(offset, this.offset)]
  }

  scan(): [pos: number, tok: Token, lit: string] {
    this.skipWhitespace()
    const pos = this.file.pos(this.offset)

    if (/[a-zA-Z0-9_]/.test(this.ch)) {
      return [pos, Token.Ident, this.scanIdentifier()]
    }

    if (this.ch === '(' && this.peek() === '*') {
      return this.scanComment()
    }

    if (this.ch === '"' || this.ch === "'") {
      return this.scanString()
    }

    if (this.ch === '?') {
      return this.scanSpecial()
    }

    const [tok, lit, ok] = this.lookup(tokenTree)
    if (ok) {
      return [pos, tok, lit]
    }

    // always consume at least one character
    this.next()
    if (this.ch === EOF) {
      return [pos, Token.EOF, '']
    }
    return [pos, Token.Illegal, this.ch]
  }
}

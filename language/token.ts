export const enum Token {
  Illegal,
  EOF,
  Comment,

  expressionStart,
  Ident,
  String,
  Special,
  LBrace,
  LParen,
  LBracket,
  expressionEnd,

  RBrace,
  RParen,
  RBracket,

  operatorStart,
  Semi,
  Assign,
  Alternate,
  Except,
  Range,
  Concatenate,
  OneOrMore,
  operatorEnd,
}

export const toString = (token: Token): string => {
  const tokenNames: Partial<Record<Token, string>> = {
    [Token.Illegal]: '<ILLEGAL>',
    [Token.EOF]: '<EOF>',
    [Token.Ident]: '<IDENT>',
    [Token.Comment]: '<COMMENT>',
    [Token.String]: '<STRING>',
    [Token.Special]: '<SPECIAL>',
    [Token.Semi]: ';',
    [Token.Assign]: '=',
    [Token.Alternate]: '|',
    [Token.Except]: '-',
    [Token.Range]: '..',
    [Token.Concatenate]: ',',
    [Token.OneOrMore]: '+',
    [Token.LBrace]: '{',
    [Token.RBrace]: '}',
    [Token.LParen]: '(',
    [Token.RParen]: ')',
    [Token.LBracket]: '[',
    [Token.RBracket]: ']',
  }

  return tokenNames[token] || `token(${token})`
}

export function isLiteral(token: Token): boolean {
  return token === Token.String
}

export function isOperator(token: Token): boolean {
  return token >= Token.operatorStart && token <= Token.operatorEnd
}

export function canStartExpression(token: Token): boolean {
  return token >= Token.expressionStart && token <= Token.expressionEnd
}

export function infixPrecedence(token: Token): number {
  switch (token) {
    case Token.Alternate:
      return 1
    case Token.Concatenate:
      return 2
    case Token.Except:
      return 3
    // postfix OneOrMore 4
    case Token.Range:
      return 5
    default:
      return lowestPrecedence
  }
}

export function postfixPrecedence(token: Token): number {
  switch (token) {
    case Token.Except: // postfix as one or more
    case Token.OneOrMore:
      return 4
    default:
      return lowestPrecedence
  }
}

export const lowestPrecedence = 0

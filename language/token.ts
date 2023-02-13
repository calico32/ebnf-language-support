export const enum Token {
  Illegal,
  EOF,

  Ident,
  Comment,
  String,

  operatorStart,
  Semi,
  Assign,
  Alternate,
  Except,
  Range,
  Concatenate,
  Special,
  operatorEnd,

  LBrace,
  RBrace,
  LParen,
  RParen,
  LBracket,
  RBracket,
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
    [Token.LBrace]: '{',
    [Token.RBrace]: '}',
    [Token.LParen]: '(',
    [Token.RParen]: ')',
    [Token.LBracket]: '[',
    [Token.RBracket]: ']',
  }

  return tokenNames[token] || `token(${token})`
}

export const isLiteral = (token: Token): boolean => {
  return token === Token.String
}

export const isOperator = (token: Token): boolean => {
  return token >= Token.operatorStart && token <= Token.operatorEnd
}

export const precedenceOf = (token: Token): number => {
  switch (token) {
    case Token.Alternate:
      return 1
    case Token.Concatenate:
      return 2
    case Token.Except:
      return 3
    case Token.Range:
      return 4
    default:
      return lowestPrecedence
  }
}

export const lowestPrecedence = 0
export const highestPrecedence = 4

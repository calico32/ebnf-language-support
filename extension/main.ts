import didYouMean from 'didyoumean'
import * as vscode from 'vscode'
import * as ast from '../language/ast.js'
import { FileSet } from '../language/file.js'
import { Parser } from '../language/parser.js'

type FileStatus = {
  parser: Parser
  ast: ast.Grammar
  diagnostics: vscode.Diagnostic[]
}

function visit(
  node: ast.Node,
  visitor: (node: ast.Node, parent?: ast.Node) => void,
  parent?: ast.Node
): void {
  visitor(node, parent)
  for (const child of node.children) {
    visit(child, visitor, node)
  }
}

function getReferences(
  grammar: ast.Grammar,
  ruleName: string
): [number, number][] {
  const refs: [number, number][] = []

  visit(grammar, (node) => {
    if (node instanceof ast.Ident && node.name === ruleName) {
      refs.push([node.pos, node.end])
    }
  })

  return refs
}

const files = new Map<string, FileStatus>()

function updateFile(document: vscode.TextDocument): FileStatus {
  const uri = document.uri.toString()
  const fset = new FileSet()
  const parser = new Parser(fset, uri, document.getText())
  const grammar = parser.parseGrammar()
  const diagnostics: vscode.Diagnostic[] = []

  for (const err of parser.errors) {
    const pos = fset.position(err.pos)
    const start = new vscode.Position(pos.line - 1, pos.column - 1)
    const end = new vscode.Position(pos.line - 1, pos.column)
    const range = new vscode.Range(start, end)
    const diagnostic = new vscode.Diagnostic(
      range,
      err.msg,
      vscode.DiagnosticSeverity.Error
    )
    diagnostic.source = 'ebnf'
    diagnostics.push(diagnostic)
  }

  visit(grammar, (node) => {
    if (node instanceof ast.Ident && !grammar.rules.has(node.name)) {
      const pos = fset.position(node.pos)
      const start = new vscode.Position(pos.line - 1, pos.column - 1)
      const end = new vscode.Position(
        pos.line - 1,
        pos.column - 1 + node.name.length
      )
      const range = new vscode.Range(start, end)
      const diagnostic = new vscode.Diagnostic(
        range,
        `Undefined rule: ${node.name}`,
        vscode.DiagnosticSeverity.Error
      )
      diagnostic.source = 'ebnf'

      const similar = didYouMean(node.name, [...grammar.rules.keys()])

      if (similar?.length ?? similar) {
        diagnostic.relatedInformation = [
          new vscode.DiagnosticRelatedInformation(
            new vscode.Location(document.uri, range),
            `Did you mean ${similar}?`
          ),
        ]
      }

      diagnostics.push(diagnostic)
    }
  })

  diagnosticCollection.set(document.uri, diagnostics)

  files.set(uri, { parser, ast: grammar, diagnostics })
  return { parser, ast: grammar, diagnostics }
}

function getFile(document: vscode.TextDocument): FileStatus {
  const uri = document.uri.toString()
  if (files.has(uri)) {
    return files.get(uri) as FileStatus
  }

  return updateFile(document)
}

const diagnosticCollection = vscode.languages.createDiagnosticCollection('ebnf')

export function activate(context: vscode.ExtensionContext) {
  const onEditor = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (!editor) return
    const doc = editor.document
    if (doc.languageId !== 'ebnf') return
    diagnosticCollection.set(doc.uri, [])
    updateFile(doc)
  })

  const onDoc = vscode.workspace.onDidChangeTextDocument((event) => {
    const doc = event.document
    if (doc.languageId !== 'ebnf') return
    diagnosticCollection.set(doc.uri, [])
    updateFile(doc)
  })

  context.subscriptions.push(onEditor, onDoc, diagnosticCollection)
}

const ebnf: vscode.DocumentSelector = {
  language: 'ebnf',
  scheme: '*',
}

vscode.languages.registerDefinitionProvider(ebnf, {
  provideDefinition(document, position, token) {
    const wordRange = document.getWordRangeAtPosition(position)
    const word = document.getText(wordRange)
    if (!word) return

    const file = getFile(document)

    const def = file.ast.rules.get(word)
    if (!def) return

    const pos = file.parser.file.position(def.name.pos)
    const end = file.parser.file.position(def.name.end)
    const posStart = new vscode.Position(pos.line - 1, pos.column - 1)
    const posEnd = new vscode.Position(end.line - 1, end.column - 1)
    return new vscode.Location(document.uri, new vscode.Range(posStart, posEnd))
  },
})

vscode.languages.registerDocumentSymbolProvider(ebnf, {
  provideDocumentSymbols(document, token) {
    const file = getFile(document)

    const symbols: vscode.SymbolInformation[] = []
    for (const [name, def] of file.ast.rules) {
      const pos = file.parser.file.position(def.name.pos)
      const end = file.parser.file.position(def.name.end)
      const posStart = new vscode.Position(pos.line - 1, pos.column - 1)
      const posEnd = new vscode.Position(end.line - 1, end.column - 1)
      symbols.push(
        new vscode.SymbolInformation(
          name,
          vscode.SymbolKind.Class,
          '',
          new vscode.Location(document.uri, new vscode.Range(posStart, posEnd))
        )
      )
    }
    return symbols
  },
})

vscode.languages.registerCompletionItemProvider(ebnf, {
  provideCompletionItems(document, position, token) {
    const file = getFile(document)

    const items: vscode.CompletionItem[] = []
    for (const [name, def] of file.ast.rules) {
      items.push(
        new vscode.CompletionItem(name, vscode.CompletionItemKind.Class)
      )
    }
    return items
  },
})

vscode.languages.registerReferenceProvider(ebnf, {
  provideReferences(document, position, context, token) {
    const wordRange = document.getWordRangeAtPosition(position)
    const word = document.getText(wordRange)
    if (!word) return

    const file = getFile(document)

    // determine if we're on the definition of the rule
    const def = file.ast.rules.get(word)
    if (!def) return

    const pos = calculatePos(file, position)
    if (pos < def.name.pos || pos > def.name.end) return

    const refs = getReferences(file.ast, word)
    const locations: vscode.Location[] = []
    for (const [start, end] of refs) {
      locations.push(
        new vscode.Location(document.uri, rangeFrom(file, start, end))
      )
    }

    return locations
  },
})

vscode.languages.registerHoverProvider(ebnf, {
  provideHover(document, position, token) {
    const wordRange = document.getWordRangeAtPosition(position)
    const word = document.getText(wordRange)
    if (!word) return

    const file = getFile(document)

    // determine if we're on the definition of the rule
    const def = file.ast.rules.get(word)
    if (!def) return

    const stringDef = ast.stringify(def)

    return new vscode.Hover({
      language: 'ebnf',
      value: stringDef,
    })
  },
})

const legend = new vscode.SemanticTokensLegend(
  ['variable', 'function', 'operator', 'string'],
  ['readonly', 'defaultLibrary']
)

vscode.languages.registerDocumentSemanticTokensProvider(
  ebnf,
  {
    provideDocumentSemanticTokens(document, token) {
      const file = getFile(document)

      const tokens = new vscode.SemanticTokensBuilder(legend)

      visit(file.ast, (node, parent) => {
        if (node instanceof ast.Grammar) return
        const range = rangeFrom(file, node.pos, node.end)

        if (node instanceof ast.Rule) {
          tokens.push(rangeFrom(file, node.equals, node.equals + 1), 'operator')
          return
        }

        if (node instanceof ast.Ident) {
          if (parent instanceof ast.Rule && parent.name === node) {
            tokens.push(range, 'variable', ['readonly'])
            return
          }

          tokens.push(range, 'function')
          return
        }

        if (node instanceof ast.String) {
          if (!range.isSingleLine) {
            addMultilineTokens({
              file,
              node,
              tokens,
              range,
              tokenType: 'string',
            })
            return
          }

          tokens.push(range, 'string')
          return
        }

        if (node instanceof ast.Special) {
          if (!range.isSingleLine) {
            addMultilineTokens({
              file,
              node,
              tokens,
              range,
              tokenType: 'variable',
              tokenModifiers: ['readonly', 'defaultLibrary'],
            })
            return
          }

          tokens.push(range, 'variable', ['readonly', 'defaultLibrary'])
          return
        }

        if (node instanceof ast.BinaryExpr) {
          if (node.opPos < 0) {
            // implicit operator, do nothing
            return
          }
          tokens.push(rangeFrom(file, node.opPos, node.opPos + 1), 'operator')
          return
        }
      })

      return tokens.build()
    },
  },
  legend
)

function rangeFrom(file: FileStatus, pos: number, end: number): vscode.Range {
  const position = file.parser.file.position(pos)
  const endPosition = file.parser.file.position(end)

  return new vscode.Range(
    new vscode.Position(position.line - 1, position.column - 1),
    new vscode.Position(endPosition.line - 1, endPosition.column - 1)
  )
}

function calculatePos(
  { parser: { file } }: FileStatus,
  position: vscode.Position
): number {
  const line = position.line + 1
  const column = position.character + 1

  return file.lines[line - 1] + column
}

function addMultilineTokens({
  file,
  node,
  tokens,
  range,
  tokenType,
  tokenModifiers = [],
}: {
  file: FileStatus
  node: ast.String
  tokens: vscode.SemanticTokensBuilder
  range: vscode.Range
  tokenType: string
  tokenModifiers?: string[]
}) {
  const pos = file.parser.file.position(node.pos)
  const startLine = new vscode.Range(
    new vscode.Position(pos.line - 1, pos.column - 1),
    new vscode.Position(pos.line - 1, 1000)
  )

  tokens.push(startLine, tokenType, tokenModifiers)
  for (let i = range.start.line + 1; i < range.end.line; i++) {
    const line = new vscode.Range(
      new vscode.Position(i, 0),
      new vscode.Position(i, 1000)
    )
    tokens.push(line, tokenType, tokenModifiers)
  }
  const endLine = new vscode.Range(
    new vscode.Position(range.end.line, 0),
    range.end
  )
  tokens.push(endLine, tokenType, tokenModifiers)

  return
}

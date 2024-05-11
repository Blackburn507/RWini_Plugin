import vscode from 'vscode'
import path from 'path'
import sections from '../db/sections.json'
import values from '../db/values.json'
import valueType from '../db/valueTypes.json'
import allKeys from '../db/keys.json'

function activate(context) {
  console.log('Congratulations, extension "RWini-Plugin" is now active!')

  //Parsing functions
  class indexToPosition {
    constructor(index, text) {
      const lineNumber = 0
      const lastNewLine = 0
      for (let i = 0; i < index; i++) {
        if (text[i] == '\n') {
          lineNumber += 1
          lastNewLine = i
        }
      }
      this.line = lineNumber
      this.char = index - lastNewLine
    }
  }

  function positionToIndex(position, text) {
    const i = 0
    const lineNumber = 0
    while (lineNumber < position.line) {
      if (text[i] == '\n') {
        lineNumber++
      }
      i++
    }
    return i + position.character
  }

  function getIfMultiline(document, position) {
    const matchedMultlineNotations = document
      .getText()
      .substring(0, positionToIndex(position, document.getText()))
      .matchAll(/\"\"\"/g)
    const number = [...matchedMultlineNotations].length
    if (number % 2 == 1) {
      return true
    } else {
      return false
    }
  }

  function sectionNameCorrection(inputSectionName) {
    const outputSectionName = ''
    switch (inputSectionName) {
      case 'arm':
        outputSectionName = 'leg'
        break
      case 'hiddenAction':
        outputSectionName = 'action'
        break
      case 'global_resource':
        outputSectionName = 'resource'
        break
      case 'comment':
        outputSectionName = ''
        break
      case 'template':
        outputSectionName = ''
        break
      default:
        outputSectionName = inputSectionName
        break
    }
    return outputSectionName
  }

  function getSection(document, position) {
    //Get current section
    const offset = 0
    while (offset < document.lineCount && finding == null) {
      const finding = document
        .lineAt(position.line - offset)
        .text.match(/(?<![^ ]+ *)\[/)
      if (finding != null) {
        const begin = document.lineAt(position.line - offset).text.indexOf('[')
        if (document.lineAt(position.line - offset).text.indexOf('_') > 0) {
          const end = document.lineAt(position.line - offset).text.indexOf('_')
        } else {
          const end = document.lineAt(position.line - offset).text.indexOf(']')
        }
        const currentSection0 = document
          .lineAt(position.line - offset)
          .text.substring(begin + 1, end)
        const currentSection = sectionNameCorrection(currentSection0)
        return currentSection
      }
      offset++
    }
  }

  function getCustomSections(sectionName, document) {
    //Get custom section names
    const allCustomSections = document.getText().match(/(?<=\n *\[)\w+/gm)
    const customSections = []
    allCustomSections.map(inputSection => {
      if (sectionNameCorrection(inputSection.split('_')[0]) == sectionName) {
        const outputSection = inputSection.split('_')[1]
        customSections.push(outputSection)
      }
    })
    return customSections
  }

  function getKeyInMultipleLine(document, position) {
    if (getIfMultiline(document, position) == true) {
      const offset = 0
      while (offset < 100 && finding == null) {
        const finding = document
          .lineAt(position.line - offset)
          .text.match(/\"\"\"/)
        if (finding != null) {
          const currentKey = document
            .lineAt(position.line - offset)
            .text.match(/(?<![^ ]+ *)\w+/)
        }
        offset++
      }
      return currentKey
    }
  }

  function replaceLocalvariables(value, position, document) {
    const matchedVariables = value.matchAll(/\$\{\w+\}/g)
    for (const variable of matchedVariables) {
      const offset = 0
      const localVariableName = variable[0].substring(2, variable[0].length - 1)
      const finding = null
      while (offset < 100 && finding == null && sectionBoundary == null) {
        const pattern = new RegExp(`(?<=@define +${localVariableName}: *).+`)
        const finding = document
          .lineAt(position.line - offset)
          .text.match(pattern)
        const sectionBoundary = document
          .lineAt(position.line - offset)
          .text.match(/(?<![^ ]+ *)\[/)
        if (finding != null) {
          value = value.replace(variable[0], finding[0].replace(' ', ''))
        }
        offset++
      }
    }
    return value
  }

  class Multiline {
    constructor(document) {
      const splitedDocument = document.getText().split('"""')
      const mergedLines = []
      const startPositions = []
      const endPositions = []
      const keys = []
      for (let i = 1; i < splitedDocument.length; i += 2) {
        const singleMergedLine = splitedDocument[i].replace(/[\r\n]+/g, '')
        const linesBefore = splitedDocument[i - 1].split('\n')
        const startPosition = 0
        const lastLine = ''
        for (const j = 0; j < i; j++) {
          startPosition += splitedDocument[j].length + 3
        }
        for (const line of linesBefore) {
          lastLine = linesBefore[line]
        }
        mergedLines.push(singleMergedLine)
        startPositions.push(startPosition - 1)
        endPositions.push(startPosition + splitedDocument[i].length - 1)
        keys.push(lastLine.match(/(?<![^ ]+ *)\w+/))
      }
      this.mergedLines = mergedLines
      this.startPositions = startPositions
      this.endPositions = endPositions
      this.keys = keys
    }
  }

  class CustomVariable {
    constructor(document) {
      const memoryNumber = document
        .getText()
        .match(/(?<=number\[?\]? +)\w+|(?<=@memory +)\w+(?=: *number\[?\]?)/gi)
      if (memoryNumber == null) {
        this.memoryNumber = []
      } else {
        this.memoryNumber = memoryNumber
      }
      const resourceNumber = document.getText().match(/(?<=\[resource_)\w+/gi)
      if (resourceNumber == null) {
        this.resourceNumber = []
      } else {
        this.resourceNumber = resourceNumber
      }
      const memoryFloat = document
        .getText()
        .match(/(?<=float\[?\]? +)\w+|(?<=@memory +)\w+(?=: *float\[?\]?)/gi)
      if (memoryFloat == null) {
        this.memoryFloat = []
      } else {
        this.memoryFloat = memoryFloat
      }
      const memoryUnit = document
        .getText()
        .match(/(?<=unit\[?\]? +)\w+|(?<=@memory +)\w+(?=: *unit\[?\]?)/gi)
      if (memoryUnit == null) {
        this.memoryUnit = []
      } else {
        this.memoryUnit = memoryUnit
      }
      const memoryString = document
        .getText()
        .match(/(?<=string +)\w+|(?<=@memory +)\w+(?=: *string)/gi)
      if (memoryString == null) {
        this.memoryString = []
      } else {
        this.memoryString = memoryString
      }
      const memoryBool = document
        .getText()
        .match(
          /(?<=boolean\[?\]? +)\w+|(?<=@memory +)\w+(?=: *boolean\[?\]?)/gi,
        )
      if (memoryBool == null) {
        this.memoryBool = []
      } else {
        this.memoryBool = memoryBool
      }
    }
  }

  // Semantic Tokens
  const selector = { language: 'rwini', scheme: 'file' }
  const tokenTypes = ['memory', 'test']
  const tokenModifiers = ['default']
  const legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers)

  class Provider {
    provideDocumentSemanticTokens(document) {
      const builder = new vscode.SemanticTokensBuilder()
      const customVariables = new CustomVariable(document)
      const allVariables = []
      for (const variableType of customVariables) {
        customVariables[variableType].forEach(variable =>
          allVariables.push(variable),
        )
      }
      allVariables.forEach(variable => {
        const pattern = new RegExp(variable, 'g')
        const matchs = document.getText().matchAll(pattern)
        for (const matchedVariables of matchs) {
          const position = new vscode.Position(
            new indexToPosition(
              matchedVariables.index,
              document.getText(),
            ).line,
            new indexToPosition(
              matchedVariables.index,
              document.getText(),
            ).char,
          )
          if (
            document
              .lineAt(position)
              .text.match(
                /setUnitMemory|defineUnitMemory|@memory|updateUnitMemory/,
              ) != null ||
            document
              .getText()
              .substring(matchedVariables.index - 7, matchedVariables.index) ==
              'memory.' ||
            getIfMultiline(document, position)
          ) {
            builder.push(
              position.line,
              position.character - 1,
              matchedVariables[0].length,
              0,
            )
          }
        }
      })
      return builder.build()
    }
  }
  const semanticProvider =
    vscode.languages.registerDocumentSemanticTokensProvider(
      selector,
      new Provider(),
      legend,
    )

  // Auto-Completing
  const overrideProvider = vscode.languages.registerCompletionItemProvider(
    'rwini',
    {
      provideCompletionItems() {
        return [new vscode.CompletionItem('.')]
      },
    },
  )

  const sectionProvider = vscode.languages.registerCompletionItemProvider(
    'rwini',
    {
      provideCompletionItems(document, position) {
        const currentLine = document.lineAt(position).text
        if (
          currentLine.match(/(?<![^ ]+ *)\[/) != null &&
          currentLine.indexOf('_') < 0 &&
          getIfMultiline(document, position) == false
        ) {
          return Object.keys(sections).map(names => {
            return new vscode.CompletionItem(
              names,
              vscode.CompletionItemKind.Property,
            )
          })
        }
      },
    },
    '[',
  )

  const keyProvider = vscode.languages.registerCompletionItemProvider(
    'rwini',
    {
      provideCompletionItems(document, position) {
        const currentLine = document.lineAt(position).text
        if (
          currentLine.match(/[:,#,_,[]/) == null &&
          getIfMultiline(document, position) == false
        ) {
          const currentSection = getSection(document, position)
          const keysOfSection = Object.keys(allKeys[currentSection]).concat(
            Object.keys(allKeys['template']),
          )
          return keysOfSection.map(names => {
            return new vscode.CompletionItem(
              names,
              vscode.CompletionItemKind.Keyword,
            )
          })
        }
      },
    },
    '@',
  )

  function getAllCustomVariableCompletion(document) {
    const customVariableCompletions = new CustomVariable(document).memoryNumber
      .map(names => {
        return new vscode.CompletionItem(
          'memory.'.concat(names),
          vscode.CompletionItemKind.Constant,
        )
      })
      .concat(
        new CustomVariable(document).memoryFloat.map(names => {
          return new vscode.CompletionItem(
            'memory.'.concat(names),
            vscode.CompletionItemKind.Constant,
          )
        }),
      )
      .concat(
        new CustomVariable(document).memoryBool.map(names => {
          return new vscode.CompletionItem(
            'memory.'.concat(names),
            vscode.CompletionItemKind.Constant,
          )
        }),
      )
      .concat(
        new CustomVariable(document).resourceNumber.map(names => {
          return new vscode.CompletionItem(
            'resource.'.concat(names),
            vscode.CompletionItemKind.Constant,
          )
        }),
      )
      .concat(
        new CustomVariable(document).memoryUnit.map(names => {
          return new vscode.CompletionItem(
            'memory.'.concat(names),
            vscode.CompletionItemKind.Field,
          )
        }),
      )
      .concat(
        new CustomVariable(document).memoryString.map(names => {
          return new vscode.CompletionItem(
            'memory.'.concat(names),
            vscode.CompletionItemKind.Text,
          )
        }),
      )
    return customVariableCompletions
  }

  const commonValuesProvider = vscode.languages.registerCompletionItemProvider(
    'rwini',
    {
      provideCompletionItems(document, position) {
        const currentLine = document.lineAt(position).text
        if (currentLine.match(/:/) != null) {
          const currentSection = getSection(document, position)
          const currentKey = currentLine.match(/(?<![^ ]+ *)\w+/)
          const currentValue = currentLine.substring(currentKey[0].length + 1)
          const type = allKeys[currentSection][currentKey[0]][0]
          if (type.match(/(?<!unit)Ref/) == null) {
            let completions
            const memorys = []
            switch (type) {
              case 'bool':
                if (currentValue.match(/[^ ]/) == null) {
                  completions = ['true', 'false'].map(names => {
                    return new vscode.CompletionItem(
                      names,
                      vscode.CompletionItemKind.Reference,
                    )
                  })
                }
                break
              case 'logicBoolean':
                if (currentValue.match(/[^ ]/) == null) {
                  completions = ['true', 'false', 'if'].map(names => {
                    return new vscode.CompletionItem(
                      names,
                      vscode.CompletionItemKind.Reference,
                    )
                  })
                }
                break
              case 'memory':
                {
                  const customVariables = new CustomVariable(document)
                  for (const variableType of customVariables) {
                    customVariables[variableType].forEach(variable =>
                      memorys.push(variable),
                    )
                  }
                  completions = memorys.map(names => {
                    return new vscode.CompletionItem(
                      names,
                      vscode.CompletionItemKind.Variable,
                    )
                  })
                }
                break
            }
            return completions
          } else {
            //Section-ref completion
            const sectionName = type.slice(0, -3)
            return getCustomSections(sectionName, document).map(names => {
              return new vscode.CompletionItem(
                names,
                vscode.CompletionItemKind.Property,
              )
            })
          }
        }
      },
    },
    ':',
    ' ',
    ',',
  )

  const logicValueProvider = vscode.languages.registerCompletionItemProvider(
    'rwini',
    {
      provideCompletionItems(document, position) {
        const currentSection = getSection(document, position)
        const currentLine = document.lineAt(position).text
        let currentKey
        if (
          currentLine.match(/:/) != null &&
          getIfMultiline(document, position) != true
        ) {
          currentKey = currentLine.match(/(?<![^ ]+ *)\w+/)
        } else if (getIfMultiline(document, position) == true) {
          currentKey = getKeyInMultipleLine(document, position)
        }
        if (
          ['logicBoolean', 'dynamicFloat', 'unitRef'].includes(
            allKeys[currentSection][currentKey[0]][0],
          )
        ) {
          if (currentLine.charAt(position.character - 1) == ' ') {
            return values['unitRef']
              .map(names => {
                return new vscode.CompletionItem(
                  names,
                  vscode.CompletionItemKind.Field,
                )
              })
              .concat(
                values['function'].map(names => {
                  return new vscode.CompletionItem(
                    names,
                    vscode.CompletionItemKind.Function,
                  )
                }),
              )
              .concat(getAllCustomVariableCompletion(document))
          } else if (currentLine.charAt(position.character - 1) == '.') {
            return values['propertyRef']
              .map(names => {
                return new vscode.CompletionItem(
                  names,
                  vscode.CompletionItemKind.Constant,
                )
              })
              .concat(
                values['unitRef'].map(names => {
                  return new vscode.CompletionItem(
                    names,
                    vscode.CompletionItemKind.Field,
                  )
                }),
              )
              .concat(
                values['boolRef'].map(names => {
                  return new vscode.CompletionItem(
                    names,
                    vscode.CompletionItemKind.Reference,
                  )
                }),
              )
              .concat(
                new CustomVariable(document).resourceNumber.map(names => {
                  return new vscode.CompletionItem(
                    'resource.'.concat(names),
                    vscode.CompletionItemKind.Constant,
                  )
                }),
              )
          }
        }
      },
    },
    ':',
    ' ',
    '.',
  )

  // Hover Prompts
  const keyHoverPrompt = vscode.languages.registerHoverProvider('rwini', {
    provideHover(document, position) {
      if (document.lineAt(position).text.indexOf(':') > position.character) {
        const currentSection = getSection(document, position)
        const key = document.getText(
          document.getWordRangeAtPosition(position, /@?\w+/),
        )
        const occurSections = ''
        for (const section of allKeys) {
          if (allKeys[section][key] != undefined) {
            occurSections += `[${section}](ValueType: ${allKeys[section][key][0]})  `
          } else {
            const MLKey = key.slice(0, -3)
            if (allKeys[section][MLKey] != undefined) {
              occurSections += `[${section}](ValueType: ${allKeys[section][MLKey][0]})  `
            }
          }
        }
        const markdownContent = new vscode.MarkdownString(
          `Translation: \'${allKeys[currentSection][key][2]}\'  
					 Section: ${occurSections}  
					 ------  
					 Decription([${currentSection}]):  
					 \'${allKeys[currentSection][key][3]}\'`,
        )
        return new vscode.Hover(markdownContent)
      }
    },
  })

  const valueHoverPrompt = vscode.languages.registerHoverProvider('rwini', {
    provideHover(document, position) {
      const value = document.getText(document.getWordRangeAtPosition(position))
      if (
        document.lineAt(position).text.indexOf(':') < position.character ||
        getIfMultiline(document, position) == true
      ) {
        const valueInfo = valueType[value]
        if (valueInfo != undefined) {
          return new vscode.Hover(`type: ${valueInfo[0]}`)
        } else {
          const customVariables = new CustomVariable(document)
          for (const variable of customVariables) {
            if (customVariables[variable].includes(value)) {
              return new vscode.Hover(`type: ${variable}`)
            }
          }
        }
      }
    },
  })

  function isFileName(word) {
    return (
      word.endsWith('.ini') ||
      word.endsWith('.txt') ||
      word.endsWith('.png') ||
      word.endsWith('.template') ||
      word.endsWith('.wav') ||
      word.endsWith('.md')
    )
  }

  const fileJumpHoverPrompt = vscode.languages.registerHoverProvider('rwini', {
    provideHover(document, position) {
      const range = document.getWordRangeAtPosition(
        position,
        /(ROOT:)?[\w\.\/-]+/i,
      )
      const filePath = document.getText(range)
      const mainFolders = vscode.workspace.workspaceFolders
      if (filePath && isFileName(filePath)) {
        let fileUri
        if (filePath.startsWith('ROOT:')) {
          //Finding the correct folder path
          const rootPath = path.dirname(mainFolders[0].uri.fsPath)
          const documentPath = path.dirname(document.uri.fsPath)
          const remainPath = documentPath.substring(
            rootPath.length,
            documentPath.length,
          )
          const offset = 1
          const finding = false
          while (!finding && offset < 50) {
            if (remainPath.charAt(offset) == '\\') {
              finding = true
            }
            offset++
          }
          const currentDir = documentPath.substring(0, rootPath.length + offset)
          fileUri = vscode.Uri.file(
            path.join(currentDir, filePath.substring(5, filePath.length)),
          )
        } else {
          const currentDir = path.dirname(document.uri.fsPath)
          fileUri = vscode.Uri.file(path.join(currentDir, filePath))
        }
        const markdownString = new vscode.MarkdownString(
          `Open File: [${filePath}](${fileUri})`,
        )
        markdownString.isTrusted = true
        return new vscode.Hover(markdownString, range)
      }
    },
  })

  const fileJumpCommand = vscode.commands.registerCommand(
    'extension.openFile',
    fileUri => {
      vscode.window.showTextDocument(fileUri)
    },
  )

  // Folding
  const sectionFoldingProvider = vscode.languages.registerFoldingRangeProvider(
    'rwini',
    {
      provideFoldingRanges(document) {
        const ranges = []
        for (const i = 0; i < document.lineCount; i++) {
          const currentLine = document.lineAt(i).text
          if (currentLine.match(/(?<![^ ]+ *)\[/)) {
            const start = i
            i++
            while (
              i < document.lineCount &&
              !document.lineAt(i).text.match(/(?<![^ ]+ *)\[/)
            ) {
              i++
            }
            if (i < document.lineCount) {
              ranges.push(
                new vscode.FoldingRange(
                  start,
                  i - 1,
                  vscode.FoldingRangeKind.Region,
                ),
              )
            } else {
              ranges.push(
                new vscode.FoldingRange(
                  start,
                  document.lineCount - 1,
                  vscode.FoldingRangeKind.Region,
                ),
              )
            }
            i -= 1
          }
        }
        return ranges
      },
    },
  )

  const multilineFoldingProvider =
    vscode.languages.registerFoldingRangeProvider('rwini', {
      provideFoldingRanges(document) {
        const ranges = []
        for (const i = 0; i < document.lineCount; i++) {
          const currentLine = document.lineAt(i).text
          if (currentLine.match(/\"\"\"/)) {
            const start = i
            i++
            while (
              i < document.lineCount &&
              !document.lineAt(i).text.match(/\"\"\"/)
            ) {
              i++
            }
            if (i < document.lineCount) {
              ranges.push(
                new vscode.FoldingRange(
                  start,
                  i,
                  vscode.FoldingRangeKind.Region,
                ),
              )
            }
            i -= 1
          }
        }
        return ranges
      },
    })

  // Diagnostic
  function uniquenessTest(string, RegExp) {
    const remains = string.replace(RegExp, '#')
    if (remains.match(/[^ #]/) != null || remains.split('#').length > 2) {
      return false
    } else {
      return true
    }
  }

  function diagnoseValue(expectedValue, value) {
    switch (expectedValue) {
      case 'bool':
        {
          if (uniquenessTest(value, /(true|false)/) == false) {
            return true
          }
        }
        break
      case 'int':
        {
          if (uniquenessTest(value, /-?\d+/) == false) {
            return true
          }
        }
        break
      case 'float':
        {
          if (uniquenessTest(value, /-?\d+\.?\d*/) == false) {
            return true
          }
        }
        break
      case 'time':
        {
          if (uniquenessTest(value, /\d+\.?\d* *s?/) == false) {
            return true
          }
        }
        break
    }
  }

  const collection = vscode.languages.createDiagnosticCollection('rwiniKey')
  vscode.workspace.onDidChangeTextDocument(event => {
    const diagnostics = []
    const totalLineNumber = event.document.getText().split('\n').length
    const allSections = event.document
      .getText()
      .matchAll(/(?<=\n *\[)[^_\]]+/gim)
    for (const section of allSections) {
      //Check section
      if (sections[section[0]] == undefined) {
        const sectionPosition = new indexToPosition(
          section.index,
          event.document.getText(),
        )
        const sectionStart = new vscode.Position(
          sectionPosition.line,
          sectionPosition.char,
        )
        const sectionEnd = new vscode.Position(
          sectionPosition.line,
          sectionPosition.char + section[0].length,
        )
        const range = new vscode.Range(sectionStart, sectionEnd)
        if (getIfMultiline(event.document, sectionStart) == false) {
          const diagnostic = new vscode.Diagnostic(
            range,
            `Unknown section: ${section[0]}`,
            vscode.DiagnosticSeverity.Error,
          )
          diagnostics.push(diagnostic)
        }
      }
    }
    for (const line = 0; line < totalLineNumber; line++) {
      //Check key
      const currentLine = event.document.lineAt(line).text
      const currentKey = /(?<![^ ]+ *)\w+/.exec(currentLine)
      if (
        currentKey !== null &&
        currentKey[0].match(/(body|leg|arm|effect|mutator)\d?_/) == null
      ) {
        const keyStart = new vscode.Position(line, currentKey.index)
        const keyEnd = new vscode.Position(
          line,
          currentKey.index + currentKey[0].length,
        )
        const range = new vscode.Range(keyStart, keyEnd)
        const currentSection = getSection(event.document, keyStart)
        if (
          allKeys[currentSection] != undefined &&
          currentSection != '' &&
          getIfMultiline(event.document, keyStart) == false
        ) {
          if (
            allKeys[currentSection][currentKey[0]] == undefined &&
            allKeys[currentSection][currentKey[0].slice(0, -3)] == undefined
          ) {
            const diagnostic = new vscode.Diagnostic(
              range,
              `Can not find key \'${currentKey[0]}\' under section: ${currentSection}`,
              vscode.DiagnosticSeverity.Error,
            )
            diagnostics.push(diagnostic)
          }
          //Check value
          else if (currentLine.match(/\"\"\"/) == null) {
            const valueStartChar = currentKey.index + currentKey[0].length + 1
            const valueStart = new vscode.Position(line, valueStartChar)
            const valueEnd = new vscode.Position(
              line,
              valueStartChar + currentLine.substring(valueStartChar).length,
            )
            const currentValue = replaceLocalvariables(
              currentLine.substring(valueStartChar),
              valueStart,
              event.document,
            )
            const range = new vscode.Range(valueStart, valueEnd)
            const expectedValue = allKeys[currentSection][currentKey[0]][0]
            const preDiagnostic = new vscode.Diagnostic(
              range,
              `Unexpected value:\'${currentValue}\'(type=\'${valueType[currentValue]}\'), Key: ${currentKey}(expectedType=\'${expectedValue}\')`,
              vscode.DiagnosticSeverity.Error,
            )
            if (diagnoseValue(expectedValue, currentValue) == true) {
              diagnostics.push(preDiagnostic)
            }
          }
        }
      }
    }
    const multilines = new Multiline(event.document)
    for (const line of multilines.mergedLines) {
      //Check multiline
      const currentKey = multilines.keys[line]
      const valueStartPosition = new indexToPosition(
        multilines.startPositions[line],
        event.document.getText(),
      )
      const valueStart = new vscode.Position(
        valueStartPosition.line,
        valueStartPosition.char,
      )
      const currentSection = getSection(event.document, valueStart)
      if (allKeys[currentSection] != undefined && currentSection != '') {
        if (
          allKeys[currentSection][currentKey[0]] != undefined ||
          allKeys[currentSection][currentKey[0].slice(0, -3)] != undefined
        ) {
          const currentValue = replaceLocalvariables(
            multilines.mergedLines[line],
            valueStart,
            event.document,
          )

          const valueEndPosition = new indexToPosition(
            multilines.endPositions[line],
            event.document.getText(),
          )
          const valueEnd = new vscode.Position(
            valueEndPosition.line,
            valueEndPosition.char,
          )
          const range = new vscode.Range(valueStart, valueEnd)
          const expectedValue = allKeys[currentSection][currentKey[0]][0]
          const preDiagnostic = new vscode.Diagnostic(
            range,
            `Unexpected value:\'${currentValue}\'(type=\'${valueType[currentValue]}\'), Key: ${currentKey}(expectedType=\'${expectedValue}\')`,
            vscode.DiagnosticSeverity.Error,
          )
          if (diagnoseValue(expectedValue, currentValue) == true) {
            diagnostics.push(preDiagnostic)
          }
        }
      }
    }
    collection.set(event.document.uri, diagnostics)
  })

  context.subscriptions.push(
    semanticProvider,

    overrideProvider,
    sectionProvider,
    keyProvider,
    commonValuesProvider,
    logicValueProvider,

    keyHoverPrompt,
    valueHoverPrompt,
    fileJumpHoverPrompt,
    fileJumpCommand,

    sectionFoldingProvider,
    multilineFoldingProvider,
  )
}

function deactivate() {}
export { activate, deactivate }

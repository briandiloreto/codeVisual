import * as vscode from 'vscode';

export interface SymbolsByFileId {
  [key: string]: FileSymbols;
}

export interface FileSymbols {
  filePath: string;
  symbols: vscode.DocumentSymbol[];
}

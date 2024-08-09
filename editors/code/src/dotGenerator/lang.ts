import { TableNode, Cell, CssClass, Style } from './graph';
import { FileOutline } from './types';
import * as vscode from 'vscode';

export interface Language {
  shouldFilterOutFile(file: string): boolean;
  fileRepr(file: FileOutline): TableNode;
  symbolRepr(fileId: number, symbol: vscode.DocumentSymbol): Cell;
  filterSymbol(symbol: vscode.DocumentSymbol): boolean;
  symbolStyle(symbol: vscode.DocumentSymbol): Style;
}

export class DefaultLang implements Language {
  shouldFilterOutFile(file: string): boolean {
    return false;
  }

  fileRepr(file: FileOutline): TableNode {
    // Create table sections for each function-like symbol in the file
    const sections = file.symbols
      .filter(symbol => this.filterSymbol(symbol))
      .map(symbol => this.symbolRepr(file.id, symbol));

    return {
      id: file.id,
      title: file.path.split('/').pop() || '',
      sections: sections,
    } as TableNode;
  }

  symbolRepr(fileId: number, symbol: vscode.DocumentSymbol): Cell {
    // Create a cell to represent this function symbol, creating child cells for each child interface and child function
    const children = symbol.children
      .filter(s => symbol.kind === vscode.SymbolKind.Interface || this.filterSymbol(s))
      .map(symbol => this.symbolRepr(fileId, symbol));

    const range = symbol.selectionRange;
    
    return {
      rangeStart: [ range.start.line, range.start.character ],
      rangeEnd: [ range.end.line, range.end.character ],
      style: this.symbolStyle(symbol),
      title: symbol.name,
      children: children,
    } as Cell;
  }

  filterSymbol(symbol: vscode.DocumentSymbol): boolean {
    switch (symbol.kind) {
      case vscode.SymbolKind.Constant:
      case vscode.SymbolKind.Variable:
      case vscode.SymbolKind.Field:
      case vscode.SymbolKind.Property:
      case vscode.SymbolKind.EnumMember:
        return false;
      default:
        return true;
    }
  }

  symbolStyle(symbol: vscode.DocumentSymbol): Style {
    switch (symbol.kind) {
      case vscode.SymbolKind.Module:
        return {
            rounded: true,
            classes: [CssClass.Cell, CssClass.Module],
        };
      case vscode.SymbolKind.Function:
        return {
            rounded: true,
            classes: [CssClass.Cell, CssClass.Function, CssClass.Clickable],
        };
      case vscode.SymbolKind.Method:
        return {
            rounded: true,
            classes: [CssClass.Cell, CssClass.Method, CssClass.Clickable],
        };
      case vscode.SymbolKind.Constructor:
        return {
            rounded: true,
            classes: [CssClass.Cell, CssClass.Constructor, CssClass.Clickable],
        };
      case vscode.SymbolKind.Interface:
        return {
            border: 0,
            rounded: true,
            classes: [CssClass.Cell, CssClass.Interface, CssClass.Clickable],
        };
      case vscode.SymbolKind.Enum:
        return {
            icon: 'E',
            classes: [CssClass.Cell, CssClass.Type],
        } as Style;
      case vscode.SymbolKind.Struct:
        return {
            icon: 'S',
            classes: [CssClass.Cell, CssClass.Type],
        } as Style;
      case vscode.SymbolKind.Class:
        return {
            icon: 'C',
            classes: [CssClass.Cell, CssClass.Type],
        } as Style;
      case vscode.SymbolKind.TypeParameter:
        return {
            icon: 'T',
            classes: [CssClass.Cell, CssClass.Type],
        } as Style;
      case vscode.SymbolKind.Field:
        return {
            icon: 'f',
            classes: [CssClass.Cell, CssClass.Property],
        } as Style;
      case vscode.SymbolKind.Property:
        return {
            icon: 'p',
            classes: [CssClass.Cell, CssClass.Property],
        } as Style;
    default:
        return {
            rounded: true,
            classes: [CssClass.Cell],
        };
      }
  }
}

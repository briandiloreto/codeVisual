import * as vscode from 'vscode';

export interface FileOutline {
  id: number;
  path: string;
  symbols: vscode.DocumentSymbol[];
}

export interface LocationId {
  locationId(files: Map<string, FileOutline>): [number, number, number] | null;
}

export class SymbolLocation implements LocationId {
  path: string;
  line: number;
  character: number;

  constructor(path: string, position: vscode.Position) {
    this.path = path;
    this.line = position.line;
    this.character = position.character;
  }

  locationId(files: Map<string, FileOutline>): [number, number, number] | null {
    const file = files.get(this.path);
    if (!file) return null;
    return [file.id, this.line, this.character];
  }

  toString(): string {
    return `"${this.path}":"${this.line}_${this.character}"`;
  }
}

export function locationIdHierarchyItem(hierarchyItem: vscode.CallHierarchyItem, path: string, files: Map<string, FileOutline>): [number, number, number] | null {
  const file = files.get(path);
  if (!file) return null;
  return [file.id, hierarchyItem.selectionRange.start.line, hierarchyItem.selectionRange.start.character];
}

// vscode.CallHierarchyItem implements LocationId {
//   uri: { path: string };
//   selectionRange: { start: { line: number, character: number } };

//   locationId(files: Map<string, FileOutline>): [number, number, number] | null {
//     const file = files.get(this.uri.path);
//     if (!file) return null;
//     return [file.id, this.selectionRange.start.line, this.selectionRange.start.character];
//   }
// }

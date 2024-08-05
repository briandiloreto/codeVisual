import { CallHierarchyItem, DocumentSymbol, Position } from 'vscode-languageserver-types';
import { PathLike } from 'fs';

interface FileOutline {
  id: number;
  path: PathLike;
  symbols: DocumentSymbol[];
}

class SymbolLocation {
  path: string;
  line: number;
  character: number;

  constructor(path: string, position: Position) {
    this.path = path;
    this.line = position.line;
    this.character = position.character;
  }

  toString(): string {
    return `"${this.path}":"${this.line}_${this.character}"`;
  }
}

interface LocationId {
  locationId(files: HashMap<string, FileOutline>): [number, number, number] | null;
}

class SymbolLocation implements LocationId {
  locationId(files: HashMap<string, FileOutline>): [number, number, number] | null {
    const file = files.get(this.path);
    if (!file) return null;
    return [file.id, this.line, this.character];
  }
}

class CallHierarchyItem implements LocationId {
  uri: { path: string };
  selectionRange: { start: { line: number, character: number } };

  locationId(files: HashMap<string, FileOutline>): [number, number, number] | null {
    const file = files.get(this.uri.path);
    if (!file) return null;
    return [file.id, this.selectionRange.start.line, this.selectionRange.start.character];
  }
}

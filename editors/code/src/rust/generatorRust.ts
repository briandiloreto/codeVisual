
import { Cell, CssClass, Edge, Subgraph, TableNode } from './graph';
import { Dot } from './dot';
import { FileOutline, locationIdHierarchyItem, SymbolLocation } from './types';
import { DefaultLang, Language } from './lang';
import * as vscode from 'vscode';
import * as path from 'path';

export class GraphGeneratorRust {
  root: string;
  files: Map<string, FileOutline>;
  nextFileId: number;
  
  incomingCalls: Map<SymbolLocation, vscode.CallHierarchyIncomingCall[]>;
  outgoingCalls: Map<SymbolLocation, vscode.CallHierarchyOutgoingCall[]>;
  interfaces: Map<SymbolLocation, SymbolLocation[]>;

  highlights: Map<number, Set<[number, number]>>;
  lang: DefaultLang;

  constructor(root: string, lang: string) {
    this.root = root;
    this.files = new Map<string, FileOutline>();
    this.nextFileId = 1;
    
    this.incomingCalls = new Map<SymbolLocation, vscode.CallHierarchyIncomingCall[]>();
    this.outgoingCalls = new Map<SymbolLocation, vscode.CallHierarchyOutgoingCall[]>();
    this.interfaces = new Map<SymbolLocation, SymbolLocation[]>();

    this.highlights = new Map<number, Set<[number, number]>>();
    this.lang = new DefaultLang();
  }

  should_filter_out_file(filePath: string): boolean {
    return this.lang.shouldFilterOutFile(filePath);
  }

  add_file(filePath: string, symbols: vscode.DocumentSymbol[]): boolean {
    if (this.lang.shouldFilterOutFile(filePath)) {
      return false;
    }

    const file = {
      id: this.nextFileId,
      path: filePath,
      symbols,
    } as FileOutline;

    const entry = this.files.get(filePath);
    if (!entry) {
      this.files.set(filePath, file);
      this.nextFileId += 1;
    } else {
      return false;
    }

    return true;
  }

  add_incoming_calls(filePath: string, position: vscode.Position, calls: vscode.CallHierarchyIncomingCall[]): void {
    const location = new SymbolLocation(filePath, position);
    this.incomingCalls.set(location, calls);
  }

  add_outgoing_calls(filePath: string, position: vscode.Position, calls: vscode.CallHierarchyOutgoingCall[]): void {
    const location = new SymbolLocation(filePath, position);
    this.outgoingCalls.set(location, calls);
  }

  highlight(filePath: string, position: vscode.Position): void {
    const fileId = this.files.get(filePath)?.id;
    if (fileId === undefined) return;

    const cellPos: [number, number] = [position.line, position.character];

    const entry = this.highlights.get(fileId);
    if (!entry) {
      const set = new Set<[number, number]>();
      set.add(cellPos);
      this.highlights.set(fileId, set);
    } else {
      entry.add(cellPos);
    }
  }

  add_interface_implementations(filePath: string, position: vscode.Position, locations: vscode.Location[]): void {
    const location = new SymbolLocation(filePath, position);
    const implementations = locations.map(location => new SymbolLocation(location.uri.fsPath, location.range.start));
    this.interfaces.set(location, implementations);
  }

  generate_dot_source(): string {
    const files = this.files;

    // TODO: it's better to construct tables before fetching call hierarchy, so that we can skip the filtered out symbols.
    const tables: [number, TableNode][] = Array.from(files.values()).map(file => {
      const table = this.lang.fileRepr(file);
      const cells = this.highlights.get(file.id);
      if (cells) {
        table.highlightCells(cells);
      }
      return [file.id, table];
    });

    const cellIds = new Set<[number, number, number]>();
    tables.forEach(([tid, tbl]) => {
      tbl.sections.forEach(cell => this.collectCellIds(tid, cell, cellIds));
    });

    const updatedFiles = new Set<string>();
    const insertedSymbols = new Set<[number, number, number]>();

    const incomingCalls = Array.from(this.incomingCalls.entries()).flatMap(([callee, callers]) => {
      const to = callee.locationId(files);
      if (!to || !cellIds.has(to)) return [];

      return callers.map(call => {
        let updated;
        //const from = call.from.locationId(files);
        const from = locationIdHierarchyItem(call.from, call.from.uri.fsPath, files);
        if (from) {
          const fileOutline = files.get(call.from.uri.fsPath);
          if (fileOutline) {
            updated = cellIds.has(from) || insertedSymbols.has(from) || this.tryInsertSymbol(call.from, fileOutline);
            if (updated) {
              updatedFiles.add(call.from.uri.fsPath);
              insertedSymbols.add(from);

              return new Edge(from, to, []);
            }
          }
        }

        return null;
      }).filter(edge => edge !== null);
    });

    const outgoingCalls = Array.from(this.outgoingCalls.entries()).flatMap(([caller, callees]) => {
      const from = caller.locationId(files);
      if (!from || !cellIds.has(from)) return [];

      return callees.map(call => {
        //const to = call.to.locationId(files);
        const to = locationIdHierarchyItem(call.to, call.to.uri.fsPath, files);
        if (to) {
          return cellIds.has(to) ? new Edge(from, to, []) : null;
        }

        return null;
      }).filter(edge => edge !== null);
    });

    const implementations = Array.from(this.interfaces.entries()).flatMap(([interfaceLoc, implementations]) => {
      const to = interfaceLoc.locationId(files);
      if (!to || !cellIds.has(to)) return [];

      return implementations.map(location => {
        const from = location.locationId(files);
        if (from) {
          return cellIds.has(from) ? new Edge(from, to, [CssClass.Impl]) : null;
        }
        
        return null;
      }).filter(edge => edge !== null);
    });

    const edgesCombined = [...incomingCalls, ...outgoingCalls, ...implementations];
    const edges: Edge[] = [];
    edgesCombined.map(e => {
      if (e) {
        edges.push(e);
      }
    });

    updatedFiles.forEach(path => {
      const file = files.get(path);
      if (file) {
        const table = tables.find(([id]) => id === file.id);
        if (table) {
          table[1] = this.lang.fileRepr(file);
        }
      }
    });

    const subgraphs = this.subgraphs(files.values());

    return Dot.generateDotSourceString(tables.map(([_, tbl]) => tbl), edges, subgraphs);
  }

  subgraphs(files: Iterable<FileOutline>): Subgraph[] {
    const dirs = new Map<string, string[]>();

    for (const f of files) {
      const parent = path.dirname(f.path);

      if (!dirs.has(parent)) {
        dirs.set(parent, []);
      }
      const parentElement = dirs.get(parent);
      if (parentElement) {
        parentElement.push(f.path);
      }
    }

    const subgraphs: Subgraph[] = [];

    dirs.forEach((files, dir) => {
      const nodes: string[] = [];
      files.map(path => {
        const fileOutline = this.files.get(path);
        if (fileOutline) {
          nodes.push(fileOutline.id.toString());
        }
      });

      const dirPrefix = dir.replace(this.root, '') || dir;
      this.addSubgraph(dirPrefix, nodes, subgraphs);
    });

    return subgraphs;
  }

  addSubgraph(dir: string, nodes: string[], subgraphs: Subgraph[]): void {
    const ancestor = subgraphs.find(g => dir.startsWith(g.title));

    if (!ancestor) {
      subgraphs.push(new Subgraph(dir, nodes, []));
    } else {
      const dirPrefix = dir.replace(ancestor.title, '');
      this.addSubgraph(dirPrefix, nodes, ancestor.subgraphs);
    }
  }

  collectCellIds(tableId: number, cell: Cell, ids: Set<[number, number, number]>): void {
    ids.add([tableId, cell.rangeStart[0], cell.rangeStart[1]]);
    cell.children.forEach(child => this.collectCellIds(tableId, child, ids));
  }

  tryInsertSymbol(item: vscode.CallHierarchyItem, file: FileOutline): boolean {
    let symbols = file.symbols;
    let isSubsymbol = false;

    while (true) {
      const i = symbols.findIndex(symbol => symbol.range.start === item.range.start);
      if (i !== -1) return true; // should be unreachable

      if (i > 0) {
        const symbol = symbols[i - 1];
        if (symbol.range.end > item.range.end) {
          // we just deal with nested functions here
          if (![vscode.SymbolKind.Function, vscode.SymbolKind.Method].includes(symbol.kind)) {
            return false;
          }
          isSubsymbol = true;

          symbols = symbols[i - 1].children;
          continue;
        }
      }

      if (isSubsymbol) {
        const children: vscode.DocumentSymbol[] = [];
        if (symbols[i]) {
          const nextSymbol = symbols[i];
          if (nextSymbol.range.start > item.range.start && nextSymbol.range.end < item.range.end) {
            const nextSymbol = symbols.splice(i, 1)[0];
            children.push(nextSymbol);
          }
        }

        const symbolNew = new vscode.DocumentSymbol(
          item.name,
          item.detail || 'No detail',
          item.kind,
          //item.tags,
          item.range,
          item.selectionRange
        );

        symbolNew.children = children;
        symbols.splice(i, 0, symbolNew);
      }

      return isSubsymbol;
    }
  }
}

import { HashMap, HashSet, BTreeMap, RefCell } from 'immutable';
import { EnumSet } from 'enumset';
import { Dot, Cell, CssClass, Edge, Subgraph } from './graph';
import { CallHierarchyIncomingCall, CallHierarchyItem, CallHierarchyOutgoingCall, DocumentSymbol, Location, Position, SymbolKind } from './lsp_types.ts.ignore';
import { languageHandler } from './lang';

export class GraphGenerator {
  // TODO: use a trie map to store files
  root: string;
  files: HashMap<string, FileOutline>;
  nextFileId: number;
  
  lang: Language;

  incomingCalls: HashMap<SymbolLocation, CallHierarchyIncomingCall[]>;
  outgoingCalls: HashMap<SymbolLocation, CallHierarchyOutgoingCall[]>;
  interfaces: HashMap<SymbolLocation, SymbolLocation[]>;

  highlights: HashMap<number, HashSet<[number, number]>>;

  constructor(root: string, lang: string) {
    this.root = root;
    this.files = HashMap<string, FileOutline>();
    this.nextFileId = 1;
    this.incomingCalls = HashMap<SymbolLocation, CallHierarchyIncomingCall[]>();
    this.outgoingCalls = HashMap<SymbolLocation, CallHierarchyOutgoingCall[]>();
    this.interfaces = HashMap<SymbolLocation, SymbolLocation[]>();
    this.highlights = HashMap<number, HashSet<[number, number]>>();

    this.lang = languageHandler(lang);
  }

  shouldFilterOutFile(filePath: string): boolean {
    return this.lang.shouldFilterOutFile(filePath);
  }

  addFile(filePath: string, symbols: DocumentSymbol[]): boolean {
    if (this.lang.shouldFilterOutFile(filePath)) {
      return false;
    }

    const file = new FileOutline({
      id: this.nextFileId,
      path: new PathBuf(filePath),
      symbols,
    });

    const entry = this.files.get(filePath);
    if (!entry) {
      this.files.set(filePath, file);
      this.nextFileId += 1;
    } else {
      return false;
    }

    return true;
  }

  // TODO: graph database
  addIncomingCalls(filePath: string, position: Position, calls: CallHierarchyIncomingCall[]): void {
    const location = SymbolLocation.new(filePath, position);
    this.incomingCalls.set(location, calls);
  }

  addOutgoingCalls(filePath: string, position: Position, calls: CallHierarchyOutgoingCall[]): void {
    const location = SymbolLocation.new(filePath, position);
    this.outgoingCalls.set(location, calls);
  }

  highlight(filePath: string, position: Position): void {
    const fileId = this.files.get(filePath)?.id;
    if (fileId === undefined) return;

    const cellPos: [number, number] = [position.line, position.character];

    const entry = this.highlights.get(fileId);
    if (!entry) {
      const set = new HashSet<[number, number]>();
      set.add(cellPos);
      this.highlights.set(fileId, set);
    } else {
      entry.add(cellPos);
    }
  }

  addInterfaceImplementations(filePath: string, position: Position, locations: Location[]): void {
    const location = SymbolLocation.new(filePath, position);
    const implementations = locations.map(location => SymbolLocation.new(location.uri.path, location.range.start));
    this.interfaces.set(location, implementations);
  }

  generateDotSource(): string {
    const files = this.files;

    // TODO: it's better to construct tables before fetching call hierarchy, so that we can skip the filtered out symbols.
    const tables = Array.from(files.values()).map(file => {
      const table = this.lang.fileRepr(file);
      const cells = this.highlights.get(file.id);
      if (cells) {
        table.highlightCells(cells);
      }
      return [file.id, table];
    });

    const cellIds = new HashSet();
    tables.forEach(([tid, tbl]) => {
      tbl.sections.forEach(cell => this.collectCellIds(tid, cell, cellIds));
    });

    const updatedFiles = new RefCell(new HashSet());
    const insertedSymbols = new RefCell(new HashSet());

    const incomingCalls = Array.from(this.incomingCalls.entries()).flatMap(([callee, callers]) => {
      const to = callee.locationId(files);
      if (!cellIds.has(to)) return [];

      return callers.map(call => {
        const from = call.from.locationId(files);
        const updated = cellIds.has(from) || insertedSymbols.borrow().has(from) || this.tryInsertSymbol(call.from, files.get(call.from.uri.path));

        if (updated) {
          updatedFiles.borrowMut().add(call.from.uri.path);
          insertedSymbols.borrowMut().add(from);
        }

        return updated ? new Edge({ from, to, classes: new EnumSet() }) : null;
      }).filter(edge => edge !== null);
    });

    const outgoingCalls = Array.from(this.outgoingCalls.entries()).flatMap(([caller, callees]) => {
      const from = caller.locationId(files);
      if (!cellIds.has(from)) return [];

      return callees.map(call => {
        const to = call.to.locationId(files);
        return cellIds.has(to) ? new Edge({ from, to, classes: new EnumSet() }) : null;
      }).filter(edge => edge !== null);
    });

    const implementations = Array.from(this.interfaces.entries()).flatMap(([interfaceLoc, implementations]) => {
      const to = interfaceLoc.locationId(files);
      if (!cellIds.has(to)) return [];

      return implementations.map(location => {
        const from = location.locationId(files);
        return cellIds.has(from) ? new Edge({ from, to, classes: CssClass.Impl }) : null;
      }).filter(edge => edge !== null);
    });

    const edges = [...incomingCalls, ...outgoingCalls, ...implementations];

    updatedFiles.borrow().forEach(path => {
      const file = files.get(path);
      const table = tables.find(([id]) => id === file.id);
      if (table) {
        table[1] = this.lang.fileRepr(file);
      }
    });

    const subgraphs = this.subgraphs(files.values());

    return Dot.generateDotSource(tables.map(([_, tbl]) => tbl), edges, subgraphs);
  }

  subgraphs(files: Iterable<FileOutline>): Subgraph[] {
    const dirs = new BTreeMap();
    for (const f of files) {
      const parent = f.path.parent();
      if (!dirs.has(parent)) {
        dirs.set(parent, []);
      }
      dirs.get(parent).push(f.path);
    }

    const subgraphs: Subgraph[] = [];

    dirs.forEach((files, dir) => {
      const nodes = files.map(path => this.files.get(path.toString()).id.toString());
      const dirPrefix = dir.stripPrefix(this.root) || dir;
      this.addSubgraph(dirPrefix, nodes, subgraphs);
    });

    return subgraphs;
  }

  addSubgraph(dir: Path, nodes: string[], subgraphs: Subgraph[]): void {
    const ancestor = subgraphs.find(g => dir.startsWith(g.title));

    if (!ancestor) {
      subgraphs.push(new Subgraph({ title: dir.toString(), nodes, subgraphs: [] }));
    } else {
      const dirPrefix = dir.stripPrefix(ancestor.title);
      this.addSubgraph(dirPrefix, nodes, ancestor.subgraphs);
    }
  }

  collectCellIds(tableId: number, cell: Cell, ids: HashSet<[number, number, number]>): void {
    ids.add([tableId, cell.rangeStart[0], cell.rangeStart[1]]);
    cell.children.forEach(child => this.collectCellIds(tableId, child, ids));
  }

  tryInsertSymbol(item: CallHierarchyItem, file: FileOutline): boolean {
    let symbols = file.symbols;
    let isSubsymbol = false;

    while (true) {
      const i = symbols.findIndex(symbol => symbol.range.start === item.range.start);
      if (i !== -1) return true; // should be unreachable

      if (i > 0) {
        const symbol = symbols[i - 1];
        if (symbol.range.end > item.range.end) {
          // we just deal with nested functions here
          if (![SymbolKind.Function, SymbolKind.Method].includes(symbol.kind)) {
            return false;
          }
          isSubsymbol = true;

          symbols = symbols[i - 1].children;
          continue;
        }
      }

      if (isSubsymbol) {
        const children: DocumentSymbol[] = [];
        if (symbols[i]) {
          const nextSymbol = symbols[i];
          if (nextSymbol.range.start > item.range.start && nextSymbol.range.end < item.range.end) {
            const nextSymbol = symbols.splice(i, 1)[0];
            children.push(nextSymbol);
          }
        }

        symbols.splice(i, 0, new DocumentSymbol({
          name: item.name,
          detail: item.detail,
          kind: item.kind,
          tags: item.tags,
          range: item.range,
          selectionRange: item.selectionRange,
          children,
        }));
      }

      return isSubsymbol;
    }
  }
}

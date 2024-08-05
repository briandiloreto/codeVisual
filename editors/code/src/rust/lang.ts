import { FileOutline, TableNode, Cell, CssClass, Style } from './graph';
import { DocumentSymbol, SymbolKind } from 'vscode-languageserver-types';

interface Language {
    shouldFilterOutFile(file: string): boolean;
    fileRepr(file: FileOutline): TableNode;
    symbolRepr(fileId: number, symbol: DocumentSymbol): Cell;
    filterSymbol(symbol: DocumentSymbol): boolean;
    symbolStyle(symbol: DocumentSymbol): Style;
}

class DefaultLang implements Language {
    shouldFilterOutFile(file: string): boolean {
        return false;
    }

    fileRepr(file: FileOutline): TableNode {
        const sections = file.symbols
            .filter(symbol => this.filterSymbol(symbol))
            .map(symbol => this.symbolRepr(file.id, symbol));

        return {
            id: file.id,
            title: file.path.split('/').pop() || '',
            sections: sections,
        };
    }

    symbolRepr(fileId: number, symbol: DocumentSymbol): Cell {
        const children = symbol.children
            .filter(s => symbol.kind === SymbolKind.Interface || this.filterSymbol(s))
            .map(symbol => this.symbolRepr(fileId, symbol));

        const range = symbol.selectionRange;

        return {
            rangeStart: { line: range.start.line, character: range.start.character },
            rangeEnd: { line: range.end.line, character: range.end.character },
            style: this.symbolStyle(symbol),
            title: symbol.name,
            children: children,
        };
    }

    filterSymbol(symbol: DocumentSymbol): boolean {
        switch (symbol.kind) {
            case SymbolKind.Constant:
            case SymbolKind.Variable:
            case SymbolKind.Field:
            case SymbolKind.Property:
            case SymbolKind.EnumMember:
                return false;
            default:
                return true;
        }
    }

    symbolStyle(symbol: DocumentSymbol): Style {
        switch (symbol.kind) {
            case SymbolKind.Module:
                return {
                    rounded: true,
                    classes: CssClass.Cell | CssClass.Module,
                };
            case SymbolKind.Function:
                return {
                    rounded: true,
                    classes: CssClass.Cell | CssClass.Function | CssClass.Clickable,
                };
            case SymbolKind.Method:
                return {
                    rounded: true,
                    classes: CssClass.Cell | CssClass.Method | CssClass.Clickable,
                };
            case SymbolKind.Constructor:
                return {
                    rounded: true,
                    classes: CssClass.Cell | CssClass.Constructor | CssClass.Clickable,
                };
            case SymbolKind.Interface:
                return {
                    border: 0,
                    rounded: true,
                    classes: CssClass.Cell | CssClass.Interface | CssClass.Clickable,
                };
            case SymbolKind.Enum:
                return {
                    icon: 'E',
                    classes: CssClass.Cell | CssClass.Type,
                };
            case SymbolKind.Struct:
                return {
                    icon: 'S',
                    classes: CssClass.Cell | CssClass.Type,
                };
            case SymbolKind.Class:
                return {
                    icon: 'C',
                    classes: CssClass.Cell | CssClass.Type,
                };
            case SymbolKind.TypeParameter:
                return {
                    icon: 'T',
                    classes: CssClass.Cell | CssClass.Type,
                };
            case SymbolKind.Field:
                return {
                    icon: 'f',
                    classes: CssClass.Cell | CssClass.Property,
                };
            case SymbolKind.Property:
                return {
                    icon: 'p',
                    classes: CssClass.Cell | CssClass.Property,
                };
            default:
                return {
                    rounded: true,
                    classes: CssClass.Cell,
                };
        }
    }
}

export function languageHandler(lang: string): Language {
    switch (lang) {
        case 'Go':
            return new Go();
        case 'Rust':
            return new Rust();
        default:
            return new DefaultLang();
    }
}



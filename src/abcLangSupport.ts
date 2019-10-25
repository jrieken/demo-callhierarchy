import * as vscode from "vscode";
import { WSASERVICE_NOT_FOUND } from "constants";



class AbcLangSyntxTree {

    constructor(
        readonly document: vscode.TextDocument,
        readonly docVersion = document.version,
        readonly functions: AbcLangFunc[] = []
    ) { }
}

interface AbcLangFunc {
    tree: AbcLangSyntxTree;
    name: string;
    fullStart: vscode.Position;
    fullEnd: vscode.Position;
    nameStart: vscode.Position;
    nameEnd: vscode.Position;
    bodyStart: vscode.Position;
    bodyEnd: vscode.Position;
}

class AbcLangParser {

    parse(doc: vscode.TextDocument): AbcLangSyntxTree {
        const tree = new AbcLangSyntxTree(doc);

        // parse functions
        let funcStart = /^func (\w+)\s*{/;
        let func: Partial<AbcLangFunc> | undefined;
        for (let line = 0; line < doc.lineCount; line++) {
            const textLine = doc.lineAt(line);
            if (!func) {
                const match = funcStart.exec(textLine.text);
                if (match) {
                    func = {
                        tree: tree,
                        name: match[1],
                        fullStart: textLine.range.start,
                        nameStart: textLine.range.start.translate(0, 5),
                        nameEnd: textLine.range.start.translate(0, 5 + match[1].length),
                        bodyStart: new vscode.Position(line + 1, 0)
                    };
                }
            } else {
                if (textLine.text === '}') {
                    func.bodyEnd = textLine.range.start;
                    func.fullEnd = textLine.range.end;
                    tree.functions.push(func as AbcLangFunc);
                    func = undefined;
                }
            }
        }
        return tree;
    }
}

export class AbcLangLanguageService {

    private readonly _trees = new Map<string, AbcLangSyntxTree>();

    *allFunctions() {
        for (const value of this._trees.values()) {
            yield* value.functions;
        }
    }

    findByName(name: string): AbcLangFunc | undefined {
        for (const value of this._trees.values()) {
            const func = value.functions.find(func => func.name === name);
            if (func) {
                return func;
            }
        }
    }

    find(document: vscode.TextDocument, position: vscode.Position): AbcLangFunc | undefined {
        const range = document.getWordRangeAtPosition(position);
        if (!range) {
            return undefined;
        }
        const word = document.getText(range);
        this.ensureTree(document);
        return this.findByName(word);
    }

    ensureTree(document: vscode.TextDocument) {
        let key = document.uri.toString();
        let tree = this._trees.get(key);
        if (!tree || tree.docVersion !== document.version) {
            tree = new AbcLangParser().parse(document);
            this._trees.set(document.uri.toString(), tree);
        }
        return tree;
    }
}

//#region -- outline

export class AbcLangDocumentSymbols implements vscode.DocumentSymbolProvider {

    constructor(private _service: AbcLangLanguageService) { }

    provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SymbolInformation[] | vscode.DocumentSymbol[]> {
        const syntaxTree = this._service.ensureTree(document);
        return syntaxTree.functions.map(func => {
            return new vscode.DocumentSymbol(
                func.name,
                '',
                vscode.SymbolKind.Function,
                new vscode.Range(func.fullStart, func.fullEnd),
                new vscode.Range(func.nameStart, func.nameEnd)
            );
        });
    }
}

//#region -- call hierarchy

class MyItem extends vscode.CallHierarchyItem {

    constructor(
        readonly func: AbcLangFunc
    ) {
        super(
            vscode.SymbolKind.Function,
            func.name,
            '',
            func.tree.document.uri,
            new vscode.Range(func.fullStart, func.fullEnd),
            new vscode.Range(func.nameStart, func.nameEnd)
        );
    }
}

export class AbcLangHierarchyProvider implements vscode.CallHierarchyItemProvider {

    constructor(private _service: AbcLangLanguageService) { }

    resolveCallHierarchyItem(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CallHierarchyItem> {
        const range = document.getWordRangeAtPosition(position);
        if (!range) {
            return undefined;
        }

        const name = document.getText(range);
        const func = this._service.findByName(name);
        if (!func) {
            return undefined;
        }
        return new MyItem(func);
    }

    prepareCallHierarchy(document: vscode.TextDocument, position: vscode.Position) {
        const anchor = this._service.find(document, position);
        if (!anchor) {
            return undefined;
        }
        return new MyItem(anchor);
    }

    provideCallHierarchyOutgoingCalls(item: vscode.CallHierarchyItem) {
        if (!(item instanceof MyItem)) {
            return undefined;
        }
        // find all names inside body
        const allFuncNames = [...this._service.allFunctions()].map(func => func.name).sort().reverse();
        const calls = this._findCalls(item.func, item.func.tree, allFuncNames);
        const result: vscode.CallHierarchyOutgoingCall[] = [];
        for (const call of calls) {
            if (call.func) {
                result.push(new vscode.CallHierarchyOutgoingCall(new MyItem(call.func), call.ranges));
            }
        }
        return result;
    }

    provideCallHierarchyIncomingCalls(item: vscode.CallHierarchyItem) {
        if (!(item instanceof MyItem)) {
            return undefined;
        }
        const result: vscode.CallHierarchyIncomingCall[] = [];
        for (const func of this._service.allFunctions()) {
            const calls = this._findCalls(func, func.tree, [item.func.name]);
            if (calls.length === 1) {
                result.push(new vscode.CallHierarchyIncomingCall(new MyItem(func), calls[0].ranges));
            }
        }
        return result;
    }

    private _findCalls(func: AbcLangFunc, tree: AbcLangSyntxTree, names: string[]) {

        const body = tree.document.getText(new vscode.Range(func.bodyStart, func.bodyEnd));

        // find all names inside body
        const result: { func: AbcLangFunc | undefined, ranges: vscode.Range[] }[] = [];
        const offset = tree.document.offsetAt(func.bodyStart);

        for (const name of names) {
            let sourceRanges: vscode.Range[] = [];
            let pos = 0;
            while (true) {
                let index = body.indexOf(name, pos);
                if (index < 0) {
                    break;
                }

                const start = tree.document.positionAt(offset + index);
                const end = tree.document.positionAt(offset + index + name.length);
                sourceRanges.push(new vscode.Range(start, end));
                pos = index + name.length;
            }
            if (sourceRanges.length > 0) {
                result.push({ func: this._service.findByName(name), ranges: sourceRanges });
            }
        }

        return result;
    }
}

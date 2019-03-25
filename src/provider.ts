import * as vscode from "vscode";


interface MyItem extends vscode.CallHierarchyItem {
    uri: vscode.Uri;
}

export class FakeCallHierarchyProvider implements vscode.CallHierarchyItemProvider {


    async provideCallHierarchyItem(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.CallHierarchyItem | undefined> {

        const definitions = await vscode.commands.executeCommand<vscode.Location[]>('vscode.executeDefinitionProvider', document.uri, position);
        if (!definitions || definitions.length === 0) {
            console.info('no definition...');
            return undefined;
        }

        return await this.getItemAtPosition(definitions[0].uri, definitions[0].range.start);
    }

    async resolveCallHierarchyItem(anchor: MyItem, direction: vscode.CallHierarchyDirection, token: vscode.CancellationToken): Promise<[vscode.CallHierarchyItem, vscode.Location[]][]> {

        if (direction === vscode.CallHierarchyDirection.CallsFrom) {
            return [];
        }

        // item.selectionRange
        const references = await vscode.commands.executeCommand<vscode.Location[]>('vscode.executeReferenceProvider', anchor.uri, anchor.selectionRange.start);

        if (!references) {
            console.info('no references...');
            return [];
        }

        const map = new Map<string, vscode.Location[]>();

        for (const ref of references) {
            let array = map.get(ref.uri.toString());
            if (array) {
                array.push(ref);
            } else {
                map.set(ref.uri.toString(), [ref]);
            }
        }

        let result: [vscode.CallHierarchyItem, vscode.Location[]][] = [];
        for (const [, locations] of map) {
            locations.sort((a, b) => a.range.start.compareTo(b.range.start));

            for (const loc of locations) {
                const target = await this.getItemAtPosition(loc.uri, loc.range.start);
                if (target) {
                    result.push([target, [loc]]);
                }
            }
        }

        // compact
        let last: [vscode.CallHierarchyItem, vscode.Location[]] | undefined
        for (let i = 0; i < result.length; i++) {
            const element = result[i];
            if (last && last[0].range.isEqual(element[0].range)) {
                last[1].push(...element[1]);
                result[i] = undefined!;
            } else {
                last = element;
            }
        }

        let res = result.filter(item => {
            if (!item) {
                return false; // compacted
            }
            if (item[0].range.isEqual(anchor.range)) {
                return false; // reference equals declaration
            }
            return true;
        });

        return res;
    }

    private async getItemAtPosition(uri: vscode.Uri, position: vscode.Position): Promise<MyItem | undefined> {

        const outline = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', uri);

        function find(symbols: vscode.DocumentSymbol[] | undefined, position: vscode.Position, best?: vscode.DocumentSymbol): vscode.DocumentSymbol | undefined {
            if (symbols) {
                for (const symbol of symbols) {
                    if (symbol.range.contains(position) && symbol.kind !== vscode.SymbolKind.Variable) {
                        if (!best || best.range.contains(symbol.range)) {
                            best = find(symbol.children, position, symbol);
                        }
                    }
                }
            }
            return best;
        }

        let item = find(outline, position);
        if (!item) {
            console.log('no outline...');
            return;
        };
        return { uri, ...item }
    }
}

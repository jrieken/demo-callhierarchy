import * as vscode from 'vscode';
import * as abcLang from './abcLangSupport';

export function activate(context: vscode.ExtensionContext) {

	const abcBrain = new abcLang.AbcLangLanguageService();
	vscode.workspace.textDocuments.forEach(doc => doc.languageId === 'abc' && abcBrain.ensureTree(doc));
	vscode.workspace.onDidOpenTextDocument(doc => abcBrain.ensureTree(doc));
	vscode.workspace.onDidChangeTextDocument(e => abcBrain.ensureTree(e.document));

	vscode.languages.registerDocumentSymbolProvider('abc', new abcLang.AbcLangDocumentSymbols(abcBrain));
	vscode.languages.registerCallHierarchyProvider('abc', new abcLang.AbcLangHierarchyProvider(abcBrain));

}

import * as vscode from 'vscode';
import { FakeCallHierarchyProvider } from './provider';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.languages.registerCallHierarchyProvider(
		{ language: 'typescript' },
		new FakeCallHierarchyProvider()
	));
}

import * as vscode from 'vscode';

import { initSync, set_panic_hook } from '../codevisual';
import { CallGraphPanel } from './webview';
import { CommandManager } from './command-manager';

export async function activate(context: vscode.ExtensionContext) {
	await vscode.workspace.fs.readFile(
		vscode.Uri.joinPath(context.extensionUri, 'codevisual/index_bg.wasm')
	).then(bits => {
		initSync(bits);
		set_panic_hook();
	});

	let manager = new CommandManager(context);
  
	context.subscriptions.push(
		//vscode.commands.registerCommand('codevisual.generateCallGraph', manager.generateCallGraph.bind(manager)),
    	vscode.commands.registerCommand('codevisual.generateCallGraph', manager.generateCallGraphTest.bind(manager)),
		vscode.commands.registerTextEditorCommand('codevisual.generateFuncCallGraph', manager.generateFuncCallGraph.bind(manager)),
		vscode.commands.registerCommand('codevisual.exportCallGraph', () => {
			CallGraphPanel.currentPanel?.exportSVG();
		}),
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}

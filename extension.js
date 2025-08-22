const vscode = require('vscode');
const path = require('path');
const cp = require('child_process');

let _activeTerminal = null;
let _replProcess = null;
let _replChannel = null;
vscode.window.onDidCloseTerminal((terminal) => {
    if (terminal.name === 'SuperCollider') {
        if (!terminal.tckDisposed) {
            disposeTerminal();
        }
    }
});
function createTerminal() {
    _activeTerminal = vscode.window.createTerminal('SuperCollider');
    return _activeTerminal;
}
function disposeTerminal() {
    _activeTerminal.tckDisposed = true;
    _activeTerminal.dispose();
    _activeTerminal = null;
}
function getTerminal() {
    if (!_activeTerminal) {
        createTerminal();
    }

    return _activeTerminal;
}
// END TERMINAL

// BEGIN REPL
function createRepl() {
    const scPath = vscode.workspace.getConfiguration().get('supercollider.sclangCmd') || 'sclang';
    _replChannel = vscode.window.createOutputChannel('SuperCollider REPL');
    _replProcess = cp.spawn(scPath, [], { stdio: 'pipe' });

    _replProcess.stdout.on('data', (data) => {
        _replChannel.append(data.toString());
    });
    _replProcess.stderr.on('data', (data) => {
        _replChannel.append(data.toString());
    });
    _replProcess.on('exit', () => {
        _replProcess = null;
    });
}

function disposeRepl() {
    if (_replProcess) {
        _replProcess.kill();
        _replProcess = null;
    }
    if (_replChannel) {
        _replChannel.dispose();
        _replChannel = null;
    }
}

function getRepl() {
    if (!_replProcess) {
        createRepl();
    }
    return _replProcess;
}

function evalSelection(editor) {
    const repl = getRepl();
    _replChannel.show(true);

    for (const selection of editor.selections) {
        const text = selection.isEmpty
            ? editor.document.lineAt(selection.active.line).text
            : editor.document.getText(selection);
        repl.stdin.write(text + String.fromCharCode(0x1b) + '\n');
    }
}
// END REPL

function resolve(editor, command) {
    const scPath = vscode.workspace.getConfiguration().get('supercollider.sclangCmd');
    return command
        .replace(/\${file}/g, `${editor.document.fileName}`)
        .replace(/\${sclangCmd}/g, scPath)
}

function run(command) {
    const terminal = getTerminal();

    terminal.show(true);

    vscode.commands.executeCommand('workbench.action.terminal.scrollToBottom');
    terminal.sendText(command, true);
}

function warn(msg) {
    console.log('supercollider.execInTerminal: ', msg)
}

function handleInput(editor) {
    vscode.workspace.saveAll(false);
    let command = "${sclangCmd} ${file}";
    const cmd = resolve(
        editor,
        command
    )

    run(cmd);
}

function activate(context) {
    let execInTerminal = vscode.commands.registerCommand('supercollider.execInTerminal', () => {
        const editor = vscode.window.activeTextEditor
        if (!editor) {
            warn('no active editor');
            return;
        }

        handleInput(editor)
    });
    context.subscriptions.push(execInTerminal);

    let killTerminal = vscode.commands.registerCommand('supercollider.killTerminal', () => {
        if(_activeTerminal)
            disposeTerminal();
    });
    context.subscriptions.push(killTerminal);

    let replEval = vscode.commands.registerCommand('supercollider.eval', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            warn('no active editor');
            return;
        }
        evalSelection(editor);
    });
    context.subscriptions.push(replEval);
}
exports.activate = activate;

function deactivate() {
    disposeTerminal();
    disposeRepl();
}
exports.deactivate = deactivate;
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const owlParser_1 = require("./owlParser");
const visualizationPanel_1 = require("./visualizationPanel");
let activePanel;
let fileWatcher;
let currentFilePath;
function activate(context) {
    console.log('OWL Ontology Visualizer is now active!');
    const disposable = vscode.commands.registerCommand('owl-visualizer.visualize', async (uri) => {
        try {
            let filePath;
            if (uri) {
                filePath = uri.fsPath;
            }
            else {
                // If no URI provided, try to get from active editor
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor) {
                    vscode.window.showErrorMessage('No OWL file selected');
                    return;
                }
                filePath = activeEditor.document.fileName;
            }
            // Check if file exists and has .owl, .rdf, or .ttl extension
            if (!fs.existsSync(filePath)) {
                vscode.window.showErrorMessage('File not found');
                return;
            }
            const ext = path.extname(filePath).toLowerCase();
            if (ext !== '.owl' && ext !== '.rdf' && ext !== '.ttl') {
                vscode.window.showErrorMessage('Please select an OWL, RDF, or TTL file');
                return;
            }
            currentFilePath = filePath;
            await visualizeFile(filePath, context, false, true); // false = not auto-update, true = split right
            setupFileWatcher(filePath, context);
        }
        catch (error) {
            console.error('Error in visualize command:', error);
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
    context.subscriptions.push(disposable);
}
async function visualizeFile(filePath, context, isAutoUpdate = false, shouldSplitRight = false) {
    if (isAutoUpdate) {
        // For auto-updates, skip the progress notification and just update silently
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const parser = new owlParser_1.OWLParser();
            const ontologyData = await parser.parse(fileContent);
            // Create or update the visualization panel
            if (!activePanel) {
                activePanel = new visualizationPanel_1.VisualizationPanel(context.extensionUri);
            }
            activePanel.show(ontologyData, path.basename(filePath), false, true, false); // forceReveal=false, isAutoUpdate=true, shouldSplitRight=false
        }
        catch (error) {
            console.error('Error parsing OWL file during auto-update:', error);
            // For auto-updates, don't show error popups - just log to console
        }
    }
    else {
        // For manual updates, show progress indicator
        const progressOptions = {
            location: vscode.ProgressLocation.Notification,
            title: "Parsing OWL ontology...",
            cancellable: false
        };
        await vscode.window.withProgress(progressOptions, async (progress) => {
            try {
                // Read and parse the OWL file
                const fileContent = fs.readFileSync(filePath, 'utf8');
                const parser = new owlParser_1.OWLParser();
                const ontologyData = await parser.parse(fileContent);
                progress.report({ increment: 50, message: "Creating visualization..." });
                // Create or update the visualization panel
                if (!activePanel) {
                    activePanel = new visualizationPanel_1.VisualizationPanel(context.extensionUri);
                }
                // Only force reveal on manual commands
                // Pass shouldSplitRight to control panel placement
                activePanel.show(ontologyData, path.basename(filePath), true, false, shouldSplitRight); // forceReveal=true, isAutoUpdate=false
                progress.report({ increment: 100, message: "Complete" });
            }
            catch (error) {
                console.error('Error parsing OWL file:', error);
                vscode.window.showErrorMessage(`Error parsing OWL file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }
}
function setupFileWatcher(filePath, context) {
    // Dispose existing watcher
    if (fileWatcher) {
        fileWatcher.dispose();
    }
    // Create new file watcher
    const pattern = new vscode.RelativePattern(path.dirname(filePath), path.basename(filePath));
    fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
    fileWatcher.onDidChange(async () => {
        if (activePanel && currentFilePath && activePanel.isVisible()) {
            console.log('File changed, updating visualization...');
            await visualizeFile(currentFilePath, context, true, false); // true = isAutoUpdate, false = don't split right for updates
        }
    });
    fileWatcher.onDidDelete(() => {
        vscode.window.showWarningMessage('The watched OWL file has been deleted.');
        if (fileWatcher) {
            fileWatcher.dispose();
            fileWatcher = undefined;
        }
    });
    context.subscriptions.push(fileWatcher);
}
function deactivate() {
    if (fileWatcher) {
        fileWatcher.dispose();
    }
}
//# sourceMappingURL=extension.js.map
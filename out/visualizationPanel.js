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
exports.VisualizationPanel = void 0;
const vscode = __importStar(require("vscode"));
class VisualizationPanel {
    panel;
    extensionUri;
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
    }
    show(ontologyData, fileName, forceReveal = true, isAutoUpdate = false, shouldSplitRight = false) {
        console.log('VisualizationPanel.show called with:', ontologyData);
        // Determine column placement
        let columnToShowIn;
        if (shouldSplitRight) {
            // For new panels, split to the right of the active editor
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                columnToShowIn = activeEditor.viewColumn === vscode.ViewColumn.One
                    ? vscode.ViewColumn.Two
                    : vscode.ViewColumn.Three;
            }
            else {
                columnToShowIn = vscode.ViewColumn.Two;
            }
        }
        else {
            // Use existing logic for updates
            columnToShowIn = vscode.window.activeTextEditor
                ? vscode.window.activeTextEditor.viewColumn || vscode.ViewColumn.One
                : vscode.ViewColumn.One;
        }
        if (this.panel && isAutoUpdate) {
            // For auto-updates, ONLY update the data via message passing
            this.updateVisualizationData(ontologyData);
            return; // Exit early, don't do anything else
        }
        if (this.panel) {
            // For manual updates when panel exists, regenerate the HTML
            this.panel.webview.html = this.getWebviewContent(ontologyData, fileName, isAutoUpdate);
            // Only reveal if explicitly requested (e.g., first time opening)
            if (forceReveal) {
                this.panel.reveal(columnToShowIn);
            }
        }
        else {
            // Create new panel
            this.panel = vscode.window.createWebviewPanel('owlVisualization', `OWL Visualization - ${fileName}`, columnToShowIn, {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.extensionUri]
            });
            this.panel.onDidDispose(() => {
                this.panel = undefined;
            }, null);
            this.panel.webview.html = this.getWebviewContent(ontologyData, fileName, isAutoUpdate);
        }
    }
    updateVisualizationData(ontologyData) {
        // Send a message to the webview to update the data
        if (this.panel) {
            console.log('Sending updateData message to webview with', ontologyData.nodes.length, 'nodes');
            this.panel.webview.postMessage({
                command: 'updateData',
                data: ontologyData
            });
        }
        else {
            console.error('Cannot update visualization data: panel is undefined');
        }
    }
    isVisible() {
        return this.panel !== undefined;
    }
    dispose() {
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }
    }
    getWebviewContent(ontologyData, fileName, isAutoUpdate = false) {
        // Get VS Code theme colors
        const isDarkTheme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
        const isHighContrast = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast;
        // Create theme-aware color configuration
        const themeColors = {
            isDark: isDarkTheme,
            isHighContrast: isHighContrast,
            // Default colors that work well in both themes
            classColor: isDarkTheme ? '#22CC22' : '#1B8E1B',
            propertyColor: isDarkTheme ? '#3399FF' : '#0066CC',
            individualColor: isDarkTheme ? '#FF9933' : '#CC6600',
            ontologyColor: isDarkTheme ? '#CC66CC' : '#9933AA',
            defaultColor: isDarkTheme ? '#888888' : '#666666',
            // Edge colors
            subClassColor: isDarkTheme ? '#22CC22' : '#1B8E1B',
            subPropertyColor: isDarkTheme ? '#3399FF' : '#0066CC',
            domainColor: isDarkTheme ? '#FF4444' : '#CC3333',
            rangeColor: isDarkTheme ? '#FF9933' : '#CC6600',
            defaultEdgeColor: isDarkTheme ? '#AAAAAA' : '#666666',
            // Text colors
            nodeTextColor: isDarkTheme ? '#FFFFFF' : '#000000',
            edgeTextColor: isDarkTheme ? '#FFFFFF' : '#000000',
            textOutlineColor: isDarkTheme ? '#000000' : '#FFFFFF',
            // Background colors
            backgroundColor: isDarkTheme ? '#1E1E1E' : '#FFFFFF',
            panelBackground: isDarkTheme ? '#252526' : '#F3F3F3'
        };
        // Create a URI for the styles file
        const stylesUri = this.panel?.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'out', 'styles.js') // Changed from 'src' to 'out'
        );
        // Escape the data to prevent template literal issues
        const dataStr = JSON.stringify(ontologyData).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\${/g, '\\${');
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OWL Ontology Visualization</title>
    <script src="https://unpkg.com/cytoscape@3.26.0/dist/cytoscape.min.js"></script>
    <script src="https://unpkg.com/dagre@0.8.5/dist/dagre.min.js"></script>
    <script src="https://unpkg.com/cytoscape-dagre@2.5.0/cytoscape-dagre.js"></script>
    <script src="${stylesUri}"></script>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 13px;
            margin: 0;
            padding: 0;
            background-color: ${themeColors.backgroundColor};
            color: ${isDarkTheme ? '#CCCCCC' : '#333333'};
        }
        
        #container {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        
        #header {
            padding: 10px 20px;
            background-color: ${themeColors.panelBackground};
            border-bottom: 1px solid ${isDarkTheme ? '#3C3C3C' : '#E1E1E1'};
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        #title {
            font-size: 16px;
            font-weight: 600;
        }
        
        #controls {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        
        #layoutSelect {
            background-color: #3C3C3C;
            color: #CCCCCC;
            border: 1px solid #3C3C3C;
            border-radius: 3px;
            padding: 4px 8px;
        }
        
        button {
            background-color: #0E639C;
            color: white;
            border: none;
            border-radius: 3px;
            padding: 6px 12px;
            cursor: pointer;
            font-size: 12px;
        }
        
        button:hover {
            background-color: #1177BB;
        }
        
        #cy {
            flex: 1;
            background-color: #1E1E1E;
        }
        
        #info {
            position: absolute;
            top: 60px;
            right: 20px;
            background-color: #252526;
            border: 1px solid #3C3C3C;
            border-radius: 5px;
            padding: 15px;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            display: none;
        }
        
        #stats {
            position: absolute;
            bottom: 20px;
            left: 20px;
            background-color: #252526;
            border: 1px solid #3C3C3C;
            border-radius: 5px;
            padding: 10px;
            font-size: 12px;
        }
        
        #file-status {
            position: absolute;
            bottom: 20px;
            right: 20px;
            background-color: #252526;
            border: 1px solid #3C3C3C;
            border-radius: 5px;
            padding: 8px 12px;
            font-size: 11px;
            color: #CCCCCC;
        }
        
        .status-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 6px;
            background-color: #22AA22;
            transition: all 0.3s ease;
        }
        
        .status-indicator.updating {
            background-color: #FF8800;
            animation: pulse 1s ease-in-out;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.7; }
            100% { transform: scale(1); opacity: 1; }
        }
        
        .node-info h3 {
            margin: 0 0 8px 0;
            color: #CCCCCC;
        }
        
        .node-info p {
            margin: 4px 0;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div id="container">
        <div id="header">
            <div id="title">OWL Ontology: ${fileName}</div>
            <div id="controls">
                <select id="layoutSelect">
                    <option value="dagre">Hierarchical (Dagre)</option>
                    <option value="circle">Circle</option>
                    <option value="grid">Grid</option>
                    <option value="cose">Force-directed (CoSE)</option>
                    <option value="breadthfirst">Breadth-first</option>
                </select>
                <button onclick="fitGraph()">Fit to View</button>
                <button onclick="resetZoom()">Reset Zoom</button>
                <button onclick="redrawDiagram()">Redraw</button>
            </div>
        </div>
        
        <div id="cy"></div>
        
        <div id="info">
            <div id="nodeInfo" class="node-info"></div>
        </div>
        
        <div id="stats">
            <div>Classes: <span id="classCount">0</span></div>
            <div>Properties: <span id="propertyCount">0</span></div>
            <div>Individuals: <span id="individualCount">0</span></div>
            <div>Relations: <span id="edgeCount">0</span></div>
        </div>
        
        <div id="file-status">
            <span class="status-indicator" id="statusDot"></span>
            <span id="statusText">Auto-updating</span>
        </div>
    </div>

    <script>
        (function() {
            try {
                const ontologyData = JSON.parse('${dataStr}');
                
                console.log('Webview received ontology data:', ontologyData);
                console.log('Number of nodes:', ontologyData.nodes.length);
                console.log('Number of edges:', ontologyData.edges.length);
                
                if (typeof cytoscape === 'undefined') {
                    console.error('Cytoscape library not loaded');
                    document.getElementById('cy').innerHTML = '<div style="padding: 20px; color: red;">Error: Cytoscape library failed to load</div>';
                    return;
                }
                
                console.log('Creating Cytoscape instance...');
                
                const cy = cytoscape({
                    container: document.getElementById('cy'),
                    
                    elements: [
                        ...ontologyData.nodes.map(node => ({
                            data: {
                                id: node.id,
                                label: node.label,
                                type: node.type,
                                uri: node.uri
                            }
                        })),
                        ...ontologyData.edges.map(edge => ({
                            data: {
                                id: edge.id,
                                source: edge.source,
                                target: edge.target,
                                label: edge.label,
                                type: edge.type
                            }
                        }))
                    ],
                    
                    // Use the external styling configuration
                    style: OWL_VISUALIZATION_STYLES,
                    
                    layout: {
                        name: 'dagre',
                        directed: true,
                        padding: 30,
                        spacingFactor: 1.2,
                        rankDir: 'TB'
                    }
                });
                
                console.log('Cytoscape instance created successfully');
                console.log('Number of nodes in graph:', cy.nodes().length);
                console.log('Number of edges in graph:', cy.edges().length);
                
                window.cy = cy;
                window.currentLayout = 'dagre';
                
                cy.on('tap', 'node', function(evt) {
                    const node = evt.target;
                    const nodeData = node.data();
                    
                    const infoPanel = document.getElementById('info');
                    const nodeInfo = document.getElementById('nodeInfo');
                    
                    let html = '<h3>' + nodeData.label + '</h3>';
                    html += '<p><strong>Type:</strong> ' + nodeData.type + '</p>';
                    html += '<p><strong>ID:</strong> ' + nodeData.id + '</p>';
                    if (nodeData.uri) {
                        html += '<p><strong>URI:</strong> <small>' + nodeData.uri + '</small></p>';
                    }
                    
                    nodeInfo.innerHTML = html;
                    infoPanel.style.display = 'block';
                });
                
                cy.on('tap', function(evt) {
                    if (evt.target === cy) {
                        document.getElementById('info').style.display = 'none';
                    }
                });
                
                document.getElementById('layoutSelect').addEventListener('change', function() {
                    const layout = this.value;
                    window.currentLayout = layout;
                    let layoutOptions = { name: layout, padding: 30 };
                    
                    switch(layout) {
                        case 'dagre':
                            layoutOptions = {
                                name: 'dagre',
                                directed: true,
                                padding: 30,
                                spacingFactor: 1.2,
                                rankDir: 'TB'
                            };
                            break;
                        case 'circle':
                            layoutOptions = {
                                name: 'circle',
                                padding: 30,
                                radius: 200
                            };
                            break;
                        case 'grid':
                            layoutOptions = {
                                name: 'grid',
                                padding: 30,
                                rows: Math.ceil(Math.sqrt(ontologyData.nodes.length))
                            };
                            break;
                        case 'cose':
                            layoutOptions = {
                                name: 'cose',
                                padding: 30,
                                nodeRepulsion: 400000,
                                idealEdgeLength: 100,
                                edgeElasticity: 100
                            };
                            break;
                        case 'breadthfirst':
                            layoutOptions = {
                                name: 'breadthfirst',
                                padding: 30,
                                directed: true,
                                spacingFactor: 1.5
                            };
                            break;
                    }
                    
                    cy.layout(layoutOptions).run();
                });
                
                document.getElementById('layoutSelect').value = window.currentLayout || 'dagre';
                
                window.fitGraph = function() {
                    cy.fit();
                };
                
                window.resetZoom = function() {
                    cy.zoom(1);
                    cy.center();
                };
                
                window.redrawDiagram = function() {
                    console.log('Forcing diagram redraw...');
                    
                    // Get current layout
                    const currentLayout = window.currentLayout || 'dagre';
                    let layoutOptions = { name: currentLayout, padding: 30 };
                    
                    // Set layout options based on current layout type
                    switch(currentLayout) {
                        case 'dagre':
                            layoutOptions = {
                                name: 'dagre',
                                directed: true,
                                padding: 30,
                                spacingFactor: 1.2,
                                rankDir: 'TB'
                            };
                            break;
                        case 'circle':
                            layoutOptions = {
                                name: 'circle',
                                padding: 30,
                                radius: 200
                            };
                            break;
                        case 'grid':
                            layoutOptions = {
                                name: 'grid',
                                padding: 30,
                                rows: Math.ceil(Math.sqrt(cy.nodes().length))
                            };
                            break;
                        case 'cose':
                            layoutOptions = {
                                name: 'cose',
                                padding: 30,
                                nodeRepulsion: 400000,
                                idealEdgeLength: 100,
                                edgeElasticity: 100
                            };
                            break;
                        case 'breadthfirst':
                            layoutOptions = {
                                name: 'breadthfirst',
                                padding: 30,
                                directed: true,
                                spacingFactor: 1.5
                            };
                            break;
                    }
                    
                    // Force re-layout and fit to view
                    const layout = cy.layout(layoutOptions);
                    layout.run();
                    
                    // Fit to view after layout completes
                    layout.on('layoutstop', function() {
                        setTimeout(() => {
                            cy.fit();
                        }, 100);
                    });
                    
                    console.log('Diagram redraw triggered with layout:', currentLayout);
                };
                
                function updateStats() {
                    const stats = ontologyData.nodes.reduce((acc, node) => {
                        acc[node.type] = (acc[node.type] || 0) + 1;
                        return acc;
                    }, {});
                    
                    document.getElementById('classCount').textContent = stats.class || 0;
                    document.getElementById('propertyCount').textContent = stats.property || 0;
                    document.getElementById('individualCount').textContent = stats.individual || 0;
                    document.getElementById('edgeCount').textContent = ontologyData.edges.length;
                }
                
                updateStats();
                
                window.showUpdateIndicator = function() {
                    const statusDot = document.getElementById('statusDot');
                    const statusText = document.getElementById('statusText');
                    if (statusDot && statusText) {
                        statusDot.classList.add('updating');
                        statusText.textContent = 'Updating...';
                        
                        setTimeout(() => {
                            statusDot.classList.remove('updating');
                            statusText.textContent = 'Auto-updating';
                        }, 1500);
                    }
                };
                
                window.updateVisualizationData = function(newOntologyData) {
                    console.log('Updating visualization with new data:', newOntologyData);
                    
                    const currentZoom = cy.zoom();
                    const currentPan = cy.pan();
                    
                    window.showUpdateIndicator();
                    
                    const nodePositions = {};
                    cy.nodes().forEach(node => {
                        const pos = node.position();
                        nodePositions[node.id()] = { x: pos.x, y: pos.y };
                    });
                    
                    cy.elements().remove();
                    
                    const newElements = [
                        ...newOntologyData.nodes.map(node => ({
                            data: {
                                id: node.id,
                                label: node.label,
                                type: node.type,
                                uri: node.uri
                            }
                        })),
                        ...newOntologyData.edges.map(edge => ({
                            data: {
                                id: edge.id,
                                source: edge.source,
                                target: edge.target,
                                label: edge.label,
                                type: edge.type
                            }
                        }))
                    ];
                    
                    cy.add(newElements);
                    
                    let positionsRestored = 0;
                    cy.nodes().forEach(node => {
                        const savedPos = nodePositions[node.id()];
                        if (savedPos) {
                            node.position(savedPos);
                            positionsRestored++;
                        }
                    });
                    
                    console.log('Restored positions for', positionsRestored, 'nodes');
                    
                    const totalNodes = cy.nodes().length;
                    if (positionsRestored < totalNodes * 0.8) {
                        console.log('Running layout for new nodes...');
                        const layout = cy.layout({
                            name: window.currentLayout || 'dagre',
                            animate: false,
                            padding: 30
                        });
                        layout.run();
                        
                        layout.on('layoutstop', function() {
                            setTimeout(() => {
                                cy.zoom(currentZoom);
                                cy.pan(currentPan);
                            }, 50);
                        });
                    } else {
                        cy.zoom(currentZoom);
                        cy.pan(currentPan);
                    }
                    
                    const stats = newOntologyData.nodes.reduce((acc, node) => {
                        acc[node.type] = (acc[node.type] || 0) + 1;
                        return acc;
                    }, {});
                    
                    document.getElementById('classCount').textContent = stats.class || 0;
                    document.getElementById('propertyCount').textContent = stats.property || 0;
                    document.getElementById('individualCount').textContent = stats.individual || 0;
                    document.getElementById('edgeCount').textContent = newOntologyData.edges.length;
                    
                    console.log('Visualization updated successfully');
                };
                
                window.addEventListener('message', event => {
                    console.log('Webview received message:', event.data);
                    const message = event.data;
                    if (message.command === 'updateData') {
                        console.log('Processing updateData command with', message.data.nodes.length, 'nodes');
                        window.updateVisualizationData(message.data);
                    }
                });
                
                setTimeout(() => {
                    try {
                        cy.fit();
                        console.log('Graph fitted successfully');
                    } catch (error) {
                        console.error('Error fitting graph:', error);
                    }
                }, 100);
                
                ${isAutoUpdate ? 'window.showUpdateIndicator();' : ''}
                
            } catch (error) {
                console.error('Error in webview script:', error);
                document.getElementById('cy').innerHTML = '<div style="padding: 20px; color: red;">Error: ' + error.message + '</div>';
            }
        })();
    </script>
</body>
</html>`;
    }
}
exports.VisualizationPanel = VisualizationPanel;
//# sourceMappingURL=visualizationPanel.js.map
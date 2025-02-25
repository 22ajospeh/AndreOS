#!/usr/bin/env node

/**
 * Single-file "GitHub for Your Career" application
 * ------------------------------------------------
 * Enhanced UI with:
 *  - Preserved node colors
 *  - Collapsible document editor
 *  - Still using file-based persistence in careerData.json
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// ========== File-based storage ==========
const DATA_FILE = path.join(__dirname, 'careerData.json');

// The top-level store: { graphData: {nodes, links}, documents: [...], issues: [...] }
let store = {
  graphData: {
    nodes: [],
    links: []
  },
  documents: [],
  issues: []
};

// Load existing data if file present
if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    store = JSON.parse(raw);
    console.log('Loaded existing data from careerData.json');
  } catch (err) {
    console.error('Error reading careerData.json, starting with empty data:', err);
  }
}

// Helper: save store to disk
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  console.log('Data saved to', DATA_FILE);
}

app.use(express.json());

// -------------- REST API --------------

// ========== Graph Data ==========
app.get('/api/graph', (req, res) => {
  res.json(store.graphData);
});

app.post('/api/graph', (req, res) => {
  store.graphData = req.body;
  saveData();
  res.json({ success: true, graphData: store.graphData });
});

// ========== Documents ==========
app.get('/api/documents', (req, res) => {
  res.json(store.documents);
});

app.get('/api/documents/:docId', (req, res) => {
  const doc = store.documents.find(d => d.docId === req.params.docId);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }
  res.json(doc);
});

app.post('/api/documents', (req, res) => {
  const { title, content } = req.body;
  const docId = `doc_${Date.now()}`;
  const newDoc = {
    docId,
    title,
    versions: [{ content, timestamp: new Date().toISOString() }],
    currentVersion: 0
  };
  store.documents.push(newDoc);
  saveData();
  res.json(newDoc);
});

app.post('/api/documents/:docId/commit', (req, res) => {
  const { content } = req.body;
  const doc = store.documents.find(d => d.docId === req.params.docId);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }
  doc.versions.push({ content, timestamp: new Date().toISOString() });
  doc.currentVersion = doc.versions.length - 1;
  saveData();
  res.json(doc);
});

// ========== Issues / Kanban ==========
app.get('/api/issues', (req, res) => {
  res.json(store.issues);
});

app.post('/api/issues', (req, res) => {
  const { title, description, status } = req.body;
  const issueId = `issue_${Date.now()}`;
  const newIssue = {
    issueId,
    title: title || 'Untitled',
    description: description || '',
    status: status || 'todo'
  };
  store.issues.push(newIssue);
  saveData();
  res.json(newIssue);
});

app.put('/api/issues/:issueId', (req, res) => {
  const { issueId } = req.params;
  let issue = store.issues.find(i => i.issueId === issueId);
  if (!issue) {
    return res.status(404).json({ error: 'Issue not found' });
  }
  Object.assign(issue, req.body);
  saveData();
  res.json(issue);
});

app.delete('/api/issues/:issueId', (req, res) => {
  const { issueId } = req.params;
  const index = store.issues.findIndex(i => i.issueId === issueId);
  if (index === -1) {
    return res.status(404).json({ error: 'Issue not found' });
  }
  const removed = store.issues.splice(index, 1);
  saveData();
  res.json({ success: true, removed });
});

// ========== Main HTML Endpoint ==========
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AndreOS</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap">
  <style>
    :root {
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #334155;
      --accent-primary: #3b82f6;
      --accent-secondary: #60a5fa;
      --accent-success: #10b981;
      --accent-danger: #ef4444;
      --accent-warning: #f59e0b;
      --text-primary: #f1f5f9;
      --text-secondary: #cbd5e1;
      --text-muted: #94a3b8;
      --border-color: #475569;
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      --radius-sm: 0.25rem;
      --radius-md: 0.375rem;
      --radius-lg: 0.5rem;
      --transition-normal: all 0.2s ease;
      --transition-smooth: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      --font-mono: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace;
    }
    
    * {
      box-sizing: border-box;
      user-select: none;
      margin: 0;
      padding: 0;
    }
    
    body {
      background-color: var(--bg-primary);
      color: var(--text-primary);
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    header {
      background: var(--bg-secondary);
      padding: 0.75rem 1.5rem;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: var(--shadow-md);
      z-index: 10;
    }
    
    .logo {
      display: flex;
      align-items: center;
      font-weight: 700;
      font-size: 1.25rem;
      color: var(--accent-secondary);
    }
    
    .logo i {
      margin-right: 0.5rem;
    }
    
    #main-container {
      flex: 1;
      display: flex;
      overflow: hidden;
    }
    
    #graph-container {
      width: 35%;
      position: relative;
      border-right: 1px solid var(--border-color);
      background-color: var(--bg-secondary);
      overflow: hidden;
    }
    
    #editor-container {
      width: 30%;
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      background-color: var(--bg-secondary);
      overflow: hidden;
      transition: var(--transition-smooth);
    }
    
    /* Collapsed editor state */
    #editor-container.collapsed {
      width: 0 !important;
      min-width: 0 !important;
      display: none; /* fully hides the panel */
    }
    #resizer2.hidden {
      display: none;
    }
    
    #kanban-container {
      flex: 1;
      display: flex;
      padding: 1rem;
      overflow-x: auto;
      gap: 1rem;
      background-color: var(--bg-primary);
    }
    
    .resizer {
      width: 6px;
      background: var(--border-color);
      cursor: col-resize;
      transition: background 0.2s ease;
      z-index: 5;
    }
    
    .resizer:hover, .resizer:active {
      background: var(--accent-primary);
    }
    
    #graph {
      width: 100%;
      height: 100%;
    }
    
    #cluster-button-container {
      display: flex;
      flex-direction: column;
      position: absolute;
      top: 1rem;
      left: 1rem;
      gap: 0.5rem;
      z-index: 5;
    }
    
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 0.6rem 1rem;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition-normal);
      box-shadow: var(--shadow-sm);
    }
    
    .btn:hover {
      background-color: var(--accent-primary);
      border-color: var(--accent-secondary);
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }
    
    .btn-primary {
      background-color: var(--accent-primary);
      border-color: var(--accent-secondary);
    }
    
    .btn-primary:hover {
      background-color: var(--accent-secondary);
    }
    
    .btn-success {
      background-color: var(--accent-success);
      border-color: var(--accent-success);
    }
    
    .btn-danger {
      background-color: var(--accent-danger);
      border-color: var(--accent-danger);
    }
    
    #doc-list {
      padding: 1rem;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      box-shadow: var(--shadow-sm);
    }
    
    select {
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 0.5rem;
      font-size: 0.9rem;
      flex-grow: 1;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23cbd5e1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.5rem center;
      padding-right: 2.5rem;
    }
    
    select:focus {
      outline: none;
      border-color: var(--accent-primary);
    }
    
    #editor {
      flex: 1;
      background: var(--bg-primary);
      color: var(--text-primary);
      padding: 1.25rem;
      border: none;
      resize: none;
      outline: none;
      width: 100%;
      height: 100%;
      font-family: var(--font-mono);
      font-size: 0.95rem;
      line-height: 1.5;
      overflow: auto;
      box-shadow: inset 0 0 10px rgba(0,0,0,0.1);
    }
    
    #editor:focus {
      box-shadow: inset 0 0 0 2px var(--accent-primary);
    }
    
    .kanban-column {
      flex: 1;
      min-width: 280px;
      background: var(--bg-secondary);
      border-radius: var(--radius-lg);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: var(--shadow-md);
      border: 1px solid var(--border-color);
      transition: var(--transition-normal);
    }
    
    .kanban-column.drag-over {
      box-shadow: 0 0 0 2px var(--accent-primary), var(--shadow-lg);
      transform: translateY(-2px);
    }
    
    .kanban-header {
      padding: 1rem;
      font-weight: 600;
      font-size: 1rem;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .kanban-header i {
      margin-right: 0.5rem;
      opacity: 0.7;
    }
    
    .kanban-list {
      flex: 1;
      padding: 1rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    
    .kanban-footer {
      padding: 0.75rem;
      border-top: 1px solid var(--border-color);
    }
    
    /* Custom column colors */
    #todo-column .kanban-header {
      color: var(--accent-primary);
      background-color: rgba(59, 130, 246, 0.1);
    }
    
    #inprogress-column .kanban-header {
      color: var(--accent-warning);
      background-color: rgba(245, 158, 11, 0.1);
    }
    
    #done-column .kanban-header {
      color: var(--accent-success);
      background-color: rgba(16, 185, 129, 0.1);
    }
    
    .issue-card {
      background: var(--bg-tertiary);
      padding: 1rem;
      border-radius: var(--radius-md);
      position: relative;
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border-color);
      cursor: move;
      transition: var(--transition-normal);
    }
    
    .issue-card:hover {
      box-shadow: var(--shadow-md);
      transform: translateY(-2px);
    }
    
    .issue-title {
      font-weight: 600;
      margin-bottom: 0.5rem;
      padding-right: 1.5rem;
    }
    
    .issue-desc {
      font-size: 0.85rem;
      color: var(--text-secondary);
      white-space: pre-line;
      line-height: 1.5;
    }
    
    .delete-issue-btn {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--accent-danger);
      color: white;
      border: none;
      font-size: 0.8rem;
      cursor: pointer;
      opacity: 0;
      transition: var(--transition-normal);
    }
    
    .issue-card:hover .delete-issue-btn {
      opacity: 1;
    }
    
    /* Graph styles */
    .node {
      stroke: #333;
      stroke-width: 1.5px;
      transition: fill 0.3s ease, r 0.3s ease;
      cursor: pointer;
    }
    
    .node:hover {
      stroke: var(--accent-primary);
      stroke-width: 2.5px;
    }
    
    .link {
      stroke-opacity: 0.6;
      transition: stroke 0.3s ease, stroke-width 0.3s ease, stroke-opacity 0.3s ease;
    }
    
    .label {
      pointer-events: none;
      user-select: none;
      font-size: 12px;
      font-weight: 500;
    }
    
    /* Toast notification */
    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: var(--bg-tertiary);
      color: var(--text-primary);
      padding: 1rem;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transform: translateY(100px);
      opacity: 0;
      transition: var(--transition-smooth);
      border-left: 4px solid var(--accent-primary);
    }
    
    .toast.show {
      transform: translateY(0);
      opacity: 1;
    }
    
    .toast.success {
      border-left-color: var(--accent-success);
    }
    
    .toast.error {
      border-left-color: var(--accent-danger);
    }
    
    /* Scrollbar styling */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    ::-webkit-scrollbar-track {
      background: var(--bg-primary);
    }
    
    ::-webkit-scrollbar-thumb {
      background: var(--bg-tertiary);
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: var(--accent-primary);
    }
    
    /* Responsive adjustments */
    @media (max-width: 768px) {
      #main-container {
        flex-direction: column;
      }
      
      #graph-container, #editor-container {
        width: 100%;
        height: 33vh;
        border-right: none;
        border-bottom: 1px solid var(--border-color);
      }
      
      .resizer {
        width: 100%;
        height: 6px;
        cursor: row-resize;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="logo"><i class="fas fa-code-branch"></i> AndreOS</div>
    <div id="header-controls" style="display: flex; align-items: center; gap: 0.5rem;">
      <!-- Editor toggle button -->
      <button id="toggle-editor-btn" class="btn" style="padding: 0.4rem 0.7rem;">
        <i class="fas fa-window-minimize"></i>
        Toggle Editor
      </button>
      <span id="save-status" style="color: var(--text-muted); font-size: 0.9rem;"></span>
    </div>
  </header>
  
  <div id="main-container">
    <!-- Graph Container -->
    <div id="graph-container">
      <svg id="graph"></svg>
      <div id="cluster-button-container">
        <button id="add-node-btn" class="btn">
          <i class="fas fa-plus-circle"></i> Add Node
        </button>
        <button id="add-colored-node-btn" class="btn">
          <i class="fas fa-palette"></i> Add Colored Node
        </button>
        <button id="save-graph-btn" class="btn btn-primary">
          <i class="fas fa-save"></i> Save Graph
        </button>
      </div>
    </div>
    
    <div class="resizer" id="resizer1"></div>
    
    <!-- Editor Container -->
    <div id="editor-container">
      <div id="doc-list">
        <select id="select-doc">
          <option value="">-- Select Document --</option>
        </select>
        <button id="new-doc-btn" class="btn">
          <i class="fas fa-file"></i> New
        </button>
        <button id="commit-doc-btn" class="btn btn-primary">
          <i class="fas fa-save"></i> Commit
        </button>
      </div>
      <textarea id="editor" placeholder="Write your LaTeX/Markdown-style content here..."></textarea>
    </div>
    
    <div class="resizer" id="resizer2"></div>
    
    <!-- Kanban Container -->
    <div id="kanban-container">
      <!-- For each column, set up drag event handlers -->
      <div class="kanban-column" id="todo-column"
           data-status="todo"
           ondragover="kanbanDragOver(event)"
           ondragleave="kanbanDragLeave(event)"
           ondrop="kanbanDrop(event)">
        <div class="kanban-header">
          <div><i class="fas fa-clipboard-list"></i> To Do</div>
          <span class="counter" id="todo-counter">0</span>
        </div>
        <div class="kanban-list" id="todo-list"></div>
        <div class="kanban-footer">
          <button onclick="createIssuePrompt('todo')" class="btn btn-primary" style="width: 100%">
            <i class="fas fa-plus"></i> Add Task
          </button>
        </div>
      </div>
      
      <div class="kanban-column" id="inprogress-column"
           data-status="in-progress"
           ondragover="kanbanDragOver(event)"
           ondragleave="kanbanDragLeave(event)"
           ondrop="kanbanDrop(event)">
        <div class="kanban-header">
          <div><i class="fas fa-spinner"></i> In Progress</div>
          <span class="counter" id="inprogress-counter">0</span>
        </div>
        <div class="kanban-list" id="inprogress-list"></div>
        <div class="kanban-footer">
          <button onclick="createIssuePrompt('in-progress')" class="btn btn-primary" style="width: 100%">
            <i class="fas fa-plus"></i> Add Task
          </button>
        </div>
      </div>
      
      <div class="kanban-column" id="done-column"
           data-status="done"
           ondragover="kanbanDragOver(event)"
           ondragleave="kanbanDragLeave(event)"
           ondrop="kanbanDrop(event)">
        <div class="kanban-header">
          <div><i class="fas fa-check-circle"></i> Done</div>
          <span class="counter" id="done-counter">0</span>
        </div>
        <div class="kanban-list" id="done-list"></div>
        <div class="kanban-footer">
          <button onclick="createIssuePrompt('done')" class="btn btn-primary" style="width: 100%">
            <i class="fas fa-plus"></i> Add Task
          </button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Toast notification -->
  <div id="toast" class="toast">
    <i id="toast-icon" class="fas fa-info-circle"></i>
    <span id="toast-message"></span>
  </div>

  <!-- D3 & Marked from CDN -->
  <script src="https://cdn.jsdelivr.net/npm/d3@7.8.5/dist/d3.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

  <script>
    /************************************************************
     * Toast notifications
     ************************************************************/
    function showToast(message, type = 'info') {
      const toast = document.getElementById('toast');
      const icon = document.getElementById('toast-icon');
      const msg = document.getElementById('toast-message');
      
      toast.className = 'toast';
      if (type === 'success') {
        toast.classList.add('success');
        icon.className = 'fas fa-check-circle';
      } else if (type === 'error') {
        toast.classList.add('error');
        icon.className = 'fas fa-exclamation-circle';
      } else {
        icon.className = 'fas fa-info-circle';
      }
      
      msg.textContent = message;
      toast.classList.add('show');
      
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
  
    /************************************************************
     * Resizers for columns
     ************************************************************/
    const graphContainer = document.getElementById('graph-container');
    const editorContainer = document.getElementById('editor-container');
    const kanbanContainer = document.getElementById('kanban-container');
    const resizer1 = document.getElementById('resizer1');
    const resizer2 = document.getElementById('resizer2');

    let graphWidth = graphContainer.getBoundingClientRect().width;
    let editorWidth = editorContainer.getBoundingClientRect().width;
    let isResizing = false;

    // First resizer (between graph and editor)
    resizer1.addEventListener('mousedown', e => {
      e.preventDefault();
      isResizing = true;
      document.addEventListener('mousemove', resizeGraphEditor);
      document.addEventListener('mouseup', stopResize1);
    });

    function resizeGraphEditor(e) {
      if (!isResizing) return;
      const dx = e.movementX;
      graphWidth += dx;
      if (graphWidth < 100) graphWidth = 100;
      graphContainer.style.width = graphWidth + 'px';
    }
    function stopResize1() {
      isResizing = false;
      document.removeEventListener('mousemove', resizeGraphEditor);
      document.removeEventListener('mouseup', stopResize1);
    }

    // Second resizer (between editor and kanban)
    resizer2.addEventListener('mousedown', e => {
      e.preventDefault();
      isResizing = true;
      document.addEventListener('mousemove', resizeEditorKanban);
      document.addEventListener('mouseup', stopResize2);
    });

    function resizeEditorKanban(e) {
      if (!isResizing) return;
      const dx = e.movementX;
      editorWidth += dx;
      if (editorWidth < 100) editorWidth = 100;
      editorContainer.style.width = editorWidth + 'px';
    }
    function stopResize2() {
      isResizing = false;
      document.removeEventListener('mousemove', resizeEditorKanban);
      document.removeEventListener('mouseup', stopResize2);
    }

    // Editor toggle
    const toggleEditorBtn = document.getElementById('toggle-editor-btn');
    toggleEditorBtn.addEventListener('click', () => {
      editorContainer.classList.toggle('collapsed');

      // Hide or show resizer2 accordingly
      if (editorContainer.classList.contains('collapsed')) {
        resizer2.classList.add('hidden');
      } else {
        resizer2.classList.remove('hidden');
      }
    });

    /************************************************************
     * Graph & D3
     ************************************************************/
    const svg = d3.select('#graph');
    let simulation = d3.forceSimulation()
      .force('link', d3.forceLink().id(d => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-80))
      .force('center', d3.forceCenter())
      .force('collision', d3.forceCollide().radius(30));

    let graph = { nodes: [], links: [] };
    let selectedNode = null;
    let transformScale = 1;

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        transformScale = event.transform.k;
        d3.select('#graph g').attr('transform', event.transform);
      });
    svg.call(zoom);

    function updateSvgSize() {
      const width = graphContainer.clientWidth;
      const height = graphContainer.clientHeight;
      
      svg.attr('width', width).attr('height', height);
      
      // Update simulation center force
      simulation.force('center', d3.forceCenter(width / 2, height / 2));
      
      if (graph.nodes.length > 0) {
        simulation.alpha(0.3).restart();
      }
    }
    window.addEventListener('resize', updateSvgSize);

    function loadGraph() {
      fetch('/api/graph')
        .then(res => res.json())
        .then(data => {
          const nodeMap = {};
          data.nodes.forEach(n => { nodeMap[n.id] = n; });
          data.links.forEach(l => {
            // link source/target strings => object references
            if (typeof l.source === 'string') l.source = nodeMap[l.source];
            if (typeof l.target === 'string') l.target = nodeMap[l.target];
          });
          graph = data;
          updateGraph();
          updateSvgSize();
        })
        .catch(err => {
          console.error('Error loading graph:', err);
          showToast('Failed to load graph data', 'error');
        });
    }

    function updateGraph() {
      svg.selectAll('*').remove();
      
      // Create container group for zoom
      const container = svg.append('g');
      
      // Create arrow marker
      container.append('defs').append('marker')
        .attr('id', 'arrowhead')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 23)
        .attr('refY', 0)
        .attr('orient', 'auto')
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('xoverflow', 'visible')
        .append('path')
        .attr('d', 'M 0,-5 L 10,0 L 0,5')
        .attr('fill', '#999');

      // Links
      const link = container.selectAll('.link')
        .data(graph.links)
        .enter()
        .append('line')
        .attr('class', 'link')
        .attr('stroke', '#999')
        .attr('stroke-width', 1.5)
        .attr('marker-end', 'url(#arrowhead)');

      // Nodes
      const node = container.selectAll('.node')
        .data(graph.nodes, d => d.id)
        .enter()
        .append('circle')
        .attr('class', 'node')
        .attr('r', 18)
        .attr('fill', d => d.color || '#2ecc71')  // Use node.color if set, else fallback
        .on('click', (event, d) => {
          // SHIFT-click => attach/detach links
          if (event.shiftKey) {
            if (!selectedNode) {
              selectedNode = d;
            } else {
              if (selectedNode.id === d.id) {
                selectedNode = null;
                return;
              }
              // If a link exists, remove it; else add it
              const existing = graph.links.find(l =>
                (l.source.id === selectedNode.id && l.target.id === d.id) ||
                (l.source.id === d.id && l.target.id === selectedNode.id)
              );
              if (existing) {
                graph.links = graph.links.filter(l => l !== existing);
              } else {
                graph.links.push({ source: selectedNode.id, target: d.id });
              }
              selectedNode = null;
              updateGraph();
            }
          }
        })
        .on('dblclick', (event, d) => {
          if (!confirm(\`Delete node "\${d.name}"?\`)) return;
          // Remove the node and its links
          graph.nodes = graph.nodes.filter(n => n.id !== d.id);
          graph.links = graph.links.filter(l => l.source.id !== d.id && l.target.id !== d.id);
          updateGraph();
        })
        .call(d3.drag()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended));

      // Labels
      const label = container.selectAll('.label')
        .data(graph.nodes, d => d.id)
        .enter()
        .append('text')
        .attr('class', 'label')
        .attr('fill', '#ccc')
        .attr('font-size', 12)
        .text(d => d.name || 'Node');

      // Set up simulation
      simulation.nodes(graph.nodes).on('tick', ticked);
      simulation.force('link').links(graph.links);
      simulation.alpha(1).restart();

      function ticked() {
        const containerWidth = graphContainer.clientWidth;
        const containerHeight = graphContainer.clientHeight;
        const r = 18;

        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);

        node
          .attr('cx', d => {
            d.x = Math.max(r, Math.min(containerWidth - r, d.x));
            return d.x;
          })
          .attr('cy', d => {
            d.y = Math.max(r, Math.min(containerHeight - r, d.y));
            return d.y;
          });

        label
          .attr('x', d => d.x + 20)
          .attr('y', d => d.y + 5);
      }

      function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      }
      function dragged(event, d) {
        const containerWidth = graphContainer.clientWidth;
        const containerHeight = graphContainer.clientHeight;
        const r = 18;
        let newX = event.x;
        let newY = event.y;
        newX = Math.max(r, Math.min(containerWidth - r, newX));
        newY = Math.max(r, Math.min(containerHeight - r, newY));
        d.fx = newX; d.fy = newY;
        d.x = newX; d.y = newY;
      }
      function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      }
    }

    // Save Graph
    function saveGraph() {
      // Convert source/target object references into IDs
      const dataToSave = {
        nodes: graph.nodes.map(n => ({ ...n })),
        links: graph.links.map(l => ({
          source: typeof l.source === 'object' ? l.source.id : l.source,
          target: typeof l.target === 'object' ? l.target.id : l.target
        }))
      };
      fetch('/api/graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      })
      .then(() => {
        showToast('Graph saved successfully!', 'success');
      })
      .catch(err => {
        console.error('Graph save error:', err);
        showToast('Graph save failed.', 'error');
      });
    }
    document.getElementById('save-graph-btn').addEventListener('click', saveGraph);

    // Add Node (no color => will default to #2ecc71 in updateGraph)
    document.getElementById('add-node-btn').addEventListener('click', () => {
      const nodeName = prompt('Enter milestone name:');
      if (!nodeName) return;
      const cWidth = graphContainer.clientWidth;
      const cHeight = graphContainer.clientHeight;
      // Create node, store with no color => defaults on display
      const newNode = {
        id: 'n' + Date.now(),
        name: nodeName,
        x: cWidth / 2,
        y: cHeight / 2
      };
      graph.nodes.push(newNode);
      updateGraph();
    });

    // Add Node with color
    document.getElementById('add-colored-node-btn').addEventListener('click', () => {
      const nodeName = prompt('Enter milestone name:');
      if (!nodeName) return;
      const color = prompt('Enter node color (e.g. "#ff0000" or "blue"):') || '#2ecc71';
      const cWidth = graphContainer.clientWidth;
      const cHeight = graphContainer.clientHeight;
      const newNode = {
        id: 'n' + Date.now(),
        name: nodeName,
        color: color,
        x: cWidth / 2,
        y: cHeight / 2
      };
      graph.nodes.push(newNode);
      updateGraph();
    });

    /************************************************************
     * Documents & Editor
     ************************************************************/
    let currentDoc = null;
    const docSelect = document.getElementById('select-doc');
    const editor = document.getElementById('editor');
    const newDocBtn = document.getElementById('new-doc-btn');
    const commitDocBtn = document.getElementById('commit-doc-btn');

    function loadDocuments() {
      fetch('/api/documents')
        .then(res => res.json())
        .then(docs => {
          docSelect.innerHTML = '<option value="">-- Select Document --</option>';
          docs.forEach(doc => {
            const opt = document.createElement('option');
            opt.value = doc.docId;
            opt.textContent = doc.title;
            docSelect.appendChild(opt);
          });
        });
    }

    docSelect.addEventListener('change', () => {
      const docId = docSelect.value;
      if (!docId) {
        currentDoc = null;
        editor.value = '';
        return;
      }
      fetch(\`/api/documents/\${docId}\`)
        .then(res => res.json())
        .then(doc => {
          currentDoc = doc;
          const v = doc.versions[doc.currentVersion];
          editor.value = v ? v.content : '';
        });
    });

    newDocBtn.addEventListener('click', () => {
      const title = prompt('New Document Title:');
      if (!title) return;
      const content = '';
      fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content })
      })
      .then(res => res.json())
      .then(doc => {
        loadDocuments();
        docSelect.value = doc.docId;
        currentDoc = doc;
        editor.value = '';
      });
    });

    commitDocBtn.addEventListener('click', () => {
      if (!currentDoc) {
        showToast('No document selected.', 'error');
        return;
      }
      const content = editor.value;
      fetch(\`/api/documents/\${currentDoc.docId}/commit\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      })
      .then(res => res.json())
      .then(updatedDoc => {
        currentDoc = updatedDoc;
        showToast(\`Document committed. Version count: \${updatedDoc.versions.length}\`, 'success');
      })
      .catch(err => {
        console.error('Commit error:', err);
        showToast('Failed to commit document.', 'error');
      });
    });

    /************************************************************
     * Kanban / Issues - DRAG & DROP
     ************************************************************/
    let issues = [];

    function loadIssues() {
      fetch('/api/issues')
        .then(res => res.json())
        .then(data => {
          issues = data;
          renderIssues(data);
          updateIssueCounters(data);
        });
    }

    // Update counters in column headers
    function updateIssueCounters(issueArray) {
      const todoCount = issueArray.filter(i => i.status === 'todo').length;
      const inprogressCount = issueArray.filter(i => i.status === 'in-progress').length;
      const doneCount = issueArray.filter(i => i.status === 'done').length;
      document.getElementById('todo-counter').textContent = todoCount;
      document.getElementById('inprogress-counter').textContent = inprogressCount;
      document.getElementById('done-counter').textContent = doneCount;
    }

    function renderIssues(issueArray) {
      document.getElementById('todo-list').innerHTML = '';
      document.getElementById('inprogress-list').innerHTML = '';
      document.getElementById('done-list').innerHTML = '';

      issueArray.forEach(issue => {
        const div = document.createElement('div');
        div.className = 'issue-card';
        div.draggable = true;
        div.setAttribute('data-issue-id', issue.issueId);
        div.innerHTML = \`
          <button class="delete-issue-btn" onclick="deleteIssue(event, '\${issue.issueId}')"><i class="fas fa-times"></i></button>
          <div class="issue-title">\${issue.title}</div>
          <div class="issue-desc">\${issue.description}</div>
        \`;

        // Drag
        div.addEventListener('dragstart', e => {
          e.dataTransfer.setData('text/plain', issue.issueId);
        });

        // Drop into correct column
        if (issue.status === 'todo') {
          document.getElementById('todo-list').appendChild(div);
        } else if (issue.status === 'in-progress') {
          document.getElementById('inprogress-list').appendChild(div);
        } else {
          document.getElementById('done-list').appendChild(div);
        }
      });
    }

    function createIssuePrompt(defaultStatus) {
      const title = prompt('Issue title:');
      if (!title) return;
      const description = prompt('Issue description:');
      fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, status: defaultStatus })
      })
      .then(() => loadIssues());
    }
    window.createIssuePrompt = createIssuePrompt;

    function deleteIssue(e, issueId) {
      e.stopPropagation();
      if (!confirm('Delete this issue?')) return;
      fetch(\`/api/issues/\${issueId}\`, { method: 'DELETE' })
      .then(res => res.json())
      .then(result => {
        if (result.success) loadIssues();
      });
    }
    window.deleteIssue = deleteIssue;

    // Kanban DnD
    function kanbanDragOver(event) {
      event.preventDefault();
      const column = event.currentTarget;
      column.classList.add('drag-over');
    }
    window.kanbanDragOver = kanbanDragOver;

    function kanbanDragLeave(event) {
      const column = event.currentTarget;
      column.classList.remove('drag-over');
    }
    window.kanbanDragLeave = kanbanDragLeave;

    function kanbanDrop(event) {
      event.preventDefault();
      const column = event.currentTarget;
      column.classList.remove('drag-over');
      const newStatus = column.getAttribute('data-status');
      const issueId = event.dataTransfer.getData('text/plain');

      fetch(\`/api/issues/\${issueId}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      .then(() => loadIssues());
    }
    window.kanbanDrop = kanbanDrop;

    // Initialize
    loadGraph();
    loadDocuments();
    loadIssues();
  </script>
</body>
</html>
`;
  res.send(html);
});

// Start the server
app.listen(PORT, () => {
  console.log('"GitHub for Your Career" app running at http://localhost:' + PORT);
});

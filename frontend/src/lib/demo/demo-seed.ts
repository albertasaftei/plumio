// Demo seed data - sample documents for the demo

export const sampleFolderColors = {
  "/Examples": "#ef4444",
};

export const sampleDocuments = [
  {
    path: "/Welcome",
    content:
      "# Welcome to plumio! 🎉\n\nThis is a **demo version** of plumio running entirely in your browser using localStorage.\n\n## Features you can try:\n\n* **Rich markdown editing** with real-time preview\n\n* **Code blocks** with syntax highlighting\n\n* **Math equations** via KaTeX: $E = mc^2$ and $\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$\n\n* **Mermaid diagrams** — check out the Examples/Diagrams document!\n\n* **Sketch canvases** — embed freehand drawings in your notes! See Examples/Sketch.\n\n* **Tables, lists, and more!**\n\n## Get started\n\nTry creating a new document, organizing with folders, or archiving documents you don't need.\n\nWant to self-host? Check out [our documentation](https://plumio.app) for installation instructions.\n",
    modified: "2026-02-03T15:14:34.053Z",
    size: 643,
    color: "#3b82f6",
  },
  {
    path: "/Examples/Math",
    content:
      "# Math Examples\n\nplumio supports LaTeX math equations via KaTeX.\n\n## Inline Math\n\nEinstein's famous equation: $E = mc^2$\n\nThe quadratic formula: $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$\n\n## Block Math\n\nThe Fourier transform:\n\n$$\n\\hat{f}(\\omega) = \\int_{-\\infty}^{\\infty} f(t) e^{-i\\omega t} dt\n$$\n\nSum of squares:\n\n$$\n\\sum_{i=1}^{n} i^2 = \\frac{n(n+1)(2n+1)}{6}\n$$",
    modified: "2026-02-02T15:10:55.095Z",
    size: 364,
  },
  {
    path: "/Examples/Code",
    content:
      '# Code Examples\n\n## TypeScript\n\n```typescript\ninterface User {\n  id: number;\n  name: string;\n  email: string;\n}\n\nasync function fetchUser(id: number): Promise<User> {\n  const response = await fetch(`/api/users/${id}`);\n  return response.json();\n}\n```\n\n## Python\n\n```python\ndef fibonacci(n: int) -> int:\n    """Calculate the nth Fibonacci number."""\n    if n <= 1:\n        return n\n    return fibonacci(n - 1) + fibonacci(n - 2)\n\nprint(fibonacci(10))  # Output: 55\n```',
    modified: "2026-02-01T15:10:55.095Z",
    size: 467,
    color: "#f97316",
  },
  {
    path: "/Examples/Diagrams",
    content:
      "# Mermaid Diagrams\n\nplumio supports [Mermaid](https://mermaid.js.org) diagrams. Use the plain text editor to write diagram code inside a ` ```mermaid ` block — the Live editor will render the diagram automatically.\n\n## Flowchart\n\n```mermaid\nflowchart TD\n    A[Start] --> B{Is it working?}\n    B -- Yes --> C[Great!]\n    B -- No --> D[Debug]\n    D --> B\n```\n\n## Sequence Diagram\n\n```mermaid\nsequenceDiagram\n    participant User\n    participant Frontend\n    participant Backend\n    User->>Frontend: Opens document\n    Frontend->>Backend: GET /documents/:id\n    Backend-->>Frontend: Document content\n    Frontend-->>User: Renders editor\n```\n\n## Entity Relationship\n\n```mermaid\nerDiagram\n    USER ||--o{ DOCUMENT : creates\n    USER ||--o{ ORGANIZATION : belongs_to\n    ORGANIZATION ||--o{ DOCUMENT : owns\n    DOCUMENT ||--o{ FOLDER : contained_in\n```",
    modified: "2026-03-18T10:00:00.000Z",
    size: 512,
    color: "#a78bfa",
  },
  {
    path: "/Examples/Sketch",
    content:
      '# Sketch Canvas\n\nplumio includes an **interactive freehand drawing** canvas you can embed directly in your notes. Click the **Sketch** button in the editor toolbar to insert one.\n\nUse the canvas toolbar to change **colors**, adjust **brush size**, or switch to the **eraser**. Your drawing is saved automatically as part of the document.\n\n```sketch\n{"strokes":[{"color":"#6366f1","size":5,"opacity":1,"points":[[550,300,0.5],[548,326,0.5],[541,351,0.5],[530,375,0.5],[515,396,0.5],[496,415,0.5],[475,430,0.5],[451,441,0.5],[426,448,0.5],[400,450,0.5],[374,448,0.5],[349,441,0.5],[325,430,0.5],[304,415,0.5],[285,396,0.5],[270,375,0.5],[260,351,0.5],[252,326,0.5],[250,300,0.5],[252,274,0.5],[260,249,0.5],[270,225,0.5],[285,204,0.5],[304,185,0.5],[325,170,0.5],[349,159,0.5],[374,152,0.5],[400,150,0.5],[426,152,0.5],[451,159,0.5],[475,170,0.5],[496,185,0.5],[515,204,0.5],[530,225,0.5],[541,249,0.5],[548,274,0.5],[550,300,0.5]]},{"color":"#6366f1","size":12,"opacity":1,"points":[[330,240,0.8],[332,241,0.8],[330,243,0.8],[328,241,0.8],[330,240,0.8]]},{"color":"#6366f1","size":12,"opacity":1,"points":[[470,240,0.8],[472,241,0.8],[470,243,0.8],[468,241,0.8],[470,240,0.8]]},{"color":"#6366f1","size":4,"opacity":1,"points":[[330,350,0.6],[350,362,0.6],[370,370,0.6],[400,375,0.6],[430,370,0.6],[450,362,0.6],[470,350,0.6]]},{"color":"#f59e0b","size":5,"opacity":1,"points":[[1100,180,0.5],[1126,244,0.5],[1195,249,0.5],[1143,294,0.5],[1159,361,0.5],[1100,325,0.5],[1041,361,0.5],[1057,294,0.5],[1005,249,0.5],[1074,244,0.5],[1100,180,0.5]]},{"color":"#ef4444","size":4,"opacity":1,"points":[[600,480,0.5],[650,450,0.5],[700,480,0.5],[750,510,0.5],[800,480,0.5],[850,450,0.5],[900,480,0.5],[950,510,0.5],[1000,480,0.5],[1050,450,0.5],[1100,480,0.5],[1150,510,0.5],[1200,480,0.5],[1250,450,0.5],[1300,480,0.5],[1350,510,0.5],[1400,480,0.5]]}]}\n```\n\nTry creating your own sketch by clicking the **Sketch** button in the Live editor toolbar!',
    modified: "2026-05-07T10:00:00.000Z",
    size: 512,
    color: "#10b981",
  },
];

export const demoUser = {
  username: "demo-user",
  email: "demo-user@plumio.app",
  isAdmin: false,
};

export const demoOrg = {
  id: 1,
  name: "Demo Organization",
  slug: "demo-org",
  role: "admin",
};

export const sampleTags = [
  {
    id: 1,
    name: "example",
    color: "#3b82f6",
    description: "Demo example files",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 2,
    name: "math",
    color: "#a855f7",
    description: "Mathematics and equations",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 3,
    name: "code",
    color: "#f97316",
    description: "Code snippets and programming",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 4,
    name: "diagrams",
    color: "#a78bfa",
    description: "Visual diagrams and charts",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 5,
    name: "welcome",
    color: "#22c55e",
    description: "Getting started content",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 6,
    name: "sketch",
    color: "#10b981",
    description: "Freehand drawing canvases",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

/** path → tagId[] */
export const sampleTagMappings: Record<string, number[]> = {
  "/Welcome": [1, 5],
  "/Examples/Math": [1, 2],
  "/Examples/Code": [1, 3],
  "/Examples/Diagrams": [1, 4],
  "/Examples/Sketch": [1, 6],
};

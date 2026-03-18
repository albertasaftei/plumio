// Demo seed data - sample documents for the demo

export const sampleFolderColors = {
  "/Examples": "#ef4444",
};

export const sampleDocuments = [
  {
    path: "/Welcome",
    content:
      "# Welcome to plumio! 🎉\n\nThis is a **demo version** of plumio running entirely in your browser using localStorage.\n\n## Features you can try:\n\n* **Rich markdown editing** with real-time preview\n\n* **Code blocks** with syntax highlighting\n\n* **Math equations** via KaTeX: $E = mc^2$ and $\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$\n\n* **Mermaid diagrams** — check out the Examples/Diagrams document!\n\n* **Tables, lists, and more!**\n\n## Get started\n\nTry creating a new document, organizing with folders, or archiving documents you don't need.\n\nWant to self-host? Check out [our documentation](https://plumio.app) for installation instructions.\n",
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

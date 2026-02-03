// Demo seed data - sample documents for the demo

export const sampleFolderColors = {
  "/Examples": "#ef4444",
};

export const sampleDocuments = [
  {
    path: "/Welcome.md",
    content:
      "# Welcome to plumio! 🎉\n\nThis is a **demo version** of plumio running entirely in your browser using localStorage.\n\n## Features you can try:\n\n* **Rich markdown editing** with real-time preview\n\n* **Code blocks** with syntax highlighting\n\n* **Math equations** (buggy at the moment - [issue open](https://github.com/albertasaftei/plumio/issues/1)): $E = mc^2$ and $\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$\n\n* **Tables, lists, and more!**\n\n## Get started\n\nTry creating a new document, organizing with folders, or archiving documents you don't need.\n\nWant to self-host? Check out [our documentation](https://plumio.app) for installation instructions.\n",
    modified: "2026-02-03T15:14:34.053Z",
    size: 643,
    color: "#3b82f6",
  },
  {
    path: "/Examples/Math.md",
    content:
      "# Math Examples\n\nplumio supports LaTeX math equations via KaTeX.\n\n## Inline Math\n\nEinstein's famous equation: $E = mc^2$\n\nThe quadratic formula: $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$\n\n## Block Math\n\nThe Fourier transform:\n\n$$\n\\hat{f}(\\omega) = \\int_{-\\infty}^{\\infty} f(t) e^{-i\\omega t} dt\n$$\n\nSum of squares:\n\n$$\n\\sum_{i=1}^{n} i^2 = \\frac{n(n+1)(2n+1)}{6}\n$$",
    modified: "2026-02-02T15:10:55.095Z",
    size: 364,
  },
  {
    path: "/Examples/Code.md",
    content:
      '# Code Examples\n\n## TypeScript\n\n```typescript\ninterface User {\n  id: number;\n  name: string;\n  email: string;\n}\n\nasync function fetchUser(id: number): Promise<User> {\n  const response = await fetch(`/api/users/${id}`);\n  return response.json();\n}\n```\n\n## Python\n\n```python\ndef fibonacci(n: int) -> int:\n    """Calculate the nth Fibonacci number."""\n    if n <= 1:\n        return n\n    return fibonacci(n - 1) + fibonacci(n - 2)\n\nprint(fibonacci(10))  # Output: 55\n```',
    modified: "2026-02-01T15:10:55.095Z",
    size: 467,
    color: "#f97316",
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

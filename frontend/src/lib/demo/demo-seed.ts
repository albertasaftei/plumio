// Demo seed data - sample documents for the demo

export const sampleDocuments = [
  {
    path: "/Welcome.md",
    content: `# Welcome to Pluma! 🎉

This is a **demo version** of Pluma running entirely in your browser using localStorage.

## Features you can try:

- **Rich markdown editing** with real-time preview
- **Code blocks** with syntax highlighting
- **Math equations** (buggy at the moment - [issue open](https://github.com/albertasaftei/plumio/issues/1)): $E = mc^2$ and $$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$
- **Tables, lists, and more!**

## What's different in demo mode?

- All data is stored in your browser's localStorage
- No backend server required
- Data persists until you clear browser storage
- Perfect for trying out Pluma without installing anything

## Get started

Try creating a new document, organizing with folders, or archiving documents you don't need.

Want to self-host? Check out [our documentation](https://plumio.app) for installation instructions.`,
    modified: new Date().toISOString(),
    size: 800,
    color: "#3b82f6",
  },
  {
    path: "/Examples/Math.md",
    content: `# Math Examples

Pluma supports LaTeX math equations via KaTeX.

## Inline Math

Einstein's famous equation: $E = mc^2$

The quadratic formula: $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$

## Block Math

The Fourier transform:

$$
\\hat{f}(\\omega) = \\int_{-\\infty}^{\\infty} f(t) e^{-i\\omega t} dt
$$

Sum of squares:

$$
\\sum_{i=1}^{n} i^2 = \\frac{n(n+1)(2n+1)}{6}
$$`,
    modified: new Date(Date.now() - 86400000).toISOString(),
    size: 450,
  },
  {
    path: "/Examples/Code.md",
    content: `# Code Examples

## TypeScript

\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
}

async function fetchUser(id: number): Promise<User> {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
}
\`\`\`

## Python

\`\`\`python
def fibonacci(n: int) -> int:
    """Calculate the nth Fibonacci number."""
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print(fibonacci(10))  # Output: 55
\`\`\``,
    modified: new Date(Date.now() - 172800000).toISOString(),
    size: 380,
  },
];

export const demoUser = {
  username: "demo-user",
  email: "demo-user@pluma.app",
  isAdmin: false,
};

export const demoOrg = {
  id: 1,
  name: "Demo Organization",
  slug: "demo-org",
  role: "admin",
};

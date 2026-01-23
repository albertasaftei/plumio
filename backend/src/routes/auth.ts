import { Hono } from "hono";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcrypt";
import fs from "fs/promises";
import { JWT_SECRET } from "../config.js";

const authRouter = new Hono();

const AUTH_FILE = process.env.AUTH_FILE || "./auth.json";
const jwtSecretKey = new TextEncoder().encode(JWT_SECRET);

interface User {
  username: string;
  passwordHash: string;
}

// Initialize auth file if it doesn't exist
async function initAuthFile() {
  try {
    await fs.access(AUTH_FILE);
  } catch {
    await fs.writeFile(AUTH_FILE, JSON.stringify({ users: [] }));
  }
}

// Setup - Create initial user (only if no users exist)
authRouter.post("/setup", async (c) => {
  await initAuthFile();
  const data = await fs.readFile(AUTH_FILE, "utf-8");
  const authData = JSON.parse(data);

  if (authData.users && authData.users.length > 0) {
    return c.json({ error: "Setup already completed" }, 400);
  }

  const { username, password } = await c.req.json();

  if (!username || !password || password.length < 8) {
    return c.json(
      { error: "Invalid username or password (min 8 characters)" },
      400,
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  authData.users = [{ username, passwordHash }];

  await fs.writeFile(AUTH_FILE, JSON.stringify(authData, null, 2));

  return c.json({ message: "Setup completed successfully" });
});

// Login
authRouter.post("/login", async (c) => {
  await initAuthFile();
  const { username, password } = await c.req.json();

  const data = await fs.readFile(AUTH_FILE, "utf-8");
  const authData = JSON.parse(data);

  const user = authData.users?.find((u: User) => u.username === username);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = await new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(jwtSecretKey);

  return c.json({ token, username });
});

// Verify token middleware
export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, jwtSecretKey);
    return payload;
  } catch {
    return null;
  }
}

// Check if setup is needed
authRouter.get("/check-setup", async (c) => {
  await initAuthFile();
  const data = await fs.readFile(AUTH_FILE, "utf-8");
  const authData = JSON.parse(data);

  return c.json({ needsSetup: !authData.users || authData.users.length === 0 });
});

export { authRouter };

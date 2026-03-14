import { getUserByToken, sanitizeUser } from "../data/store.js";
import { fail } from "../lib/apiResponse.js";

export async function attachUser(req, _res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (token) {
    const user = await getUserByToken(token);
    if (user) {
      req.user = sanitizeUser(user);
      req.token = token;
    }
  }

  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json(fail("Unauthorized", 401));
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json(fail("Unauthorized", 401));
  }
  if (req.user.role !== "ADMIN") {
    return res.status(403).json(fail("Forbidden", 403));
  }
  next();
}

import { User } from "../models/User.js";
import { verifyToken, getUserByToken, sanitizeUser } from "../data/store.js";
import { fail } from "../lib/apiResponse.js";

/**
 * Middleware: gắn user vào req nếu có Bearer token hợp lệ.
 * Ưu tiên tìm user từ MongoDB, fallback sang in-memory store.
 */
export async function attachUser(req, _res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (token) {
    // Thử verify JWT và tìm user trong MongoDB
    const userId = verifyToken(token);
    if (userId) {
      try {
        const mongoUser = await User.findById(userId);
        if (mongoUser) {
          req.user = sanitizeUser(mongoUser);
          req.token = token;
          return next();
        }
      } catch {
        // Nếu userId không phải ObjectId hợp lệ, fallback sang in-memory
      }
    }

    // Fallback: in-memory store (legacy tokens)
    const memUser = getUserByToken(token);
    if (memUser) {
      req.user = sanitizeUser(memUser);
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

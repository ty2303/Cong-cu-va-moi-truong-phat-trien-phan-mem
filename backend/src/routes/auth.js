import { randomBytes, randomUUID } from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { db, issueToken, sanitizeUser } from "../data/store.js";
import { isDatabaseReady } from "../data/mongodb.js";
import { fail, ok } from "../lib/apiResponse.js";

export const authRouter = express.Router();

const GOOGLE_AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const DEFAULT_GOOGLE_SCOPES = "openid email profile";

function getFrontendUrl() {
  return process.env.FRONTEND_URL?.split(",")[0]?.trim() || "http://localhost:5173";
}

function getBackendUrl(req) {
  return (
    process.env.BACKEND_URL?.trim() ||
    `${req.protocol}://${req.get("host")}`
  );
}

function buildFrontendLoginUrl(errorCode) {
  const url = new URL("/login", getFrontendUrl());
  if (errorCode) {
    url.searchParams.set("error", errorCode);
  }
  return url.toString();
}

function buildFrontendCallbackUrl(params) {
  const url = new URL("/oauth2/callback", getFrontendUrl());
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function getGoogleConfig(req) {
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    `${getBackendUrl(req)}/api/auth/google/callback`;

  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
    scopes: process.env.GOOGLE_SCOPES ?? DEFAULT_GOOGLE_SCOPES,
    jwtSecret: process.env.JWT_SECRET || "development-secret",
  };
}

function createGoogleStateToken(jwtSecret) {
  return jwt.sign({ nonce: randomBytes(16).toString("hex") }, jwtSecret, {
    expiresIn: "10m",
  });
}

function verifyGoogleStateToken(state, jwtSecret) {
  try {
    jwt.verify(state, jwtSecret);
    return true;
  } catch {
    return false;
  }
}

function normalizeUsernameSeed(profile) {
  const rawSeed =
    profile.name?.trim() || profile.email?.split("@")[0] || "google_user";

  return rawSeed
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24)
    .toLowerCase() || "google_user";
}

async function isUsernameTaken(username) {
  if (isDatabaseReady()) {
    const existing = await User.findOne({ username }).lean();
    return Boolean(existing);
  }

  return db.users.some((user) => user.username === username);
}

async function generateUniqueUsername(profile) {
  const base = normalizeUsernameSeed(profile);

  if (!(await isUsernameTaken(base))) {
    return base;
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `${base.slice(0, 18)}_${randomBytes(3).toString("hex")}`;
    if (!(await isUsernameTaken(candidate))) {
      return candidate;
    }
  }

  return `google_${randomBytes(4).toString("hex")}`;
}

async function findGoogleUserByEmail(email) {
  if (isDatabaseReady()) {
    const mongoUser = await User.findOne({ email });
    if (mongoUser) {
      return { user: mongoUser, source: "mongo" };
    }
  }

  const memoryUser = db.users.find((user) => user.email === email);
  if (memoryUser) {
    return { user: memoryUser, source: "memory" };
  }

  return { user: null, source: isDatabaseReady() ? "mongo" : "memory" };
}

async function upsertGoogleUser(profile) {
  const email = profile.email?.trim().toLowerCase();
  if (!email) {
    throw new Error("Google account is missing email");
  }

  const { user, source } = await findGoogleUserByEmail(email);

  if (user) {
    if (source === "mongo") {
      if (user.authProvider === "LOCAL") {
        user.authProvider = "GOOGLE_AND_LOCAL";
        await user.save();
      }
      return user;
    }

    if (user.authProvider === "LOCAL") {
      user.authProvider = "GOOGLE_AND_LOCAL";
    }
    return user;
  }

  const username = await generateUniqueUsername(profile);
  const fallbackPassword = randomUUID();

  if (isDatabaseReady()) {
    return User.create({
      username,
      email,
      password: fallbackPassword,
      role: "USER",
      hasPassword: false,
      authProvider: "GOOGLE",
    });
  }

  const newUser = {
    id: randomUUID(),
    username,
    email,
    password: fallbackPassword,
    role: "USER",
    hasPassword: false,
    authProvider: "GOOGLE",
    createdAt: new Date().toISOString(),
  };
  db.users.unshift(newUser);
  return newUser;
}

async function exchangeGoogleCode({ code, clientId, clientSecret, redirectUri }) {
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to exchange Google authorization code");
  }

  const tokenPayload = await tokenResponse.json();
  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`,
    },
  });

  if (!userInfoResponse.ok) {
    throw new Error("Failed to fetch Google user profile");
  }

  return userInfoResponse.json();
}

authRouter.get("/google", (req, res) => {
  const { clientId, clientSecret, redirectUri, scopes, jwtSecret } = getGoogleConfig(req);
  if (!clientId || !clientSecret) {
    return res.redirect(buildFrontendLoginUrl("google_not_configured"));
  }

  const authUrl = new URL(GOOGLE_AUTH_BASE_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", createGoogleStateToken(jwtSecret));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("prompt", "select_account");

  return res.redirect(authUrl.toString());
});

authRouter.get("/google/callback", async (req, res) => {
  const { clientId, clientSecret, redirectUri, jwtSecret } = getGoogleConfig(req);
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;
  const oauthError = typeof req.query.error === "string" ? req.query.error : null;

  if (!clientId || !clientSecret) {
    return res.redirect(buildFrontendLoginUrl("google_not_configured"));
  }

  if (oauthError || !code || !state || !verifyGoogleStateToken(state, jwtSecret)) {
    return res.redirect(buildFrontendLoginUrl("google_failed"));
  }

  try {
    const profile = await exchangeGoogleCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });

    if (!profile.email || profile.email_verified === false) {
      return res.redirect(buildFrontendLoginUrl("google_failed"));
    }

    const user = await upsertGoogleUser(profile);
    const safeUser = sanitizeUser(user);
    const token = issueToken(safeUser.id);

    return res.redirect(
      buildFrontendCallbackUrl({
        token,
        id: safeUser.id,
        username: safeUser.username,
        email: safeUser.email,
        role: safeUser.role,
      }),
    );
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return res.redirect(buildFrontendLoginUrl("google_failed"));
  }
});

/**
 * POST /api/auth/login
 * Đăng nhập bằng username + password.
 * - Tìm user theo username trong MongoDB
 * - So sánh password bằng bcrypt (comparePassword)
 * - Trả về JWT token + thông tin user
 */
authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body;

  console.log(`[AUTH] Login attempt for user: ${username}`);

  // Validate input
  if (!username || !password) {
    return res.status(400).json(fail("Vui lòng nhập tên đăng nhập và mật khẩu", 400));
  }

  try {
    // Tìm user theo username (không lọc theo password nữa)
    const user = await User.findOne({
      username,
      authProvider: { $in: ["LOCAL", "GOOGLE_AND_LOCAL"] },
    });

    if (!user) {
      return res.status(401).json(fail("Sai tên đăng nhập hoặc mật khẩu", 401));
    }

    // So sánh password bằng bcrypt
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json(fail("Sai tên đăng nhập hoặc mật khẩu", 401));
    }

    // Tạo JWT token
    const token = issueToken(user._id.toString());

    console.log(`[AUTH] Login successful for user: ${username}`);
    return res.json(ok({ token, ...sanitizeUser(user) }, "Đăng nhập thành công"));
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json(fail("Lỗi server", 500));
  }
});

/**
 * POST /api/auth/register
 * Đăng ký tài khoản mới.
 * - Validate input (username, email, password)
 * - Kiểm tra trùng username/email
 * - Hash password tự động qua pre-save hook
 * - Trả về JWT token + thông tin user
 */
authRouter.post("/register", async (req, res) => {
  const rawUsername = req.body.username;
  const rawEmail = req.body.email;
  const { password } = req.body;

  // Trim input
  const username = typeof rawUsername === "string" ? rawUsername.trim() : "";
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  console.log(`[AUTH] Register attempt for user: ${username}, email: ${email}`);

  // --- Validate input ---
  const errors = {};

  // Kiểm tra trường bắt buộc
  if (!username) errors.username = ["Vui lòng nhập tên đăng nhập"];
  if (!email) errors.email = ["Vui lòng nhập email"];
  if (!password) errors.password = ["Vui lòng nhập mật khẩu"];

  if (Object.keys(errors).length > 0) {
    return res.status(400).json(fail("Vui lòng nhập đầy đủ thông tin đăng ký", 400, errors));
  }

  // Validate username format: chỉ chữ cái, số, gạch dưới, 3-30 ký tự
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json(
      fail(
        "Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới, dài 3-30 ký tự",
        400,
        { username: ["Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới, dài 3-30 ký tự"] }
      )
    );
  }

  // Validate password length
  if (password.length < 6) {
    return res.status(400).json(
      fail("Mật khẩu phải có ít nhất 6 ký tự", 400, {
        password: ["Mật khẩu phải có ít nhất 6 ký tự"]
      })
    );
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json(
      fail("Email không hợp lệ", 400, {
        email: ["Email không hợp lệ"]
      })
    );
  }

  try {
    // Kiểm tra username hoặc email đã tồn tại
    const exists = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (exists) {
      const isUsernameTaken = exists.username === username;
      const field = isUsernameTaken ? "username" : "email";
      const label = isUsernameTaken ? "Tên đăng nhập" : "Email";
      return res.status(409).json(
        fail(`${label} đã được sử dụng`, 409, {
          [field]: [`${label} đã được sử dụng`]
        })
      );
    }

    // Tạo user mới (password sẽ tự hash qua pre-save hook)
    const user = await User.create({
      username,
      email,
      password,
      role: "USER",
      hasPassword: true,
      authProvider: "LOCAL"
    });

    // Tạo JWT token
    const token = issueToken(user._id.toString());

    console.log(`[AUTH] Register successful for user: ${username}`);
    return res.status(201).json(ok({ token, ...sanitizeUser(user) }, "Đăng ký thành công", 201));
  } catch (error) {
    console.error("Register error:", error);

    // Xử lý lỗi duplicate key từ MongoDB
    if (error.code === 11000) {
      const dupField = Object.keys(error.keyPattern || {})[0];
      const label = dupField === "username" ? "Tên đăng nhập" : "Email";
      return res.status(409).json(
        fail(`${label} đã được sử dụng`, 409, {
          [dupField]: [`${label} đã được sử dụng`]
        })
      );
    }

    return res.status(500).json(fail("Lỗi server", 500));
  }
});

/**
 * POST /api/auth/forgot-password
 * Gửi email đặt lại mật khẩu (placeholder).
 */
authRouter.post("/forgot-password", (_req, res) => {
  res.json(ok(null, "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi"));
});

/**
 * POST /api/auth/reset-password
 * Đặt lại mật khẩu (placeholder).
 */
authRouter.post("/reset-password", (_req, res) => {
  res.json(ok(null, "Đặt lại mật khẩu thành công"));
});

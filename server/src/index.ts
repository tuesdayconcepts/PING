import "dotenv/config";
import express, { Request } from "express";
import cors from "cors";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

// Extend Express Request type to include adminId
declare global {
  namespace Express {
    interface Request {
      adminId?: string;
    }
  }
}

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// JWT Secret from environment
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

// Encryption key for Solana private keys (32 bytes = 64 hex characters)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "0000000000000000000000000000000000000000000000000000000000000000"; // 64 hex chars = 32 bytes
const algorithm = 'aes-256-cbc';

// Validate encryption key length
if (Buffer.from(ENCRYPTION_KEY, 'hex').length !== 32) {
  console.error('⚠️  WARNING: ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes)');
  console.error(`Current length: ${Buffer.from(ENCRYPTION_KEY, 'hex').length} bytes`);
  console.error('Generate a secure key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}

// Encryption utilities
const encrypt = (text: string): string => {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data. Check ENCRYPTION_KEY configuration.');
  }
};

const decrypt = (text: string): string => {
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data. Check ENCRYPTION_KEY configuration.');
  }
};

// Rate limiter for login endpoint (10 attempts per 5 minutes)
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 requests per window
  message: { error: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication middleware for admin routes
const authenticateAdmin = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { adminId: string };
    req.adminId = decoded.adminId;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

// Input validation helpers
const validateCoordinates = (lat: number, lng: number): boolean => {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

// Round coordinates to 6 decimal places (~11cm precision)
const roundCoordinate = (coord: number): number => {
  return Math.round(coord * 1000000) / 1000000;
};

const validateDates = (startDate: string, endDate: string): boolean => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return start < end;
};

const sanitizeString = (input: string): string => {
  return input.trim();
};

// Promote next hotspot in queue
const promoteNextHotspot = async () => {
  const nextHotspot = await prisma.hotspot.findFirst({
    where: { queuePosition: { gt: 0 }, claimStatus: 'unclaimed' },
    orderBy: { queuePosition: 'asc' },
  });

  if (nextHotspot) {
    await prisma.hotspot.update({
      where: { id: nextHotspot.id },
      data: { queuePosition: 0 },
    });
  }
};

// Log admin action helper
const logAdminAction = async (
  adminId: string,
  action: string,
  entity: string,
  entityId: string,
  details?: string
) => {
  await prisma.adminLog.create({
    data: {
      adminId,
      action,
      entity,
      entityId,
      details,
    },
  });
};

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ 
    ok: true, 
    service: "scavenger-hunt-server",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

// One-time setup endpoint to seed database (call this once after first deploy)
app.post("/api/setup", async (_req, res) => {
  try {
    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { username: "admin" },
    });

    if (existingAdmin) {
      return res.status(400).json({ 
        error: "Setup already completed. Admin user already exists." 
      });
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await prisma.admin.create({
      data: {
        username: "admin",
        password: hashedPassword,
      },
    });

    // Create sample hotspots
    await prisma.hotspot.createMany({
      data: [
        {
          id: "1",
          title: "Central Park Treasure",
          description: "Find the hidden bench near Bethesda Fountain. Look for the brass plaque with a riddle. Solve it to claim your prize!",
          lat: 40.7711,
          lng: -73.9747,
          prize: "Free coffee at Central Perk Cafe",
          startDate: new Date("2025-01-01T09:00:00Z"),
          endDate: new Date("2025-12-31T18:00:00Z"),
          active: true,
        },
        {
          id: "2",
          title: "Brooklyn Bridge Mystery",
          description: "Walk to the center of Brooklyn Bridge. Count the number of lampposts on the Manhattan side. The answer is your clue!",
          lat: 40.7061,
          lng: -73.9969,
          prize: "$10 gift card",
          startDate: new Date("2025-01-15T10:00:00Z"),
          endDate: new Date("2025-06-30T20:00:00Z"),
          active: true,
        },
        {
          id: "3",
          title: "Times Square Challenge",
          description: "Find the red stairs at Times Square. Take a photo with the costumed characters. Show it at the info booth to win!",
          lat: 40.758,
          lng: -73.9855,
          prize: "Broadway show tickets discount",
          startDate: new Date("2024-12-01T08:00:00Z"),
          endDate: new Date("2024-12-31T23:59:59Z"),
          active: false,
        },
      ],
    });

    res.json({
      success: true,
      message: "Database seeded successfully!",
      credentials: {
        username: "admin",
        password: "admin123",
      },
    });
  } catch (error) {
    console.error("Setup error:", error);
    res.status(500).json({ error: "Setup failed", details: error });
  }
});

// ===== AUTHENTICATION ROUTES =====

// POST /api/auth/login - Admin login
app.post("/api/auth/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    // Find admin user
    const admin = await prisma.admin.findUnique({
      where: { username: sanitizeString(username) },
    });

    if (!admin) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT token (7 day expiry)
    const token = jwt.sign({ adminId: admin.id }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      token,
      role: admin.role || 'editor', // Include role in login response
      username: admin.username,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===== HOTSPOT ROUTES =====

// GET /api/hotspots - Get all hotspots (active only for public, all for admin)
app.get("/api/hotspots", async (req, res) => {
  try {
    const isAdmin = req.query.admin === "true";
    const token = req.headers.authorization?.split(" ")[1];

    let includeInactive = false;

    // Check if authenticated admin when requesting all hotspots
    if (isAdmin && token) {
      try {
        jwt.verify(token, JWT_SECRET);
        includeInactive = true;
      } catch {
        // Invalid token, only return active hotspots
      }
    }

    // For public: only show queuePosition = 0 and claimStatus != "claimed"
    // For admin: show all hotspots
    const hotspots = await prisma.hotspot.findMany({
      where: includeInactive 
        ? {} 
        : { 
            active: true, 
            queuePosition: 0,
            claimStatus: { not: "claimed" }
          },
      orderBy: includeInactive ? { createdAt: "desc" } : { queuePosition: "asc" },
    });

    res.json(hotspots);
  } catch (error) {
    console.error("Get hotspots error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/hotspots/:id - Get single hotspot
app.get("/api/hotspots/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const hotspot = await prisma.hotspot.findUnique({
      where: { id },
    });

    if (!hotspot) {
      return res.status(404).json({ error: "Hotspot not found" });
    }

    // Decrypt private key if hotspot is claimed
    const response = {
      ...hotspot,
      privateKey: hotspot.claimStatus === 'claimed' && hotspot.privateKey
        ? decrypt(hotspot.privateKey)
        : null
    };

    res.json(response);
  } catch (error) {
    console.error("Get hotspot error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/hotspots - Create new hotspot (admin only)
app.post("/api/hotspots", authenticateAdmin, async (req: any, res) => {
  try {
    const {
      title,
      description,
      lat,
      lng,
      prize,
      endDate,
      active,
      imageUrl,
      privateKey,
    } = req.body;

    // Validation
    if (!title || !description || lat === undefined || lng === undefined) {
      return res.status(400).json({
        error: "Title, description, latitude, and longitude are required",
      });
    }

    if (!validateCoordinates(lat, lng)) {
      return res.status(400).json({
        error: "Invalid coordinates (lat: -90 to 90, lng: -180 to 180)",
      });
    }

    // Auto-set startDate to now
    const startDate = new Date();
    
    // Default endDate to 100 years in future if not provided (no expiration)
    const finalEndDate = endDate 
      ? new Date(endDate) 
      : new Date(startDate.getTime() + 100 * 365 * 24 * 60 * 60 * 1000);

    if (endDate && !validateDates(startDate.toISOString(), endDate)) {
      return res.status(400).json({
        error: "End date must be in the future",
      });
    }

    // Round coordinates to 6 decimal places
    const roundedLat = roundCoordinate(parseFloat(lat));
    const roundedLng = roundCoordinate(parseFloat(lng));

    // Encrypt private key if provided
    const encryptedPrivateKey = privateKey ? encrypt(sanitizeString(privateKey)) : null;

    // Determine queue position: if there are active unclaimed hotspots, add to queue
    const activeHotspots = await prisma.hotspot.findMany({
      where: { queuePosition: 0, claimStatus: 'unclaimed' },
    });

    const queuePosition = activeHotspots.length > 0 
      ? (await prisma.hotspot.count()) + 1 
      : 0;

    // Create hotspot
    const hotspot = await prisma.hotspot.create({
      data: {
        title: sanitizeString(title),
        description: sanitizeString(description),
        lat: roundedLat,
        lng: roundedLng,
        prize: prize ? sanitizeString(prize) : null,
        startDate,
        endDate: finalEndDate,
        active: active !== undefined ? active : true,
        imageUrl: imageUrl ? sanitizeString(imageUrl) : null,
        privateKey: encryptedPrivateKey,
        queuePosition,
        claimStatus: 'unclaimed',
      },
    });

    // Log action
    await logAdminAction(
      req.adminId,
      "CREATE",
      "Hotspot",
      hotspot.id,
      `Created hotspot: ${hotspot.title} (queue position: ${queuePosition})`
    );

    res.status(201).json(hotspot);
  } catch (error) {
    console.error("Create hotspot error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/hotspots/:id - Update hotspot (admin only)
app.put("/api/hotspots/:id", authenticateAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      lat,
      lng,
      prize,
      startDate,
      endDate,
      active,
      imageUrl,
    } = req.body;

    // Check if hotspot exists
    const existing = await prisma.hotspot.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Hotspot not found" });
    }

    // Validation
    if (lat !== undefined && lng !== undefined) {
      if (!validateCoordinates(lat, lng)) {
        return res.status(400).json({
          error: "Invalid coordinates (lat: -90 to 90, lng: -180 to 180)",
        });
      }
    }

    if (startDate && endDate) {
      if (!validateDates(startDate, endDate)) {
        return res.status(400).json({
          error: "Start date must be before end date",
        });
      }
    }

    // Round coordinates if provided
    const roundedLat = lat !== undefined ? roundCoordinate(parseFloat(lat)) : undefined;
    const roundedLng = lng !== undefined ? roundCoordinate(parseFloat(lng)) : undefined;

    // Update hotspot
    const hotspot = await prisma.hotspot.update({
      where: { id },
      data: {
        ...(title && { title: sanitizeString(title) }),
        ...(description && { description: sanitizeString(description) }),
        ...(roundedLat !== undefined && { lat: roundedLat }),
        ...(roundedLng !== undefined && { lng: roundedLng }),
        ...(prize !== undefined && { prize: prize ? sanitizeString(prize) : null }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(active !== undefined && { active }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl ? sanitizeString(imageUrl) : null }),
      },
    });

    // Log action
    await logAdminAction(
      req.adminId,
      "UPDATE",
      "Hotspot",
      hotspot.id,
      `Updated hotspot: ${hotspot.title}`
    );

    res.json(hotspot);
  } catch (error) {
    console.error("Update hotspot error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/hotspots/:id - Delete hotspot (admin only)
app.delete("/api/hotspots/:id", authenticateAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;

    // Check if hotspot exists
    const existing = await prisma.hotspot.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Hotspot not found" });
    }

    // Delete hotspot
    await prisma.hotspot.delete({ where: { id } });

    // Log action
    await logAdminAction(
      req.adminId,
      "DELETE",
      "Hotspot",
      id,
      `Deleted hotspot: ${existing.title}`
    );

    res.json({ message: "Hotspot deleted successfully" });
  } catch (error) {
    console.error("Delete hotspot error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/hotspots/:id/claim - Claim a hotspot (public)
app.post("/api/hotspots/:id/claim", async (req, res) => {
  try {
    const { id } = req.params;
    const { tweetUrl } = req.body;

    // Get hotspot
    const hotspot = await prisma.hotspot.findUnique({ where: { id } });
    if (!hotspot) {
      return res.status(404).json({ error: "Hotspot not found" });
    }

    // Check if already claimed or pending
    if (hotspot.claimStatus !== "unclaimed") {
      return res.status(400).json({
        error: `This hotspot is already ${hotspot.claimStatus}`,
      });
    }

    // Get user identifier (IP address as fallback)
    const claimedBy = req.ip || 'unknown';

    // Update hotspot to pending status
    await prisma.hotspot.update({
      where: { id },
      data: {
        claimStatus: "pending",
        claimedBy,
        claimedAt: new Date(),
        tweetUrl: tweetUrl || null,
      },
    });

    res.json({
      success: true,
      message: "Claim submitted! Waiting for admin approval.",
      status: "pending",
    });
  } catch (error) {
    console.error("Claim hotspot error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/hotspots/:id/approve - Approve a claim (admin only)
app.post("/api/hotspots/:id/approve", authenticateAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;

    // Get hotspot
    const hotspot = await prisma.hotspot.findUnique({ where: { id } });
    if (!hotspot) {
      return res.status(404).json({ error: "Hotspot not found" });
    }

    // Check if pending
    if (hotspot.claimStatus !== "pending") {
      return res.status(400).json({
        error: "Hotspot is not pending approval",
      });
    }

    // Update hotspot to claimed status
    await prisma.hotspot.update({
      where: { id },
      data: {
        claimStatus: "claimed",
      },
    });

    // Promote next hotspot in queue
    await promoteNextHotspot();

    // Decrypt private key to return to user
    const decryptedKey = hotspot.privateKey ? decrypt(hotspot.privateKey) : null;

    // Log action
    await logAdminAction(
      req.adminId,
      "APPROVE_CLAIM",
      "Hotspot",
      id,
      `Approved claim for hotspot: ${hotspot.title}`
    );

    res.json({
      success: true,
      message: "Claim approved!",
      privateKey: decryptedKey,
    });
  } catch (error) {
    console.error("Approve claim error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/claims - Get pending claims (admin only)
app.get("/api/admin/claims", authenticateAdmin, async (req, res) => {
  try {
    const pendingClaims = await prisma.hotspot.findMany({
      where: { claimStatus: "pending" },
      orderBy: { claimedAt: "asc" },
    });

    res.json(pendingClaims);
  } catch (error) {
    console.error("Get pending claims error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===== ADMIN LOG ROUTES =====

// GET /api/admin/logs - Get recent admin actions (admin only)
app.get("/api/admin/logs", authenticateAdmin, async (req, res) => {
  try {
    const logs = await prisma.adminLog.findMany({
      take: 20,
      orderBy: { timestamp: "desc" },
    });

    res.json(logs);
  } catch (error) {
    console.error("Get logs error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===== USER MANAGEMENT ROUTES (ADMIN ONLY) =====

// Middleware to check if user is admin role
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.adminId },
      select: { role: true },
    });

    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ error: "Forbidden: Admin role required" });
    }

    next();
  } catch (error) {
    console.error("Role check error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/admin/users - List all admin users (admin only)
app.get("/api/admin/users", authenticateAdmin, async (req, res) => {
  try {
    // Get current user's role
    const currentAdmin = await prisma.admin.findUnique({
      where: { id: req.adminId },
      select: { role: true },
    });

    // Get all users (only if current user is admin)
    if (currentAdmin?.role === 'admin') {
      const users = await prisma.admin.findMany({
        select: {
          id: true,
          username: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        users,
        currentUserRole: currentAdmin.role,
      });
    } else {
      // Editors can only see their own info
      const currentUser = await prisma.admin.findUnique({
        where: { id: req.adminId },
        select: {
          id: true,
          username: true,
          role: true,
          createdAt: true,
        },
      });

      res.json({
        users: currentUser ? [currentUser] : [],
        currentUserRole: currentAdmin?.role || 'editor',
      });
    }
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/users - Create new admin user (admin only)
app.post("/api/admin/users", authenticateAdmin, requireAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: "Username, password, and role required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    if (role !== 'admin' && role !== 'editor') {
      return res.status(400).json({ error: "Role must be 'admin' or 'editor'" });
    }

    // Check if username already exists
    const existing = await prisma.admin.findUnique({
      where: { username: sanitizeString(username) },
    });

    if (existing) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.admin.create({
      data: {
        username: sanitizeString(username),
        password: hashedPassword,
        role,
      },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    // Log the action
    await prisma.adminLog.create({
      data: {
        adminId: req.adminId!, // Non-null assertion: authenticateAdmin middleware guarantees this is set
        action: "CREATE",
        entity: "Admin",
        entityId: newUser.id,
        details: `Created ${role} user: ${username}`,
      },
    });

    res.json(newUser);
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/users/:id/role - Update user role (admin only)
app.put("/api/admin/users/:id/role", authenticateAdmin, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (role !== 'admin' && role !== 'editor') {
      return res.status(400).json({ error: "Role must be 'admin' or 'editor'" });
    }

    // Can't change your own role
    if (id === req.adminId) {
      return res.status(400).json({ error: "Cannot change your own role" });
    }

    const user = await prisma.admin.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    // Log the action
    await prisma.adminLog.create({
      data: {
        adminId: req.adminId!, // Non-null assertion: authenticateAdmin middleware guarantees this is set
        action: "UPDATE",
        entity: "Admin",
        entityId: id,
        details: `Changed role to ${role} for user: ${user.username}`,
      },
    });

    res.json(user);
  } catch (error) {
    console.error("Update role error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/admin/users/:id - Delete admin user (admin only)
app.delete("/api/admin/users/:id", authenticateAdmin, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Can't delete yourself
    if (id === req.adminId) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const user = await prisma.admin.findUnique({
      where: { id },
      select: { username: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await prisma.admin.delete({
      where: { id },
    });

    // Log the action
    await prisma.adminLog.create({
      data: {
        adminId: req.adminId!, // Non-null assertion: authenticateAdmin middleware guarantees this is set
        action: "DELETE",
        entity: "Admin",
        entityId: id,
        details: `Deleted user: ${user.username}`,
      },
    });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start server
const port = process.env.PORT ? Number(process.env.PORT) : 8080;
app.listen(port, () => {
  console.log(`🚀 Scavenger Hunt API listening on :${port}`);
});

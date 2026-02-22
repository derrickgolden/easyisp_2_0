import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("isp_admin.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    status TEXT DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'Online',
    FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'Active',
    FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
  );
`);

// Seed data if empty
const orgCount = db.prepare("SELECT COUNT(*) as count FROM organizations").get() as { count: number };
if (orgCount.count === 0) {
  const insertOrg = db.prepare("INSERT INTO organizations (name, email, phone, status) VALUES (?, ?, ?, ?)");
  const insertSite = db.prepare("INSERT INTO sites (organization_id, name, status) VALUES (?, ?, ?)");
  const insertCustomer = db.prepare("INSERT INTO customers (organization_id, name, status) VALUES (?, ?, ?)");

  const org1 = insertOrg.run("Global Net Solutions", "admin@globalnet.com", "+1234567890", "Active");
  insertSite.run(org1.lastInsertRowid, "Main Hub - Downtown", "Online");
  insertSite.run(org1.lastInsertRowid, "North Branch", "Online");
  insertCustomer.run(org1.lastInsertRowid, "John Doe", "Active");
  insertCustomer.run(org1.lastInsertRowid, "Jane Smith", "Active");

  const org2 = insertOrg.run("Fast Fiber Co", "contact@fastfiber.io", "+0987654321", "Active");
  insertSite.run(org2.lastInsertRowid, "Central Station", "Online");
  insertCustomer.run(org2.lastInsertRowid, "Alice Brown", "Active");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Auth API
  app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    // Simple mock authentication
    if (email === "admin@easytech.com" && password === "admin123") {
      res.json({ token: "mock-jwt-token-123", user: { name: "Admin User", role: "Super Admin" } });
    } else {
      res.status(401).json({ error: "Invalid email or password" });
    }
  });

  // API Routes
  app.get("/api/organizations", (req, res) => {
    const orgs = db.prepare(`
      SELECT 
        o.*,
        (SELECT COUNT(*) FROM sites s WHERE s.organization_id = o.id) as sites_count,
        (SELECT COUNT(*) FROM customers c WHERE c.organization_id = o.id) as customers_count
      FROM organizations o
      ORDER BY o.created_at DESC
    `).all();
    res.json(orgs);
  });

  app.get("/api/organizations/:id", (req, res) => {
    const org = db.prepare("SELECT * FROM organizations WHERE id = ?").get(req.params.id);
    if (!org) return res.status(404).json({ error: "Not found" });
    
    const sites = db.prepare("SELECT * FROM sites WHERE organization_id = ?").all(req.params.id);
    const customers = db.prepare("SELECT * FROM customers WHERE organization_id = ?").all(req.params.id);
    
    res.json({ ...org, sites, customers });
  });

  app.post("/api/organizations", (req, res) => {
    const { name, email, phone, status } = req.body;
    try {
      const result = db.prepare("INSERT INTO organizations (name, email, phone, status) VALUES (?, ?, ?, ?)").run(name, email, phone, status || 'Active');
      res.json({ id: result.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/organizations/:id", (req, res) => {
    const { name, email, phone, status } = req.body;
    try {
      db.prepare("UPDATE organizations SET name = ?, email = ?, phone = ?, status = ? WHERE id = ?").run(name, email, phone, status, req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/organizations/:id", (req, res) => {
    db.prepare("DELETE FROM organizations WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Sites API
  app.get("/api/sites", (req, res) => {
    const sites = db.prepare(`
      SELECT s.*, o.name as organization_name 
      FROM sites s 
      JOIN organizations o ON s.organization_id = o.id
    `).all();
    res.json(sites);
  });

  // Customers API
  app.get("/api/customers", (req, res) => {
    const customers = db.prepare(`
      SELECT c.*, o.name as organization_name 
      FROM customers c 
      JOIN organizations o ON c.organization_id = o.id
    `).all();
    res.json(customers);
  });

  // Billing Summary API
  app.get("/api/billing-summary", (req, res) => {
    const summary = db.prepare(`
      SELECT 
        o.id as organization_id,
        o.name as organization_name,
        COUNT(c.id) as total_customers,
        SUM(CASE WHEN c.status = 'Active' THEN 1 ELSE 0 END) as active_customers
      FROM organizations o
      LEFT JOIN customers c ON o.id = c.organization_id
      GROUP BY o.id
    `).all();
    res.json(summary);
  });

  // Stats for dashboard
  app.get("/api/stats", (req, res) => {
    const totalOrgs = db.prepare("SELECT COUNT(*) as count FROM organizations").get() as any;
    const totalSites = db.prepare("SELECT COUNT(*) as count FROM sites").get() as any;
    const totalCustomers = db.prepare("SELECT COUNT(*) as count FROM customers").get() as any;
    const activeOrgs = db.prepare("SELECT COUNT(*) as count FROM organizations WHERE status = 'Active'").get() as any;

    res.json({
      totalOrganizations: totalOrgs.count,
      totalSites: totalSites.count,
      totalCustomers: totalCustomers.count,
      activeOrganizations: activeOrgs.count
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

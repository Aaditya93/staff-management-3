// @ts-nocheck
import express from "express";
import { processAllUserEmails } from "./process-email";
import { createHotels, CreateHotelsInput } from "./hotel/api";
import multer from "multer";
import { extractHotelData } from "./hotel/ai";
import fs from "fs";
import path from "path";
import cors from "cors";
import http from "http";
import https from "https";
import { execSync } from "child_process";

// Extend Express Request type to include 'file' property from multer
declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
    }
  }
}

// Initialize Express app
const app = express();
const PORT = Number(process.env.PORT) || 3001;
const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 443;

// CORS configuration for bukxe.com
app.use(cors());

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Create uploads directory if it doesn't exist
const uploadsDir = "tmp/uploads/";
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer to preserve the original file extension
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${Date.now()}${ext}`);
  },
});

const upload = multer({ storage: storage });

// Add a simple health check route
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Bukxe Email Scanner Server is running",
    domain: "bukxe.com",
    timestamp: new Date().toISOString(),
  });
});

// Add root route
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "Bukxe Email Scanner Server",
    domain: "bukxe.com",
    endpoints: ["/health", "/hotels"],
    timestamp: new Date().toISOString(),
  });
});

// API route for creating hotels
app.post("/hotels", upload.single("file"), async (req, res) => {
  try {
    const { supplierId, country, city, currency,createdBy,requestId } = req.body;
    const file = req.file;

    if (!file || !supplierId || !country || !city || !currency || !createdBy || !requestId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields or file" });
    }

   
    // Pass the required parameters to extractHotelData, but do not await it
    extractHotelData(
      file.path,
      supplierId,
      country,
      city,
      currency,
      requestId,
      createdBy
    ).catch((error) => {
      console.error("Error in background hotel extraction:", error);
    });

    // Immediately respond to the client that processing has started
    res.status(202).json({
      success: true,
      message: "Hotel data extraction and processing has started. You will be notified when it is complete.",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in /hotels endpoint:", error);

    // Clean up the uploaded file on error (backup cleanup)
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error("Error cleaning up file:", cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: err.message || "An unexpected error occurred",
    timestamp: new Date().toISOString(),
  });
});

const startPeriodicEmailProcessing = () => {
  setInterval(async () => {
    try {
      await processAllUserEmails();
    } catch (error) {
      console.error("Error in scheduled email processing:", error);
    }
  }, 15000);
};

// Start periodic email processing
startPeriodicEmailProcessing();

// Production SSL setup
const isProduction = process.env.NODE_ENV === 'production';
const useSSL = process.env.USE_SSL === 'true' || isProduction;

if (useSSL) {
  try {
    // Production SSL certificate paths (for Let's Encrypt)
    const sslDir = process.env.SSL_DIR || '/etc/letsencrypt/live/bukxe.com';
    const keyPath = process.env.SSL_KEY_PATH || path.join(sslDir, 'privkey.pem');
    const certPath = process.env.SSL_CERT_PATH || path.join(sslDir, 'fullchain.pem');

    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
      console.log("🔒 SSL certificates not found.");
      
      if (isProduction) {
        console.error("❌ Production SSL certificates are required!");
        console.log("🔧 To get Let's Encrypt certificates, run:");
        console.log("   sudo apt update && sudo apt install certbot");
        console.log("   sudo certbot certonly --standalone -d bukxe.com");
        console.log("   sudo chown -R $USER:$USER /etc/letsencrypt/live/bukxe.com/");
        console.log("   Or set SSL_KEY_PATH and SSL_CERT_PATH environment variables");
        
        // In production, fall back to HTTP instead of exiting
        console.log("⚠️  Starting HTTP server as fallback...");
        startHttpServer();
        return;
      } else {
        console.log("🔧 Development mode: Creating self-signed certificates...");
        
        if (!fs.existsSync(sslDir)) {
          fs.mkdirSync(sslDir, { recursive: true });
        }

        const openSSLCommand = `openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Bukxe/CN=bukxe.com"`;

        try {
          execSync(openSSLCommand, { stdio: "inherit" });
          console.log("✅ Development SSL certificates created!");
        } catch (certError) {
          console.error("❌ Failed to create SSL certificates:", certError);
          console.log("⚠️  Falling back to HTTP server...");
          startHttpServer();
          return;
        }
      }
    } else {
      console.log("✅ SSL certificates found");
    }

    const sslOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };

    // Start HTTPS server
    https.createServer(sslOptions, app).listen(HTTPS_PORT, "0.0.0.0", () => {
      console.log(`✅ HTTPS Server running on port ${HTTPS_PORT}`);
      console.log(`🔒 Secure Bukxe Email Scanner Server accessible at:`);
      console.log(`   - https://bukxe.com`);
      if (!isProduction) {
        console.log(`   - https://localhost:${HTTPS_PORT}`);
      }
      console.log(`📊 API Endpoints (HTTPS):`);
      console.log(`   - GET  /health (health check)`);
      console.log(`   - POST /hotels (hotel data processing)`);
      
      if (!isProduction) {
        console.log("⚠️  Note: Using self-signed certificate in development mode.");
      }
    });

    // In production, also start HTTP server for redirects
    if (isProduction) {
      const httpRedirectApp = express();
      httpRedirectApp.use((req, res) => {
        res.redirect(301, `https://${req.headers.host}${req.url}`);
      });
      
      httpRedirectApp.listen(PORT, "0.0.0.0", () => {
        console.log(`✅ HTTP Redirect Server running on port ${PORT}`);
        console.log(`🔄 Redirecting HTTP traffic to HTTPS`);
      });
    } else {
      // Development: also start HTTP server
      startHttpServer();
    }

  } catch (error) {
    console.error("❌ Failed to start HTTPS server:", error);
    console.log("⚠️  Falling back to HTTP server...");
    startHttpServer();
  }
} else {
  console.log("🔧 SSL disabled, starting HTTP server only");
  startHttpServer();
}

function startHttpServer() {
  const httpServer = http.createServer(app);
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ HTTP Server running on port ${PORT}`);
    console.log(`🌐 Bukxe Email Scanner Server accessible at:`);
    console.log(`   - http://localhost:${PORT}`);
    console.log(`   - http://bukxe.com:${PORT}`);
    console.log(`📊 API Endpoints:`);
    console.log(`   - GET  /health (health check)`);
    console.log(`   - POST /hotels (hotel data processing)`);
  });
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  process.exit(0);
});

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

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cors());

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
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Add root route
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "Email Scanner Server",
    endpoints: ["/health", "/hotels"],
    timestamp: new Date().toISOString(),
  });
});

// API route for creating hotels
app.post("/hotels", upload.single("file"), async (req, res) => {
  try {
    const { supplierId, country, city, currency } = req.body;
    const file = req.file;

    if (!file || !supplierId || !country || !city || !currency) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields or file" });
    }

    console.log(
      "Processing file:",
      file.originalname,
      "Type:",
      file.mimetype,
      "Size:",
      file.size
    );

    const extractResult = await extractHotelData(file.path);

    console.log("Extract result:", extractResult);

    if (
      !extractResult ||
      !extractResult.hotels ||
      extractResult.hotels.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "No hotel data found in the file. Please check if the file contains valid hotel data and is in the correct format.",
      });
    }

    const result = await createHotels({
      hotels: extractResult.hotels,
      supplierId: supplierId.trim(),
      country: country.trim(),
      city: city.trim(),
      currency: currency.trim(),
    });

    fs.unlinkSync(file.path);

    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("Error in /hotels endpoint:", error);

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

// HTTPS setup with auto-certificate creation
try {
  const sslDir = path.join(__dirname, "ssl");
  const keyPath = path.join(sslDir, "key.pem");
  const certPath = path.join(sslDir, "cert.pem");

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.log(
      "🔒 SSL certificates not found. Creating self-signed certificates..."
    );

    try {
      if (!fs.existsSync(sslDir)) {
        fs.mkdirSync(sslDir, { recursive: true });
        console.log("📁 Created ssl directory");
      }

      const openSSLCommand = `openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"`;

      console.log("🔐 Generating SSL certificates...");
      execSync(openSSLCommand, { stdio: "inherit" });

      console.log("✅ SSL certificates created successfully!");
      console.log(`   - Private key: ${keyPath}`);
      console.log(`   - Certificate: ${certPath}`);
    } catch (certError) {
      console.error("❌ Failed to create SSL certificates:", certError);
      console.log(
        "📝 Please install OpenSSL and try again, or create certificates manually:"
      );
      console.log("   mkdir -p ssl");
      console.log(
        "   openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes"
      );
      console.log("⚠️  Falling back to HTTP server...");

      // Fallback to HTTP if SSL fails
      const httpServer = http.createServer(app);
      httpServer.listen(PORT, "0.0.0.0", () => {
        console.log(`✅ HTTP Server running on port ${PORT}`);
        console.log(`🌐 Email Scanner Server accessible at:`);
        console.log(`   - http://localhost:${PORT}`);
        console.log(
          `   - http://ec2-47-129-32-58.ap-southeast-1.compute.amazonaws.com:${PORT}`
        );
        console.log(`📊 API Endpoints:`);
        console.log(`   - GET  /health (health check)`);
        console.log(`   - POST /hotels (hotel data processing)`);
      });
      return;
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
    console.log(`🔒 Secure Email Scanner Server accessible at:`);
    console.log(`   - https://localhost:${HTTPS_PORT}`);
    console.log(
      `   - https://ec2-47-129-32-58.ap-southeast-1.compute.amazonaws.com`
    );
    console.log(`📊 API Endpoints (HTTPS):`);
    console.log(`   - GET  /health (health check)`);
    console.log(`   - POST /hotels (hotel data processing)`);
    console.log(
      "⚠️  Note: Using self-signed certificate. Browsers will show security warning."
    );
  });

  // Also start HTTP server for development/testing
  const httpServer = http.createServer(app);
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ HTTP Server also running on port ${PORT} for testing`);
    console.log(`🌐 HTTP access: http://localhost:${PORT}`);
  });
} catch (error) {
  console.error(
    "❌ Failed to start HTTPS server:",
    error instanceof Error ? error.message : String(error)
  );
  console.log("⚠️  Falling back to HTTP server...");

  // Fallback to HTTP server
  const httpServer = http.createServer(app);
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ HTTP Server running on port ${PORT}`);
    console.log(`🌐 Email Scanner Server accessible at:`);
    console.log(`   - http://localhost:${PORT}`);
    console.log(
      `   - http://ec2-47-129-32-58.ap-southeast-1.compute.amazonaws.com:${PORT}`
    );
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

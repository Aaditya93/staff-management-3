"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const ai_1 = require("./hotel/ai");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const child_process_1 = require("child_process");
// Initialize Express app
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT) || 3001;
const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 443;
// CORS configuration for bukxe.com
app.use((0, cors_1.default)());
// Middleware
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "10mb" }));
// Create uploads directory if it doesn't exist
const uploadsDir = "tmp/uploads/";
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
// Configure multer to preserve the original file extension
const storage = multer_1.default.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        const name = path_1.default.basename(file.originalname, ext);
        cb(null, `${name}-${Date.now()}${ext}`);
    },
});
const upload = (0, multer_1.default)({ storage: storage });
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
app.post("/hotels", upload.single("file"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { supplierId, country, city, currency, createdBy, stars, requestId } = req.body;
        const file = req.file;
        if (!file || !supplierId || !country || !city || !currency || !createdBy || !requestId || !stars) {
            return res
                .status(400)
                .json({ success: false, message: "Missing required fields or file" });
        }
        // Pass the required parameters to extractHotelData, but do not await it
        (0, ai_1.extractHotelData)(file.path, supplierId, country, city, currency, requestId, createdBy, stars).catch((error) => {
            console.error("Error in background hotel extraction:", error);
        });
        // Immediately respond to the client that processing has started
        res.status(202).json({
            success: true,
            message: "Hotel data extraction and processing has started. You will be notified when it is complete.",
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error("Error in /hotels endpoint:", error);
        // Clean up the uploaded file on error (backup cleanup)
        if (req.file) {
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch (cleanupError) {
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
}));
// Error handling middleware
app.use((err, req, res, next) => {
    console.error("❌ Unhandled error:", err);
    res.status(500).json({
        success: false,
        error: "Internal server error",
        message: err.message || "An unexpected error occurred",
        timestamp: new Date().toISOString(),
    });
});
// const startPeriodicEmailProcessing = () => {
//   setInterval(async () => {
//     try {
//       await processAllUserEmails();
//     } catch (error) {
//       console.error("Error in scheduled email processing:", error);
//     }
//   }, 15000);
// };
// // Start periodic email processing
// startPeriodicEmailProcessing();
// Production SSL setup
const isProduction = process.env.NODE_ENV === 'production';
const useSSL = process.env.USE_SSL === 'true' || isProduction;
if (useSSL) {
    try {
        // Production SSL certificate paths (for Let's Encrypt)
        const sslDir = process.env.SSL_DIR || '/etc/letsencrypt/live/bukxe.com';
        const keyPath = process.env.SSL_KEY_PATH || path_1.default.join(sslDir, 'privkey.pem');
        const certPath = process.env.SSL_CERT_PATH || path_1.default.join(sslDir, 'fullchain.pem');
        if (!fs_1.default.existsSync(keyPath) || !fs_1.default.existsSync(certPath)) {
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
            }
            else {
                console.log("🔧 Development mode: Creating self-signed certificates...");
                if (!fs_1.default.existsSync(sslDir)) {
                    fs_1.default.mkdirSync(sslDir, { recursive: true });
                }
                const openSSLCommand = `openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Bukxe/CN=bukxe.com"`;
                try {
                    (0, child_process_1.execSync)(openSSLCommand, { stdio: "inherit" });
                    console.log("✅ Development SSL certificates created!");
                }
                catch (certError) {
                    console.error("❌ Failed to create SSL certificates:", certError);
                    console.log("⚠️  Falling back to HTTP server...");
                    startHttpServer();
                    return;
                }
            }
        }
        else {
            console.log("✅ SSL certificates found");
        }
        const sslOptions = {
            key: fs_1.default.readFileSync(keyPath),
            cert: fs_1.default.readFileSync(certPath),
        };
        // Start HTTPS server
        https_1.default.createServer(sslOptions, app).listen(HTTPS_PORT, "0.0.0.0", () => {
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
            const httpRedirectApp = (0, express_1.default)();
            httpRedirectApp.use((req, res) => {
                res.redirect(301, `https://${req.headers.host}${req.url}`);
            });
            httpRedirectApp.listen(PORT, "0.0.0.0", () => {
                console.log(`✅ HTTP Redirect Server running on port ${PORT}`);
                console.log(`🔄 Redirecting HTTP traffic to HTTPS`);
            });
        }
        else {
            // Development: also start HTTP server
            startHttpServer();
        }
    }
    catch (error) {
        console.error("❌ Failed to start HTTPS server:", error);
        console.log("⚠️  Falling back to HTTP server...");
        startHttpServer();
    }
}
else {
    console.log("🔧 SSL disabled, starting HTTP server only");
    startHttpServer();
}
function startHttpServer() {
    const httpServer = http_1.default.createServer(app);
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

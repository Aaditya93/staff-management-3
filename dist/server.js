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
const process_email_1 = require("./process-email");
const api_1 = require("./hotel/api");
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
// Middleware
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "10mb" }));
app.use((0, cors_1.default)());
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
app.post("/hotels", upload.single("file"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { supplierId, country, city, currency } = req.body;
        const file = req.file;
        if (!file || !supplierId || !country || !city || !currency) {
            return res
                .status(400)
                .json({ success: false, message: "Missing required fields or file" });
        }
        console.log("Processing file:", file.originalname, "Type:", file.mimetype, "Size:", file.size);
        const extractResult = yield (0, ai_1.extractHotelData)(file.path);
        console.log("Extract result:", extractResult);
        if (!extractResult ||
            !extractResult.hotels ||
            extractResult.hotels.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No hotel data found in the file. Please check if the file contains valid hotel data and is in the correct format.",
            });
        }
        const result = yield (0, api_1.createHotels)({
            hotels: extractResult.hotels,
            supplierId: supplierId.trim(),
            country: country.trim(),
            city: city.trim(),
            currency: currency.trim(),
        });
        fs_1.default.unlinkSync(file.path);
        res.status(result.success ? 200 : 400).json(result);
    }
    catch (error) {
        console.error("Error in /hotels endpoint:", error);
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
const startPeriodicEmailProcessing = () => {
    setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield (0, process_email_1.processAllUserEmails)();
        }
        catch (error) {
            console.error("Error in scheduled email processing:", error);
        }
    }), 15000);
};
// Start periodic email processing
startPeriodicEmailProcessing();
// HTTPS setup with auto-certificate creation
try {
    const sslDir = path_1.default.join(__dirname, "ssl");
    const keyPath = path_1.default.join(sslDir, "key.pem");
    const certPath = path_1.default.join(sslDir, "cert.pem");
    if (!fs_1.default.existsSync(keyPath) || !fs_1.default.existsSync(certPath)) {
        console.log("🔒 SSL certificates not found. Creating self-signed certificates...");
        try {
            if (!fs_1.default.existsSync(sslDir)) {
                fs_1.default.mkdirSync(sslDir, { recursive: true });
                console.log("📁 Created ssl directory");
            }
            const openSSLCommand = `openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"`;
            console.log("🔐 Generating SSL certificates...");
            (0, child_process_1.execSync)(openSSLCommand, { stdio: "inherit" });
            console.log("✅ SSL certificates created successfully!");
            console.log(`   - Private key: ${keyPath}`);
            console.log(`   - Certificate: ${certPath}`);
        }
        catch (certError) {
            console.error("❌ Failed to create SSL certificates:", certError);
            console.log("📝 Please install OpenSSL and try again, or create certificates manually:");
            console.log("   mkdir -p ssl");
            console.log("   openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes");
            console.log("⚠️  Falling back to HTTP server...");
            // Fallback to HTTP if SSL fails
            const httpServer = http_1.default.createServer(app);
            httpServer.listen(PORT, "0.0.0.0", () => {
                console.log(`✅ HTTP Server running on port ${PORT}`);
                console.log(`🌐 Email Scanner Server accessible at:`);
                console.log(`   - http://localhost:${PORT}`);
                console.log(`   - http://ec2-47-129-32-58.ap-southeast-1.compute.amazonaws.com:${PORT}`);
                console.log(`📊 API Endpoints:`);
                console.log(`   - GET  /health (health check)`);
                console.log(`   - POST /hotels (hotel data processing)`);
            });
            return;
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
        console.log(`🔒 Secure Email Scanner Server accessible at:`);
        console.log(`   - https://localhost:${HTTPS_PORT}`);
        console.log(`   - https://ec2-47-129-32-58.ap-southeast-1.compute.amazonaws.com`);
        console.log(`📊 API Endpoints (HTTPS):`);
        console.log(`   - GET  /health (health check)`);
        console.log(`   - POST /hotels (hotel data processing)`);
        console.log("⚠️  Note: Using self-signed certificate. Browsers will show security warning.");
    });
    // Also start HTTP server for development/testing
    const httpServer = http_1.default.createServer(app);
    httpServer.listen(PORT, "0.0.0.0", () => {
        console.log(`✅ HTTP Server also running on port ${PORT} for testing`);
        console.log(`🌐 HTTP access: http://localhost:${PORT}`);
    });
}
catch (error) {
    console.error("❌ Failed to start HTTPS server:", error instanceof Error ? error.message : String(error));
    console.log("⚠️  Falling back to HTTP server...");
    // Fallback to HTTP server
    const httpServer = http_1.default.createServer(app);
    httpServer.listen(PORT, "0.0.0.0", () => {
        console.log(`✅ HTTP Server running on port ${PORT}`);
        console.log(`🌐 Email Scanner Server accessible at:`);
        console.log(`   - http://localhost:${PORT}`);
        console.log(`   - http://ec2-47-129-32-58.ap-southeast-1.compute.amazonaws.com:${PORT}`);
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

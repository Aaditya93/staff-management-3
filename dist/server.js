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
const ai_1 = require("./hotel/ai"); // adjust path as needed
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Initialize Express app
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
const cors = require("cors");
// Middleware for parsing JSON
app.use(express_1.default.json());
app.use(cors());
// Configure multer to preserve the original file extension
const storage = multer_1.default.diskStorage({
    destination: "tmp/uploads/",
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        const name = path_1.default.basename(file.originalname, ext);
        cb(null, `${name}-${Date.now()}${ext}`); // Append timestamp to avoid name collisions
    },
});
const upload = (0, multer_1.default)({ storage: storage });
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
        // Pass the file path directly to extractHotelData (not the file object)
        const extractResult = yield (0, ai_1.extractHotelData)(file.path);
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
        // Clean up uploaded file
        fs_1.default.unlinkSync(file.path);
        res.status(result.success ? 200 : 400).json(result);
    }
    catch (error) {
        console.error("Error in /hotels endpoint:", error);
        // Clean up uploaded file on error
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
        });
    }
}));
const startPeriodicEmailProcessing = () => {
    // Set interval to call processAllUserEmails every 5 seconds
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
// Start the server
app.listen(PORT, () => {
    console.log(`Email Server  is running on port ${PORT}`);
});

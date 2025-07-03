// @ts-nocheck
import express from "express";
import { processAllUserEmails } from "./process-email";
import { createHotels, CreateHotelsInput } from "./hotel/api";
import multer from "multer";
import { extractHotelData } from "./hotel/ai"; // adjust path as needed
import fs from "fs";
import path from "path";
import cors from "cors";

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

const PORT = process.env.PORT || 3001;

// Allow all origins for testing
app.use(cors());

// Middleware for parsing JSON
app.use(express.json());

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
    cb(null, `${name}-${Date.now()}${ext}`); // Append timestamp to avoid name collisions
  },
});

const upload = multer({ storage: storage });

// Add a simple health check route
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
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

    // Pass the file path directly to extractHotelData (not the file object)
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

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("Error in /hotels endpoint:", error);

    // Clean up uploaded file on error
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
    });
  }
});

const startPeriodicEmailProcessing = () => {
  // Set interval to call processAllUserEmails every 5 seconds
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

// IMPORTANT: Bind to all interfaces (0.0.0.0) for EC2
app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Email Server is running on port ${PORT} and accessible from all interfaces`
  );
});

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
exports.extractHotelData = exports.extractHotelDataFromFile = exports.uploadToGemini = void 0;
// @ts-nocheck
const generative_ai_1 = require("@google/generative-ai");
const server_1 = require("@google/generative-ai/server");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const api_1 = require("./api");
const HotelRequest_1 = __importDefault(require("../db/HotelRequest"));
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
    throw new Error("API key is not defined");
}
const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
const fileManager = new server_1.GoogleAIFileManager(apiKey);
const uploadToGemini = (filePath, mimeType) => __awaiter(void 0, void 0, void 0, function* () {
    const uploadResult = yield fileManager.uploadFile(filePath, {
        mimeType,
        displayName: path_1.default.basename(filePath),
    });
    const file = uploadResult.file;
    return file;
});
exports.uploadToGemini = uploadToGemini;
const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
});
const generationConfig = {
    temperature: 0.4,
    topP: 0.8,
    topK: 20,
    maxOutputTokens: 200000,
    responseMimeType: "application/json",
    responseSchema: {
        type: "object",
        required: ["hotels"],
        properties: {
            hotels: {
                type: "array",
                items: {
                    type: "object",
                    required: [
                        "hotelName",
                        "starsCategory",
                        "category",
                        "fromDate",
                        "toDate",
                        "price",
                        "extraBed",
                        "meals",
                        "vat",
                        "surcharge",
                    ],
                    properties: {
                        hotelName: {
                            type: "string",
                            description: "Name of the hotel",
                        },
                        starsCategory: {
                            type: "number",
                            description: "Star rating of the hotel (e.g., 4, 5, 3)",
                        },
                        category: {
                            type: "string",
                            description: "Room category (e.g., Deluxe Internal Window, Superior, Standard)",
                        },
                        fromDate: {
                            type: "string",
                            description: "Start date of pricing period in DD-MM-YYYY format (e.g., '01-07-2025')",
                        },
                        toDate: {
                            type: "string",
                            description: "End date of pricing period in DD-MM-YYYY format (e.g., '01-09-2025')",
                        },
                        price: {
                            type: "number",
                            description: "Base room price",
                        },
                        extraBed: {
                            type: "object",
                            required: ["adult", "child"],
                            properties: {
                                adult: {
                                    type: "number",
                                    description: "Extra bed price for adults",
                                },
                                child: {
                                    type: "number",
                                    description: "Extra bed price for children",
                                },
                                breakfastWithoutExtraBed: {
                                    type: "number",
                                    description: "Breakfast price without extra bed (if specified, otherwise 0)",
                                },
                            },
                        },
                        meals: {
                            type: "string",
                            description: "Meal plan (e.g., Fullboard, Halfboard, Breakfast, Dinner) Halfboard means breakfast and dinner included, Fullboard means all meals included",
                        },
                        vat: {
                            type: "number",
                            description: "VAT multiplier (e.g., 1.1 for 10% VAT, 1.2 for 20% VAT). If not mentioned, vat is 1",
                        },
                        surcharge: {
                            type: "array",
                            items: {
                                type: "object",
                                required: ["description"],
                                properties: {
                                    percentage: {
                                        type: "number",
                                        description: "Surcharge percentage (e.g., 10 for 10%). Leave as 0 if fixed amount.",
                                    },
                                    date: {
                                        type: "array",
                                        items: {
                                            type: "string",
                                        },
                                        description: "Array of dates when surcharge applies (e.g., ['2023-12-25 - 2023-12-31']). Leave empty if surcharge applies generally.",
                                    },
                                    description: {
                                        type: "string",
                                        description: "Complete description for surcharge including amount, conditions, and age ranges.",
                                    },
                                },
                            },
                            description: "Array of surcharges including child policies and additional charges. Empty array if no surcharges mentioned.",
                        },
                        galaDinner: {
                            type: "object",
                            properties: {
                                adult: {
                                    type: "number",
                                    description: "Gala dinner price for adults (0 if not mentioned)",
                                },
                                child: {
                                    type: "number",
                                    description: "Gala dinner price for children (0 if not mentioned)",
                                },
                                date: {
                                    type: "string",
                                    description: "Date of gala dinner (empty if not mentioned)",
                                },
                                childAgeRange: {
                                    type: "string",
                                    description: "Age range for children (empty if not mentioned)",
                                },
                            },
                        },
                        promotions: {
                            type: "array",
                            items: {
                                type: "string",
                            },
                            description: "Hotel promotions or special offers (empty array if none)",
                        },
                    },
                },
            },
        },
    },
};
// Function to handle File/Blob objects
const extractHotelDataFromFile = (file) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!file) {
        throw new Error("No file provided");
    }
    // Validate file type
    const fileType = file.type;
    const fileName = ((_a = file.name) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || "unknown";
    const validTypes = [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/bmp",
        "image/webp",
        "image/tiff",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
    ];
    const validExtensions = [
        ".pdf",
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".bmp",
        ".webp",
        ".tiff",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".txt",
    ];
    const isValidType = validTypes.includes(fileType);
    const isValidExtension = validExtensions.some((ext) => fileName.endsWith(ext));
    if (!isValidType && !isValidExtension) {
        throw new Error("Unsupported file format. Please upload PDF, image, or document files.");
    }
    // Create a temporary path to save the file
    const tempDir = path_1.default.join(process.cwd(), "tmp/uploads");
    if (!fs_1.default.existsSync(tempDir)) {
        fs_1.default.mkdirSync(tempDir, { recursive: true });
    }
    const tempPath = path_1.default.join(tempDir, file.name || `file_${Date.now()}`);
    let uploadedFile;
    try {
        // Save the file to the temporary directory
        const fileBuffer = yield file.arrayBuffer();
        fs_1.default.writeFileSync(tempPath, Buffer.from(fileBuffer));
        // Upload file to Gemini
        uploadedFile = yield (0, exports.uploadToGemini)(tempPath, fileType);
        const chatSession = model.startChat({
            generationConfig,
            history: [
                {
                    role: "user",
                    parts: [
                        {
                            fileData: {
                                mimeType: uploadedFile.mimeType,
                                fileUri: uploadedFile.uri,
                            },
                        },
                        {
                            text: `Extract all hotel information from this document. For each hotel, create SEPARATE hotel objects for EACH room category/pricing combination.

IMPORTANT: Each hotel object should contain only ONE room category as a flat structure. If a hotel has multiple room types or pricing options, create multiple hotel objects with the same hotel details but different room category information.

For each hotel object, extract these fields directly at the hotel level:
1. hotelName - exact name as written
2. starsCategory - as number (e.g., 4, 5)
3. category - room type name (e.g., "Deluxe Internal Window", "Superior")
4. fromDate - start date of pricing period in DD-MM-YYYY format
5. toDate - end date of pricing period in DD-MM-YYYY format
6. price - base room price
7. extraBed - object with adult and child extra bed prices
8. meals - meal type as string (e.g., "Fullboard", "Halfboard", "Breakfast", "Dinner")
9. vat - VAT multiplier ONLY if explicitly mentioned (1 if not mentioned)
10. surcharge - array of surcharge objects ONLY if surcharges are mentioned
11. galaDinner - optional object with adult/child prices, date, and age range
12. promotions - array of promotional offers

VAT and Surcharge Guidelines:
- Only include surcharge if the document mentions additional charges for specific dates/reasons
- Surcharge should include percentage, applicable dates array, and description
- 10% VAT should be represented as 1.10, 20% VAT as 1.20, etc. If not mentioned, vat is 1.

Return ONLY valid JSON, no markdown formatting or additional text.`,
                        },
                    ],
                },
                {
                    role: "model",
                    parts: [
                        {
                            text: `{
                "hotels": [
                  {
                    "hotelName": "LA SINFONIA CITADEL HOTEL",
                    "starsCategory": 4,
                    "category": "Executive internal window",
                    "fromDate": "01-05-2025",
                    "toDate": "30-07-2025",
                    "price": 1550000,
                    "extraBed": {
                      "adult": 600000,
                      "child": 500000,
                      "breakfastWithoutExtraBed": 0
                    },
                    "vat": 1,
                    "meals": "Fullboard",
                    "surcharge": [],
                    "galaDinner": {
                      "adult": 0,
                      "child": 0,
                      "date": "",
                      "childAgeRange": ""
                    },
                    "promotions": ["Apply additional Early Bird discount of 5%"]
                  }
                ]
              }`,
                        },
                    ],
                },
            ],
        });
        const result = yield chatSession.sendMessage(`Extract all hotel data from this document following the specified format.
      - Create SEPARATE hotel objects for each unique combination of hotel, room category, pricing period, and price.
      - Each hotel object should contain the room category information directly at the hotel level, not nested.
      - Use DD-MM-YYYY format for dates.
      - Only include VAT and surcharge fields if they are explicitly mentioned in the document.
      - DO NOT return duplicate hotel objects. Each object in the hotels array must be unique.
      - Return ONLY valid JSON without any markdown formatting.`);
        const responseText = result.response.text();
        if (!responseText || responseText.trim() === "") {
            throw new Error("Empty response from AI model");
        }
        const jsonResponse = JSON.parse(responseText);
        // Clean up: delete the uploaded file from Gemini
        try {
            yield fileManager.deleteFile(uploadedFile.name);
        }
        catch (deleteError) {
        }
        return jsonResponse;
    }
    catch (error) {
        console.error("Error in extractHotelDataFromFile:", error);
        // Clean up on error
        if (uploadedFile) {
            try {
                yield fileManager.deleteFile(uploadedFile.name);
            }
            catch (deleteError) {
                console.warn("Could not delete uploaded file on error:", deleteError);
            }
        }
        throw error;
    }
    finally {
        // Clean up temporary file
        try {
            if (fs_1.default.existsSync(tempPath)) {
                fs_1.default.unlinkSync(tempPath);
            }
        }
        catch (cleanupError) {
            console.warn("Could not delete temporary file:", cleanupError);
        }
    }
});
exports.extractHotelDataFromFile = extractHotelDataFromFile;
// Original function to handle file paths (keeping for backward compatibility)
const extractHotelData = (filePath, supplierId, country, city, currency, requestId, createdBy) => __awaiter(void 0, void 0, void 0, function* () {
    if (!filePath) {
        throw new Error("No file path provided");
    }
    // Check if file exists
    if (!fs_1.default.existsSync(filePath)) {
        throw new Error("File does not exist at the provided path");
    }
    // Get file info for validation
    const fileName = path_1.default.basename(filePath).toLowerCase();
    const fileExt = path_1.default.extname(filePath).toLowerCase();
    const validExtensions = [
        ".pdf",
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".bmp",
        ".webp",
        ".tiff",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".txt",
    ];
    const isValidExtension = validExtensions.some((ext) => fileName.endsWith(ext));
    if (!isValidExtension) {
        throw new Error("Unsupported file format. Please upload PDF, image, or document files.");
    }
    // Determine MIME type based on extension
    let mimeType = "application/pdf"; // default
    if (fileExt === ".pdf")
        mimeType = "application/pdf";
    else if ([".jpg", ".jpeg"].includes(fileExt))
        mimeType = "image/jpeg";
    else if (fileExt === ".png")
        mimeType = "image/png";
    else if (fileExt === ".gif")
        mimeType = "image/gif";
    else if (fileExt === ".bmp")
        mimeType = "image/bmp";
    else if (fileExt === ".webp")
        mimeType = "image/webp";
    else if (fileExt === ".tiff")
        mimeType = "image/tiff";
    else if (fileExt === ".doc")
        mimeType = "application/msword";
    else if (fileExt === ".docx")
        mimeType =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    else if (fileExt === ".xls")
        mimeType = "application/vnd-ms-excel";
    else if (fileExt === ".xlsx")
        mimeType =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    else if (fileExt === ".txt")
        mimeType = "text/plain";
    let uploadedFile;
    try {
        // Upload file to Gemini
        uploadedFile = yield (0, exports.uploadToGemini)(filePath, mimeType);
        // Track start time
        const startTime = Date.now();
        const chatSession = model.startChat({
            generationConfig,
            history: [
                {
                    role: "user",
                    parts: [
                        {
                            fileData: {
                                mimeType: uploadedFile.mimeType,
                                fileUri: uploadedFile.uri,
                            },
                        },
                        {
                            text: `Extract all hotel information from this document. For each hotel, create SEPARATE hotel objects for EACH room category/pricing combination.

IMPORTANT: Each hotel object should contain only ONE room category as a flat structure. If a hotel has multiple room types or pricing options, create multiple hotel objects with the same hotel details but different room category information.

For each hotel object, extract these fields directly at the hotel level:
1. hotelName - exact name as written
2. starsCategory - as number (e.g., 4, 5)
3. category - room type name (e.g., "Deluxe Internal Window", "Superior")
4. fromDate - start date of pricing period in DD-MM-YYYY format
5. toDate - end date of pricing period in DD-MM-YYYY format
6. price - base room price
7. extraBed - object with adult and child extra bed prices
8. meals - meal type as string (e.g., "Fullboard", "Halfboard", "Breakfast", "Dinner")
9. vat - VAT multiplier ONLY if explicitly mentioned (1 if not mentioned)
10. surcharge - array of surcharge objects ONLY if surcharges are mentioned
11. galaDinner - optional object with adult/child prices, date, and age range
12. promotions - array of promotional offers

VAT and Surcharge Guidelines:
- Only include surcharge if the document mentions additional charges for specific dates/reasons
- Surcharge should include percentage, applicable dates array, and description
- 10% VAT should be represented as 1.10, 20% VAT as 1.20, etc. If not mentioned, vat is 1.

Return ONLY valid JSON, no markdown formatting or additional text.`,
                        },
                    ],
                },
                {
                    role: "model",
                    parts: [
                        {
                            text: `{
                "hotels": [
                  {
                    "hotelName": "LA SINFONIA CITADEL HOTEL",
                    "starsCategory": 4,
                    "category": "Executive internal window",
                    "fromDate": "01-05-2025",
                    "toDate": "30-07-2025",
                    "price": 1550000,
                    "extraBed": {
                      "adult": 600000,
                      "child": 500000,
                      "breakfastWithoutExtraBed": 0
                    },
                    "vat": 1,
                    "meals": "Fullboard",
                    "surcharge": [],
                    "galaDinner": {
                      "adult": 0,
                      "child": 0,
                      "date": "",
                      "childAgeRange": ""
                    },
                    "promotions": ["Apply additional Early Bird discount of 5%"]
                  }
                ]
              }`,
                        },
                    ],
                },
            ],
        });
        const result = yield chatSession.sendMessage(`Extract all hotel data from this document following the specified format.
      - Create SEPARATE hotel objects for each unique combination of hotel, room category, pricing period, and price.
      - Each hotel object should contain the room category information directly at the hotel level, not nested.
      - Use DD-MM-YYYY format for dates.
      - Only include VAT and surcharge fields if they are explicitly mentioned in the document.
      - DO NOT return duplicate hotel objects. Each object in the hotels array must be unique.
      - Return ONLY valid JSON without any markdown formatting.`);
        // Track end time and log duration
        const endTime = Date.now();
        const durationMs = endTime - startTime;
        console.log(`AI action time taken: ${durationMs} ms`);
        // Log token usage if available
        if (result.response.usage) {
            console.log("AI token usage:", result.response.usage);
        }
        const responseText = result.response.text();
        if (!responseText || responseText.trim() === "") {
            throw new Error("Empty response from AI model");
        }
        const jsonResponse = JSON.parse(responseText);
        // Add hotel creation logic here
        const createResult = yield (0, api_1.createHotels)({
            hotels: jsonResponse.hotels,
            supplierId: supplierId.trim(),
            country: country.trim(),
            city: city.trim(),
            currency: currency.trim(),
            createdBy: createdBy.trim(),
        });
        console.log("Hotels created successfully:", createResult);
        // Clean up the uploaded file from server
        try {
            fs_1.default.unlinkSync(filePath);
        }
        catch (cleanupError) {
            console.error("Error cleaning up file:", cleanupError);
        }
        const updateStatus = yield HotelRequest_1.default.findByIdAndUpdate(requestId, { isComplete: true }, { new: true });
        console.log("Hotel request status updated:", updateStatus);
        return;
    }
    catch (error) {
        console.error("Error in extractHotelData:", error);
        // Clean up the uploaded file on error
        try {
            fs_1.default.unlinkSync(filePath);
        }
        catch (cleanupError) {
            console.error("Error cleaning up file on error:", cleanupError);
        }
        throw error;
    }
});
exports.extractHotelData = extractHotelData;

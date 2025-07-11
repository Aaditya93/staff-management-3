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
exports.extractHotelData = exports.uploadToGemini = void 0;
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
    model: "gemini-2.5-flash",
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
                    required: ["hotelName", "starsCategory", "vat", "roomCategories", "promotions", "cancellationPolicys", "markets", "childPolicies"],
                    properties: {
                        childPolicies: {
                            type: "array",
                            items: {
                                type: "string",
                            },
                            description: "Child policies for the hotel (empty array if none)",
                        },
                        cancellationPolicys: {
                            type: "array",
                            items: {
                                type: "string",
                            },
                            description: "Cancellation policies for the hotel (empty array if none)",
                        },
                        markets: {
                            type: "array",
                            items: {
                                type: "string",
                            },
                            description: "Markets where the hotel operates (e.g. 'Indian','Korean', 'Chinese'). If not mentioned, leave it empty. Only Include Countries or regions where the hotel is actively marketed or operates.",
                        },
                        hotelName: {
                            type: "string",
                            description: "Name of the hotel",
                        },
                        starsCategory: {
                            type: "number",
                            description: "Star rating of the hotel (e.g., 4, 5, 3)",
                        },
                        vat: {
                            type: "number",
                            description: "VAT multiplier (e.g., 1.1 for 10% VAT, 1.2 for 20% VAT). If not mentioned, vat is 1",
                        },
                        galaDinner: {
                            type: "object",
                            properties: {
                                adult: {
                                    type: "number",
                                    description: "Gala dinner price for adults",
                                },
                                child: {
                                    type: "number",
                                    description: "Gala dinner price for children",
                                },
                                date: {
                                    type: "string",
                                    description: "Date of gala dinner in DD-MM-YYYY format",
                                },
                                childAgeRange: {
                                    type: "string",
                                    description: "Age range for children.  If Age is Under 12 Show it as 0-11",
                                },
                            },
                            description: "Gala dinner information - only include if explicitly mentioned in the document"
                        },
                        promotions: {
                            type: "array",
                            items: {
                                type: "string",
                            },
                            description: "Hotel promotions or special offers (empty array if none)",
                        },
                        roomCategories: {
                            type: "array",
                            items: {
                                type: "object",
                                required: [
                                    "category",
                                    "fromDate",
                                    "toDate",
                                    "inboundPrice",
                                    "domesticPrice",
                                    "fitPrice",
                                    "gitPrice",
                                    "fitGitCondition",
                                    "extraBed",
                                    "meals",
                                    "surcharge",
                                    "season",
                                    "maxOccupancy",
                                    "breakfast",
                                    "fullBoard",
                                    "halfBoard",
                                ],
                                properties: {
                                    breakfast: {
                                        type: "object",
                                        properties: {
                                            child: {
                                                type: "number",
                                                description: "Breakfast price for child",
                                            },
                                            childAgeRange: {
                                                type: "string",
                                                description: "Age range for children breakfast pricing (e.g., '0-12 years')",
                                            },
                                            noofChildren: {
                                                type: "number",
                                                description: "Number of children included in breakfast pricing",
                                            },
                                        },
                                        description: "Breakfast pricing information - only include if explicitly mentioned in the document",
                                    },
                                    fullBoard: {
                                        type: "object",
                                        properties: {
                                            child: {
                                                type: "number",
                                                description: "Full board price for child",
                                            },
                                            adult: {
                                                type: "number",
                                                description: "Full board price for adult",
                                            },
                                            childAgeRange: {
                                                type: "string",
                                                description: "Age range for children full board pricing (e.g., '0-12 years')",
                                            },
                                        },
                                        description: "Full board pricing information - only include if explicitly mentioned in the document",
                                    },
                                    halfBoard: {
                                        type: "object",
                                        properties: {
                                            child: {
                                                type: "number",
                                                description: "Half board price for child",
                                            },
                                            adult: {
                                                type: "number",
                                                description: "Half board price for adult",
                                            },
                                            childAgeRange: {
                                                type: "string",
                                                description: "Age range for children half board pricing (e.g., '0-12 years')",
                                            },
                                        },
                                        description: "Half board pricing information - only include if explicitly mentioned in the document",
                                    },
                                    maxOccupancy: {
                                        type: "string",
                                        description: "Maximum occupancy for the room category (e.g., ' 3A/ 2A+2C '). If not mentioned, leave it empty.",
                                    },
                                    season: {
                                        type: "string",
                                        description: "Season of the room category (e.g., Low Season, High Season , Normal Season). If not mentioned, leave it empty.",
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
                                    inboundPrice: {
                                        type: "number",
                                        description: "Base room price for International Guest. If not mentioned keep it empty.",
                                    },
                                    domesticPrice: {
                                        type: "number",
                                        description: "Base room price for Domestic Guest. If not mentioned keep it empty.",
                                    },
                                    fitPrice: {
                                        type: "number",
                                        description: "Base room price for FIT Guest. FIT means price for small group. If not mentioned keep it empty.",
                                    },
                                    gitPrice: {
                                        type: "number",
                                        description: "Base room price for GIT Guest. GIT means price for large group. If not mentioned keep it empty.",
                                    },
                                    fitGitCondition: {
                                        type: "string",
                                        description: "Conditions for FIT/GIT pricing (e.g., 'Minimum 10 rooms for GIT pricing'). It should write it like this FIT: < 6 rooms. GIT: >= 6 rooms  If not mentioned, leave it empty.",
                                    },
                                    extraBed: {
                                        type: "object",
                                        required: ["adult", "child", "breakfastWithoutExtraBed", "childAgeRange"],
                                        properties: {
                                            adult: {
                                                type: "number",
                                                description: "Extra bed price for adults. Always check if extra bed is available for that room category. Look for sections or keywords like 'Extrabed', 'Extra bed', 'Giường phụ'.",
                                            },
                                            child: {
                                                type: "number",
                                                description: "Extra bed price for children. Always check if extra bed is available for that room category. Look for sections or keywords like 'Extrabed', 'Extra bed', 'Giường phụ'.",
                                            },
                                            breakfastWithoutExtraBed: {
                                                type: "number",
                                                description: "Breakfast price without extra bed (if specified, otherwise 0). Adiitional breakfast prices should be included here if mentioned in the document.",
                                            },
                                            childAgeRange: {
                                                type: "string",
                                                description: "Age range for children applicable for extra bed pricing (e.g., '0-12 years'). If Age is Under 12 Show it as 0-11 This is optional and should only be included if specified in the document.",
                                            }
                                        },
                                    },
                                    meals: {
                                        type: "string",
                                        description: "Meal plan (e.g., Fullboard, Halfboard, Breakfast, Dinner)",
                                    },
                                    surcharge: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            required: ["description"],
                                            properties: {
                                                percentage: {
                                                    type: "number",
                                                    description: "Surcharge percentage (e.g., 10 for 10%). Leave empty if fixed amount is specified instead of percentage.",
                                                },
                                                date: {
                                                    type: "array",
                                                    items: {
                                                        type: "string",
                                                    },
                                                    description: "Array of dates when surcharge applies (e.g., ['2023-12-25 - 2023-12-31']). Leave empty if surcharge applies generally or for specific conditions rather than dates.",
                                                },
                                                description: {
                                                    type: "string",
                                                    description: "Complete description for surcharge including amount, conditions, and age ranges. Examples: 'Holiday surcharge', 'Peak season surcharge', 'VND 235,000/night for child 5-11 years sharing bed with parents including breakfast', 'VND 470,000/night for child until 18 years with extra bed including breakfast', 'VND 770,000 for 3rd adult/child over 11 years halfboard package'. Surcharges should only represent mandatory additional charges on the room rate during holidays or special periods. Do not include optional services or charges that are only applied if requested.",
                                                },
                                            },
                                        },
                                        description: "Array of surcharges including child policies and mandatory additional charges only. Do not include optional services or charges that are only applied if requested. Include all surcharge information in the description field when percentage or specific dates are not applicable. Only include if surcharges or child policies are mentioned in the document.",
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
};
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
                            text: `Extract hotel data to JSON with hotels array:

Each hotel object: hotelName, starsCategory (number), vat (1.1=10%, 1.2=20%, default=1), galaDinner (only if mentioned), promotions (array), roomCategories (array)

roomCategories (per room/period): category, fromDate/toDate (DD-MM-YYYY), price, extraBed {adult, child}, meals, surcharge (array, only if mentioned)

CRITICAL: Always scan the ENTIRE document for multiple hotels. Look for:
- Different hotel names (even slight variations)
- Different addresses or contact information
- Page breaks or section dividers
- Multiple pricing tables for different properties
- Headers indicating new hotel sections

IMPORTANT: Even if one big company has multiple hotels (Hotel A and Hotel B) in the same PDF, you MUST create separate hotel objects for each distinct hotel. Do NOT combine them into one object.

Rules:
- Only use low season and high season prices, ignore walk-in prices
- MUST create separate hotel objects for EACH distinct hotel found in the PDF
- If you find "Hotel A" and "Hotel B" in the same PDF, create 2 separate hotel objects
- If Domestic , Inbound prices , FIT Prices , GIT Prices are not mentioned, keep them empty
- Even if hotels are from the same company/group, treat each hotel as a separate entity
- Carefully read through ALL pages to identify every hotel mentioned
- Look for different hotel names, addresses, or clear section breaks to identify separate hotels
- If single hotel, create one hotel object with all room categories
- Separate roomCategories for each room type/pricing period
- Include galaDinner/surcharge only if explicitly stated
- Extract extraBed prices: check if extra bed is available for that room category, and look for "Extrabed", "Extra bed", "Giường phụ" sections. Extract Child Age range if mentioned (e.g., "0-12 years"). If not mentioned, leave it out.
- Extract surcharges: look for "Surcharge", "Phụ thu", holiday fees, festival charges, child policies. Do not include additional charges for optional services (e.g., extra services that are only charged if requested). Surcharges should only represent mandatory additional charges on the room rate during holidays or special periods.
- Extract child pricing policies as surcharges with age ranges in description
- Additional Breakfast prices: if mentioned, include in breakfastWithoutExtraBed field
- Return valid JSON only

EXAMPLE: If PDF contains "Radisson Hotel Danang" and "Radisson Resort Phu Quoc", create TWO separate hotel objects even though they are both Radisson properties.`,
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
                    "hotelName": "EDEN OCEAN VIEW HOTEL",
                    "starsCategory": 4,
                    "vat": 1,
                    "childPolicies": ["Children under 6 years old: Free", "Children 6-12 years old: VND 200,000/room/night"],
                    "promotions": ["F.O.C 16-1 Maximum 4 rooms", "Rates inclusive of breakfast, 5% service charge and government tax"],
                    markets: ["Domestic", "Indian", "Korean", "Chinese"],
                    cancellationPolicys: ["Free cancellation 7 days before check-in", "No show or early departure will be charged 100% of the total amount"],
                    galaDinner: {
                    "roomCategories": [
                      {
                        "category": "Classic Double",
                        "fromDate": "01-01-2025",
                        "toDate": "20-04-2025",
                        "inboundPrice": 750000,
                        "domesticPrice": 700000,
                        "fitPrice": 700000,
                        "gitPrice": 700000,
                        "fitGitCondition": "Minimum 10 rooms for GIT pricing",
                        "season": "Low Season",
                        "extraBed": {
                          "adult": 300000,
                          "child": 150000,
                           "childAgeRange": "0-12 years",
                          "breakfastWithoutExtraBed": 100000

                        },
                        maxOccupancy: "2A/ 1A+1C",
                      
                        breakfast: {
                          "child": 100000,    
                          "childAgeRange": "0-12 years",
                          "noofChildren": 1
                        },
                        fullBoard: {
                          "child": 200000,      
                          "adult": 400000,
                          "childAgeRange": "0-12 years"
                        },
                        halfBoard: {
                          "child": 150000,      
                          "adult": 300000,
                          "childAgeRange": "0-12 years"
                        },
                        "meals": "Breakfast",
                        "surcharge": [
                          {
                            "description": "Children under 6 years old: Free",
                            "percentage": null,
                            "date": []
                          },
                          {
                            "description": "Holiday surcharge: VND 200,000/room/night",
                            "percentage": null,
                            "date": ["01-01-2025", "29-01-2025 to 31-01-2025"]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "hotelName": "EDEN BEACH RESORT",
                    "starsCategory": 5,
                    "vat": 1.05,
                    "childPolicies": ["Children under 6 years old: Free", "Children 6-12 years old: VND 300,000/room/night"],
                    "promotions": ["Early booking discount"],
                    markets: ["Domestic", "International"],
                    cancellationPolicys: ["Free cancellation 14 days before check-in" ],
                    "roomCategories": [
                      {
                        "category": "Deluxe Room",
                        "fromDate": "01-01-2025",
                        "toDate": "20-04-2025",
                        "inboundPrice": 1200000,
                        "domesticPrice": 1150000,
                        "season": "High Season",
                        "extraBed": {
                          "adult": 400000,
                          "child": 200000,
                          "childAgeRange": "0-12 years",
                          "breakfastWithoutExtraBed": 100000
                        },
                        "meals": "Breakfast",
                        "surcharge": []
                      }
                    ]
                  }
                ]
              }`,
                        },
                    ],
                },
            ],
        });
        const result = yield chatSession.sendMessage(`Extract hotel data following above format. Scan the ENTIRE document carefully for ALL hotels. If you find multiple hotels (even from same company/group like Hotel A and Hotel B), create separate objects for each distinct hotel. Each hotel name should have its own hotel object. Return JSON only.`);
        // Track end time and log duration
        const endTime = Date.now();
        const durationMs = endTime - startTime;
        console.log(`AI action time taken: ${durationMs} ms`);
        // Log token usage if available
        if (result.response.usageMetadata) {
            console.log("AI token usage:", result.response.usageMetadata);
        }
        const responseText = result.response.text();
        console.log("Raw AI response:", responseText);
        if (!responseText || responseText.trim() === "") {
            throw new Error("Empty response from AI model");
        }
        const jsonResponse = JSON.parse(responseText);
        console.log("AI response:", jsonResponse);
        // Keep hotels as separate objects
        const hotelsToCreate = jsonResponse.hotels.map(hotel => ({
            hotelInfo: {
                hotelName: hotel.hotelName,
                starsCategory: hotel.starsCategory,
                vat: hotel.vat,
                galaDinner: hotel.galaDinner,
                promotions: hotel.promotions,
                cancellationPolicys: hotel.cancellationPolicys,
                markets: hotel.markets,
                childPolicies: hotel.childPolicies
            },
            roomCategories: hotel.roomCategories
        }));
        // Process each hotel separately
        for (const hotelData of hotelsToCreate) {
            const combinedHotels = hotelData.roomCategories.map(roomCategory => (Object.assign({ hotelName: hotelData.hotelInfo.hotelName, starsCategory: hotelData.hotelInfo.starsCategory, vat: hotelData.hotelInfo.vat, galaDinner: hotelData.hotelInfo.galaDinner, promotions: hotelData.hotelInfo.promotions, cancellationPolicys: hotelData.hotelInfo.cancellationPolicys, markets: hotelData.hotelInfo.markets, childPolicies: hotelData.hotelInfo.childPolicies }, roomCategory)));
            // Create hotels for this specific hotel
            const createResult = yield (0, api_1.createHotels)({
                hotels: combinedHotels,
                supplierId: supplierId.trim(),
                country: country.trim(),
                city: city.trim(),
                currency: currency.trim(),
                createdBy: createdBy.trim(),
            });
            console.log(`Hotels created for ${hotelData.hotelInfo.hotelName}:`, createResult);
        }
        // Clean up: delete the uploaded file from Gemini
        try {
            yield fileManager.deleteFile(uploadedFile.name);
        }
        catch (deleteError) {
            console.warn("Could not delete uploaded file:", deleteError);
        }
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
        // Clean up on error
        if (uploadedFile) {
            try {
                yield fileManager.deleteFile(uploadedFile.name);
            }
            catch (deleteError) {
                console.warn("Could not delete uploaded file on error:", deleteError);
            }
        }
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

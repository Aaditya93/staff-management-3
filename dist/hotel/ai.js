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
// First generation config for hotel extraction
const hotelGenerationConfig = {
    temperature: 0.4,
    topP: 0.8,
    topK: 20,
    maxOutputTokens: 30000,
    responseMimeType: "application/json",
    responseSchema: {
        type: "object",
        required: ["hotels"],
        properties: {
            hotels: {
                type: "array",
                items: {
                    type: "object",
                    required: ["hotelName", "vat", "promotions", "cancellationPolicys", "markets", "childPolicies", "reservationEmail", "galaDinner", "surcharge", "extraBed", "breakfast", "fullBoard", "halfBoard", "allInclusive"],
                    properties: {
                        hotelName: {
                            type: "string",
                            description: "Name of the hotel. Copy the hotel name character-for-character, including spaces, punctuation, and capitalization, as it appears in the document.",
                        },
                        vat: {
                            type: "number",
                            description: "VAT multiplier (e.g., 1.1 for 10% VAT, 1.2 for 20% VAT). If not mentioned, vat is 1",
                        },
                        childPolicies: {
                            type: "array",
                            items: { type: "string" },
                            description: "Child policies for the hotel (empty array if none)",
                        },
                        cancellationPolicys: {
                            type: "array",
                            items: { type: "string" },
                            description: "Cancellation policies for the hotel (empty array if none)",
                        },
                        reservationEmail: {
                            type: "string",
                            description: "Reservation email for the hotel. If not mentioned, leave it empty.",
                        },
                        markets: {
                            type: "array",
                            items: { type: "string" },
                            description: "Markets where the hotel operates (e.g. 'Indian','Korean', 'Chinese'). If not mentioned, leave it empty.",
                        },
                        promotions: {
                            type: "array",
                            items: { type: "string" },
                            description: "Hotel promotions or special price-related offers (e.g., discounts, booking deals, percentage off, free nights). Only include offers that directly affect the price. Leave empty array if none.",
                        },
                        galaDinner: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    adult: { type: "number", description: "Gala dinner price for adults" },
                                    child: { type: "number", description: "Gala dinner price for children" },
                                    date: { type: "string", description: "Date of gala dinner in DD-MM-YYYY format" },
                                    childAgeRange: { type: "string", description: "Age range for children. If Age is Under 12 show it as 0-11" },
                                    description: { type: "string", description: "Description of gala dinner including any special conditions or inclusions" }
                                },
                                required: ["adult", "child", "date", "description"],
                            },
                            description: "Array of gala dinner information objects - only include if explicitly mentioned in the document"
                        },
                        breakfast: {
                            type: "object",
                            properties: {
                                child: { type: "number", description: "Breakfast price for child" },
                                adult: { type: "number", description: "Breakfast price for adult" },
                                childAgeRange: { type: "string", description: "Age range for children breakfast pricing (e.g., '0-12 years')" },
                            },
                            description: "Breakfast pricing information - only include if explicitly mentioned in the document",
                        },
                        fullBoard: {
                            type: "object",
                            properties: {
                                child: { type: "number", description: "Full board price for child" },
                                adult: { type: "number", description: "Full board price for adult" },
                                childAgeRange: { type: "string", description: "Age range for children full board pricing (e.g., '0-12 years')" },
                            },
                            description: "Full board pricing information - only include if explicitly mentioned in the document",
                        },
                        halfBoard: {
                            type: "object",
                            properties: {
                                child: { type: "number", description: "Half board price for child" },
                                adult: { type: "number", description: "Half board price for adult" },
                                childAgeRange: { type: "string", description: "Age range for children half board pricing (e.g., '0-12 years')" },
                            },
                            description: "Half board pricing information - only include if explicitly mentioned in the document",
                        },
                        allInclusive: {
                            type: "object",
                            properties: {
                                child: { type: "number", description: "All-inclusive price for child" },
                                adult: { type: "number", description: "All-inclusive price for adult" },
                                childAgeRange: { type: "string", description: "Age range for children all-inclusive pricing (e.g., '0-12 years')" },
                            },
                            description: "All-inclusive pricing information - only include if explicitly mentioned in the document",
                        },
                        extraBed: {
                            type: "object",
                            properties: {
                                adult: { type: "number", description: "Extra bed price for adults" },
                                child: { type: "number", description: "Extra bed price for children" },
                                childAgeRange: { type: "string", description: "Age range for children applicable for extra bed pricing (e.g., '0-12 years')" }
                            },
                        },
                        surcharge: {
                            type: "array",
                            items: {
                                type: "object",
                                required: ["description"],
                                properties: {
                                    percentage: { type: "number", description: "Surcharge percentage (e.g., 10 for 10%)" },
                                    date: { type: "array", items: { type: "string" }, description: "Array of dates when surcharge applies" },
                                    description: { type: "string", description: "Complete description for surcharge" },
                                },
                            },
                            description: "Array of surcharges including child policies and mandatory additional charges only",
                        },
                    },
                },
            },
        },
    },
};
const roomCategoriesGenerationConfig = {
    temperature: 0.2,
    topP: 0.8,
    topK: 20,
    maxOutputTokens: 30000,
    responseMimeType: "application/json",
    responseSchema: {
        type: "object",
        required: ["roomCategories"],
        properties: {
            roomCategories: {
                type: "array",
                items: {
                    type: "object",
                    required: ["hotelName", "category", "datePairs", "fitGitCondition", "meals", "noofChildren", "season"],
                    properties: {
                        hotelName: {
                            type: "string",
                            description: "Name of the hotel this room category belongs to. Copy the hotel name character-for-character, including spaces, punctuation, and capitalization, as it appears in the document.",
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
                        datePairs: {
                            type: "array",
                            items: {
                                type: "object",
                                required: ["fromDate", "toDate"],
                                properties: {
                                    fromDate: {
                                        type: "string",
                                        description: "Start date of pricing period in DD-MM-YYYY format (e.g., '01-07-2025')",
                                    },
                                    toDate: {
                                        type: "string",
                                        description: "End date of pricing period in DD-MM-YYYY format (e.g., '01-09-2025')",
                                    },
                                },
                            },
                            description: "Array of date pairs for different pricing periods. Each pair represents a pricing period for this room category.",
                        },
                        pricing: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    inboundPrice: {
                                        type: "number",
                                        description: "If not mentioned keep it empty. Base room price for International Guest.",
                                    },
                                    domesticPrice: {
                                        type: "number",
                                        description: "If not mentioned keep it empty. Base room price for Domestic Guest.",
                                    },
                                    fitPrice: {
                                        type: "number",
                                        description: "If not mentioned keep it empty. Base room price for FIT Guest. FIT means price for small group.",
                                    },
                                    gitPrice: {
                                        type: "number",
                                        description: "If not mentioned keep it empty. Base room price for GIT Guest. GIT means price for large group.",
                                    },
                                    minNights: {
                                        type: "number",
                                        description: "Minimum number of nights required for booking this room category. If not mentioned, keep it empty.",
                                    }
                                },
                            },
                            description: "Array of pricing objects for different pricing periods or guest types"
                        },
                        fitGitCondition: {
                            type: "string",
                            description: "Conditions for FIT/GIT pricing (e.g., 'Minimum 10 rooms for GIT pricing'). If not mentioned, leave it empty.",
                        },
                        meals: {
                            type: "string",
                            description: "Meal plan (e.g., Fullboard, Halfboard, Breakfast, Dinner)",
                        },
                        noofChildren: {
                            type: "number",
                            description: "Number of children included in meals for free or discounted meals. If not mentioned, leave it empty.",
                        },
                    },
                },
            },
        },
    },
};
const extractHotelInfo = (uploadedFile) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log("Starting hotel extraction...");
    const startTime = Date.now();
    const hotelChatSession = model.startChat({
        generationConfig: hotelGenerationConfig,
        history: [
            {
                role: "user",
                parts: [
                    {
                        text: `Extract hotel information from this document. Focus on hotel-level details and create separate objects for each distinct hotel found. Scan the ENTIRE document for all hotels.`
                    }
                ]
            },
            {
                role: "model",
                parts: [
                    {
                        text: `{
              "hotels": [
                {
                  "hotelName": "EDEN OCEAN VIEW HOTEL",
                  "vat": 1.1,
                  "reservationEmail": "reservation@edenooceanhotel.com",
                  "childPolicies": ["Children under 6 years old: Free", "Children 6-12 years old: VND 200,000/room/night"],
                  "promotions": ["Book 3 nights get 30% off", "Early bird discount 20%"],
                  "markets": ["Domestic", "Indian", "Korean", "Chinese"],
                  "cancellationPolicys": ["Free cancellation 7 days before check-in", "No show or early departure will be charged 100% of the total amount"],
                  "allInclusive": {
                    "child": 150000,
                    "adult": 300000,
                    "childAgeRange": "0-12 years"
                  },
                  "breakfast": {
                    "child": 100000,
                    "adult": 200000,
                    "childAgeRange": "0-12 years"
                  },
                  "fullBoard": {
                    "child": 250000,
                    "adult": 500000,
                    "childAgeRange": "0-12 years"
                  },
                  "halfBoard": {
                    "child": 180000,
                    "adult": 350000,
                    "childAgeRange": "0-12 years"
                  },
                  "galaDinner": [
                    {
                      "adult": 500000,
                      "child": 250000,
                      "date": "31-12-2024",
                      "childAgeRange": "0-11",
                      "description": "New Year gala dinner with live entertainment"
                    }
                  ],
                  "extraBed": {
                    "adult": 300000,
                    "child": 150000,
                    "childAgeRange": "0-12 years"
                  },
                  "surcharge": [
                    {
                      "description": "Holiday surcharge: VND 200,000/room/night",
                      "percentage": 20,
                      "date": ["24-12-2024", "31-12-2024"]
                    }
                  ]
                }
              ]
            }`
                    }
                ]
            }
        ]
    });
    const hotelResult = yield hotelChatSession.sendMessage([
        {
            fileData: {
                mimeType: uploadedFile.mimeType,
                fileUri: uploadedFile.uri,
            },
        },
        {
            text: `Extract hotel information from this document. Focus on hotel-level details:
      - Hotel names (create separate objects for each distinct hotel)
      - VAT information
      - Gala dinner details
      - Promotions (only price-related offers, exclude complimentary items)
      - Cancellation policies
      - Markets served
      - Child policies
      - Reservation email
      - Breakfast/meal pricing
      - Extra bed pricing
      - Surcharges
      
      CRITICAL: Always scan the ENTIRE document for multiple hotels. Look for:
      - Different hotel names (even slight variations)
      - Page breaks or section dividers
      - Multiple pricing tables for different properties
      - Headers indicating new hotel sections

      IMPORTANT: Even if one big company has multiple hotels (Hotel A and Hotel B) in the same PDF, you MUST create separate hotel objects for each distinct hotel. Do NOT combine them into one object.

      Hotel-specific Rules:
      - Even if hotels are from the same company/group, treat each hotel as a separate entity
      - Carefully read through ALL pages to identify every hotel mentioned
      - Look for different hotel names, addresses, or clear section breaks to identify separate hotels
      - If single hotel, create one hotel object with all room categories
      - If you find "Hotel A" and "Hotel B" in the same PDF, create 2 separate hotel objects
      - Do NOT include complimentary items or services in promotions. Examples: Welcome drink, fruit on arrival, free mineral water, free tea/coffee, free Wi-Fi, free use of facilities, etc. Only include price-related offers.
      - Carefully find child policies, child-related promotions, and freebies, and include them in the childPolicies field.
      - All event and gala dinner information should be included in the galaDinner field
      - Carefully check for food and beverage menu and pricing to all-inclusive, breakfast, fullBoard, halfBoard
      - Extract surcharges: look for "Surcharge", "Phụ thu", holiday fees, festival charges, child policies. Do not include additional charges for optional services (e.g., extra services that are only charged if requested). Surcharges should only represent mandatory additional charges on the room rate during holidays or special periods.
      - Return valid JSON only
      - Return in English language

      EXAMPLE: If PDF contains "Radisson Hotel Danang" and "Radisson Resort Phu Quoc", create TWO separate hotel objects even though they are both Radisson properties.
      
      Scan the ENTIRE document for all hotels. Return JSON only.`
        }
    ]);
    const endTime = Date.now();
    console.log(`Hotel extraction time: ${endTime - startTime} ms`);
    const hotelResponseText = hotelResult.response.text();
    console.log("Hotel response tokens:", hotelResult.response.usageMetadata);
    const hotelsResponse = JSON.parse(hotelResponseText);
    console.log("Hotels response length:", ((_a = hotelsResponse.hotels) === null || _a === void 0 ? void 0 : _a.length) || 0);
    return hotelsResponse;
});
const extractRoomCategories = (uploadedFile) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    console.log("Starting room categories extraction...");
    const startTime = Date.now();
    const roomChatSession = model.startChat({
        generationConfig: roomCategoriesGenerationConfig,
        history: [
            {
                role: "user",
                parts: [
                    {
                        text: `Extract room categories from this document. For each room category, include hotel name, room type, date pairs, pricing, and all other details.`
                    }
                ]
            },
            {
                role: "model",
                parts: [
                    {
                        text: `{
              "roomCategories": [
                {
                  "hotelName": "EDEN OCEAN VIEW HOTEL",
                  "category": "Deluxe Sea View",
                  "datePairs": [
                    {
                      "fromDate": "01-01-2025",
                      "toDate": "30-04-2025"
                    },
                    {
                      "fromDate": "01-05-2025",
                      "toDate": "30-09-2025"
                    }
                  ],
                  "season": "Low Season",
                  "maxOccupancy": "2A+1C",
                  "pricing": [
                    {
                      "inboundPrice": 1200000,
                      "domesticPrice": 1000000,
                      "fitPrice": 1100000,
                      "gitPrice": 950000,
                      "minNights": 2
                    }
                  ],
                  "fitGitCondition": "FIT: <6 rooms, GIT: >=6 rooms",
                  "meals": "Breakfast",
                  "noofChildren": 1
                },
                {
                  "hotelName": "EDEN OCEAN VIEW HOTEL",
                  "category": "Superior Garden View",
                  "datePairs": [
                    {
                      "fromDate": "01-10-2025",
                      "toDate": "31-12-2025"
                    }
                  ],
                  "season": "High Season",
                  "maxOccupancy": "2A",
                  "pricing": [
                    {
                      "inboundPrice": 800000,
                      "domesticPrice": 700000,
                      "fitPrice": 750000,
                      "gitPrice": 650000,
                      "minNights": 3
                    }
                  ],
                  "fitGitCondition": "Minimum 10 rooms for GIT pricing",
                  "meals": "Halfboard",
                  "noofChildren": 0
                }
              ]
            }`
                    }
                ]
            }
        ]
    });
    const roomResult = yield roomChatSession.sendMessage([
        {
            fileData: {
                mimeType: uploadedFile.mimeType,
                fileUri: uploadedFile.uri,
            },
        },
        {
            text: `Extract room categories from this document. For each room category, include:
      - Hotel name it belongs to
      - Room category/type
      - Date pairs array: Extract ALL date ranges for this room category (fromDate/toDate in DD-MM-YYYY format)
      - Pricing (inboundPrice, domesticPrice, fitPrice, gitPrice)
      - Season information
      - Meal plans
      - Maximum occupancy
      - FIT/GIT conditions
      - Number of children included
      
      roomCategories (per room/period): category, fromDate/toDate (DD-MM-YYYY), price, extraBed {adult, child}, meals, surcharge (array, only if mentioned)

      CRITICAL: Always scan the ENTIRE document for multiple hotels. Look for:
      - Different hotel names (even slight variations)
      - Page breaks or section dividers
      - Multiple pricing tables for different properties
      - Headers indicating new hotel sections

      IMPORTANT: Even if one big company has multiple hotels (Hotel A and Hotel B) in the same PDF, you MUST create separate hotel objects for each distinct hotel. Do NOT combine them into one object.

      Room-specific Rules:
      - Even if hotels are from the same company/group, treat each hotel as a separate entity
      - Carefully read through ALL pages to identify every hotel mentioned
      - Look for different hotel names, addresses, or clear section breaks to identify separate hotels
      - If single hotel, create one hotel object with all room categories
      - If you find "Hotel A" and "Hotel B" in the same PDF, create 2 separate hotel objects
      - Only use low season and high season prices, ignore walk-in prices
      - MUST create separate hotel objects for EACH distinct hotel found in the PDF
      - If FIT/GIT conditions are mentioned, then only you will find fitPrice and gitPrice, otherwise they will be empty.
      - Domestic prices are for domestic guests, inbound prices are for international guests. If market is different from the hotel country then it inbound price, otherwise domestic price.
      - If Domestic, Inbound prices, FIT Prices, GIT Prices are not mentioned, keep them empty. dont assume any values. It is optional.
      - Extra bed prices may vary between different room categories and hotels, so carefully check each room category and hotel for their specific extra bed pricing.
      - Separate roomCategories for each room type/pricing period
      - If not mentioned, leave it out. Extract extraBed prices: check if extra bed is available for that room category, and look for "Extrabed", "Extra bed".
      - Return valid JSON only
      - Return in English language

      EXAMPLE: If PDF contains "Radisson Hotel Danang" and "Radisson Resort Phu Quoc", create TWO separate hotel objects even though they are both Radisson properties.
      
      IMPORTANT: For datePairs, extract all pricing periods for each room category. If a room category has multiple pricing periods (e.g., Low Season 01-07-2025 to 30-09-2025, High Season 01-10-2025 to 31-12-2025), include all pairs in the datePairs array.
      
      Make sure to associate each room category with the correct hotel name. Return JSON only.`
        }
    ]);
    const endTime = Date.now();
    console.log(`Room categories extraction time: ${endTime - startTime} ms`);
    const roomResponseText = roomResult.response.text();
    console.log("Room categories response tokens:", roomResult.response.usageMetadata);
    const roomCategoriesResponse = JSON.parse(roomResponseText);
    console.log("Room categories no of objects:", ((_b = roomCategoriesResponse.roomCategories) === null || _b === void 0 ? void 0 : _b.length) || 0);
    return roomCategoriesResponse;
});
// Updated main function to run both extractions simultaneously
const extractHotelData = (filePath, supplierId, country, city, currency, requestId, createdBy, stars, fileUrl) => __awaiter(void 0, void 0, void 0, function* () {
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
        // Run both extractions simultaneously
        console.log("Starting simultaneous hotel and room category extraction...");
        const totalStartTime = Date.now();
        const [hotelsResponse, roomCategoriesResponse] = yield Promise.all([
            extractHotelInfo(uploadedFile),
            extractRoomCategories(uploadedFile)
        ]);
        const totalEndTime = Date.now();
        console.log(`Total extraction time: ${totalEndTime - totalStartTime} ms`);
        // COMBINE HOTEL AND ROOM CATEGORIES WITH DATE PAIR EXPANSION
        console.log("Combining hotel and room category data...");
        const combinedHotels = hotelsResponse.hotels.map(hotel => {
            // Find room categories for this hotel
            const hotelRoomCategories = roomCategoriesResponse.roomCategories.filter(room => room.hotelName.toLowerCase().trim() === hotel.hotelName.toLowerCase().trim());
            // Expand room categories based on date pairs
            const expandedRoomCategories = [];
            hotelRoomCategories.forEach(roomCategory => {
                // If datePairs exist, create separate objects for each date pair
                if (roomCategory.datePairs && roomCategory.datePairs.length > 0) {
                    roomCategory.datePairs.forEach(datePair => {
                        // If pricing array exists, create separate objects for each pricing
                        if (roomCategory.pricing && roomCategory.pricing.length > 0) {
                            roomCategory.pricing.forEach(pricingItem => {
                                expandedRoomCategories.push(Object.assign(Object.assign({}, roomCategory), { fromDate: datePair.fromDate, toDate: datePair.toDate, inboundPrice: pricingItem.inboundPrice, domesticPrice: pricingItem.domesticPrice, fitPrice: pricingItem.fitPrice, gitPrice: pricingItem.gitPrice, minNights: pricingItem.minNights, 
                                    // Remove the arrays since we've expanded them
                                    datePairs: undefined, pricing: undefined }));
                            });
                        }
                        else {
                            expandedRoomCategories.push(Object.assign(Object.assign({}, roomCategory), { fromDate: datePair.fromDate, toDate: datePair.toDate, datePairs: undefined, pricing: undefined }));
                        }
                    });
                }
                else {
                    // If no datePairs but pricing exists
                    if (roomCategory.pricing && roomCategory.pricing.length > 0) {
                        roomCategory.pricing.forEach(pricingItem => {
                            expandedRoomCategories.push(Object.assign(Object.assign({}, roomCategory), { inboundPrice: pricingItem.inboundPrice, domesticPrice: pricingItem.domesticPrice, fitPrice: pricingItem.fitPrice, gitPrice: pricingItem.gitPrice, minNights: pricingItem.minNights, datePairs: undefined, pricing: undefined }));
                        });
                    }
                    else {
                        // If no datePairs and no pricing, keep the original object
                        expandedRoomCategories.push(Object.assign(Object.assign({}, roomCategory), { datePairs: undefined, pricing: undefined }));
                    }
                }
            });
            return {
                hotelInfo: {
                    hotelName: hotel.hotelName,
                    starsCategory: stars,
                    vat: hotel.vat,
                    galaDinner: hotel.galaDinner,
                    promotions: hotel.promotions,
                    cancellationPolicys: hotel.cancellationPolicys,
                    markets: hotel.markets,
                    childPolicies: hotel.childPolicies,
                    breakfast: hotel.breakfast,
                    fullBoard: hotel.fullBoard,
                    halfBoard: hotel.halfBoard,
                    allInclusive: hotel.allInclusive,
                    surcharge: hotel.surcharge,
                    extraBed: hotel.extraBed,
                    reservationEmail: hotel.reservationEmail
                },
                roomCategories: expandedRoomCategories
            };
        });
        // Process each hotel separately
        for (const hotelData of combinedHotels) {
            if (hotelData.roomCategories.length === 0) {
                console.warn(`No room categories found for hotel: ${hotelData.hotelInfo.hotelName}`);
                continue;
            }
            const combinedHotelData = hotelData.roomCategories.map(roomCategory => (Object.assign({ hotelName: hotelData.hotelInfo.hotelName, starsCategory: stars, vat: hotelData.hotelInfo.vat, galaDinner: hotelData.hotelInfo.galaDinner, promotions: hotelData.hotelInfo.promotions, cancellationPolicys: hotelData.hotelInfo.cancellationPolicys, markets: hotelData.hotelInfo.markets, childPolicies: hotelData.hotelInfo.childPolicies, reservationEmail: hotelData.hotelInfo.reservationEmail, breakfast: hotelData.hotelInfo.breakfast, fullBoard: hotelData.hotelInfo.fullBoard, halfBoard: hotelData.hotelInfo.halfBoard, allInclusive: hotelData.hotelInfo.allInclusive, surcharge: hotelData.hotelInfo.surcharge, extraBed: hotelData.hotelInfo.extraBed }, roomCategory)));
            console.log(`Processing ${combinedHotelData.length} room category records for hotel: ${hotelData.hotelInfo.hotelName}`);
            // Create hotels for this specific hotel
            const createResult = yield (0, api_1.createHotels)({
                hotels: combinedHotelData,
                supplierId: supplierId.trim(),
                country: country.trim(),
                city: city.trim(),
                currency: currency.trim(),
                createdBy: createdBy.trim(),
                fileUrl: fileUrl.trim(),
            });
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

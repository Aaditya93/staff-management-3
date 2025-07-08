// @ts-nocheck
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import fs from "fs";
import path from "path";
import { createHotels } from "./api";
import HotelRequest from "../db/HotelRequest";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  throw new Error("API key is not defined");
}

const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

export const uploadToGemini = async (filePath: string, mimeType: string) => {
  const uploadResult = await fileManager.uploadFile(filePath, {
    mimeType,
    displayName: path.basename(filePath),
  });
  const file = uploadResult.file;
  return file;
};

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
    required: ["hotelInfo", "roomCategories"],
    properties: {
      hotelInfo: {
        type: "object",
        required: ["hotelName", "starsCategory", "vat"],
        properties: {
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
                description: "Age range for children",
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
        },
      },
      roomCategories: {
        type: "array",
        items: {
          type: "object",
          required: [
            "category",
            "fromDate",
            "toDate",
            "price",
            "extraBed",
            "meals",
            "surcharge",
          ],
          properties: {
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
                    description:
                      "Surcharge percentage (e.g., 10 for 10%). Leave empty if fixed amount is specified instead of percentage.",
                  },
                  date: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                    description:
                      "Array of dates when surcharge applies (e.g., ['2023-12-25 - 2023-12-31']). Leave empty if surcharge applies generally or for specific conditions rather than dates.",
                  },
                  description: {
                    type: "string",
                    description:
                      "Complete description for surcharge including amount, conditions, and age ranges. Examples: 'Holiday surcharge', 'Peak season surcharge', 'VND 235,000/night for child 5-11 years sharing bed with parents including breakfast', 'VND 470,000/night for child until 18 years with extra bed including breakfast', 'VND 770,000 for 3rd adult/child over 11 years halfboard package'",
                  },
                },
              },
              description:
                "Array of surcharges including child policies and additional charges. Include all surcharge information in the description field when percentage or specific dates are not applicable. Only include if surcharges or child policies are mentioned in the document.",
            },
          },
        },
      },
    },
  },
};

export const extractHotelData = async (
  filePath: string,
  supplierId: string,
  country: string,
  city: string,
  currency: string,
  requestId: string,
  createdBy: string,
) => {
  if (!filePath) {
    throw new Error("No file path provided");
  }

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    throw new Error("File does not exist at the provided path");
  }

  // Get file info for validation
  const fileName = path.basename(filePath).toLowerCase();
  const fileExt = path.extname(filePath).toLowerCase();

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

  const isValidExtension = validExtensions.some((ext) =>
    fileName.endsWith(ext)
  );

  if (!isValidExtension) {
    throw new Error(
      "Unsupported file format. Please upload PDF, image, or document files."
    );
  }

  // Determine MIME type based on extension
  let mimeType = "application/pdf"; // default
  if (fileExt === ".pdf") mimeType = "application/pdf";
  else if ([".jpg", ".jpeg"].includes(fileExt)) mimeType = "image/jpeg";
  else if (fileExt === ".png") mimeType = "image/png";
  else if (fileExt === ".gif") mimeType = "image/gif";
  else if (fileExt === ".bmp") mimeType = "image/bmp";
  else if (fileExt === ".webp") mimeType = "image/webp";
  else if (fileExt === ".tiff") mimeType = "image/tiff";
  else if (fileExt === ".doc") mimeType = "application/msword";
  else if (fileExt === ".docx")
    mimeType =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  else if (fileExt === ".xls") mimeType = "application/vnd-ms-excel";
  else if (fileExt === ".xlsx")
    mimeType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  else if (fileExt === ".txt") mimeType = "text/plain";

  let uploadedFile;

  try {
    // Upload file to Gemini
    uploadedFile = await uploadToGemini(filePath, mimeType);

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
              text: `Extract hotel data to JSON with two sections:

hotelInfo (once): hotelName, starsCategory (number), vat (1.1=10%, 1.2=20%, default=1), galaDinner (only if mentioned), promotions (array)

roomCategories (per room/period): category, fromDate/toDate (DD-MM-YYYY), price, extraBed {adult, child}, meals, surcharge (array, only if mentioned)

Rules:
- Only use low season and high season prices, ignore walk-in prices
- One hotelInfo per document
- Separate roomCategories for each room type/pricing period
- Include galaDinner/surcharge only if explicitly stated
- Extract extraBed prices: look for "Extrabed", "Extra bed", "Giường phụ" sections
- Extract surcharges: look for "Surcharge", "Phụ thu", holiday fees, festival charges, child policies
- Extract child pricing policies as surcharges with age ranges in description
- Return valid JSON only`,
            },
           
          ],
        },
        {
          role: "model",
          parts: [
            {
              text: `{
                "hotelInfo": {
                  "hotelName": "EDEN OCEAN VIEW HOTEL",
                  "starsCategory": 4,
                  "vat": 1,
                  "promotions": ["F.O.C 16-1 Maximum 4 rooms", "Rates inclusive of breakfast, 5% service charge and government tax"]
                },
                "roomCategories": [
                  {
                    "category": "Classic Double",
                    "fromDate": "01-01-2025",
                    "toDate": "20-04-2025",
                    "price": 750000,
                    "extraBed": {
                      "adult": 300000,
                      "child": 150000
                    },
                    "meals": "Breakfast",
                    "surcharge": [
                      {
                        "description": "Children under 6 years old: Free",
                        "percentage": null,
                        "date": []
                      },
                      {
                        "description": "Children 6-11 years old: VND 150,000",
                        "percentage": null,
                        "date": []
                      },
                      {
                        "description": "12 years and above: VND 300,000",
                        "percentage": null,
                        "date": []
                      },
                      {
                        "description": "Holiday surcharge: VND 200,000/room/night",
                        "percentage": null,
                        "date": ["01-01-2025", "29-01-2025 to 31-01-2025", "07-04-2025", "30-04-2025", "01-05-2025", "02-09-2025", "03-09-2025"]
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

     const result = await chatSession.sendMessage(
      `Extract hotel data following above format. Return JSON only.`
    );

    // Track end time and log duration
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    console.log(`AI action time taken: ${durationMs} ms`);

    // Log token usage if available
    if (result.response.usageMetadata) {
      console.log("AI token usage:", result.response.usageMetadata);
    }

    const responseText = result.response.text();

    if (!responseText || responseText.trim() === "") {
      throw new Error("Empty response from AI model");
    }

    const jsonResponse = JSON.parse(responseText);

    // Combine hotelInfo with each roomCategory to create the desired hotel objects
    const combinedHotels = jsonResponse.roomCategories.map(roomCategory => ({
      ...jsonResponse.hotelInfo,
      ...roomCategory
    }));

    // Add hotel creation logic here
    const createResult = await createHotels({
      hotels: combinedHotels,
      supplierId: supplierId.trim(),
      country: country.trim(),
      city: city.trim(),
      currency: currency.trim(),
      createdBy: createdBy.trim(),
    });
    console.log("Hotels created successfully:", createResult);

    // Clean up: delete the uploaded file from Gemini
    try {
      await fileManager.deleteFile(uploadedFile.name);
    } catch (deleteError) {
      console.warn("Could not delete uploaded file:", deleteError);
    }

    // Clean up the uploaded file from server
    try {
      fs.unlinkSync(filePath);
    } catch (cleanupError) {
      console.error("Error cleaning up file:", cleanupError);
    }
    
    const updateStatus = await HotelRequest.findByIdAndUpdate(
      requestId,
      { isComplete: true },
      { new: true }
    );
    console.log("Hotel request status updated:", updateStatus);

    return;
  } catch (error) {
    console.error("Error in extractHotelData:", error);

    // Clean up on error
    if (uploadedFile) {
      try {
        await fileManager.deleteFile(uploadedFile.name);
      } catch (deleteError) {
        console.warn("Could not delete uploaded file on error:", deleteError);
      }
    }

    // Clean up the uploaded file on error
    try {
      fs.unlinkSync(filePath);
    } catch (cleanupError) {
      console.error("Error cleaning up file on error:", cleanupError);
    }

    throw error;
  }
};
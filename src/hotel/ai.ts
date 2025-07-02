// @ts-nocheck
"use server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import fs from "fs";
import path from "path";

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
  maxOutputTokens: 20000,
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
              description:
                "Room category (e.g., Deluxe Internal Window, Superior, Standard)",
            },
            fromDate: {
              type: "string",
              description:
                "Start date of pricing period in DD-MM-YYYY format (e.g., '01-07-2025')",
            },
            toDate: {
              type: "string",
              description:
                "End date of pricing period in DD-MM-YYYY format (e.g., '01-09-2025')",
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
                  description:
                    "Breakfast price without extra bed (if specified, otherwise 0)",
                },
              },
            },
            meals: {
              type: "string",
              description:
                "Meal plan array (e.g., Fullboard, Halfboard, Breakfast, Dinner) Halfboard means breakfast and dinner included, Fullboard means all meals included",
            },
            vat: {
              type: "number",
              description:
                "VAT percentage if mentioned (e.g., 10 for 1.10 VAT). 20 percent for 1.20 VAT. If it's not mentioned, vat is 1",
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
                  description: "Date of gala dinner",
                },
                childAgeRange: {
                  type: "string",
                  description: "Age range for children (e.g., '0-12 years')",
                },
              },
            },
            promotions: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Hotel promotions or special offers",
            },
          },
        },
      },
    },
  },
};

// Helper function to get MIME type from file extension or file content
function getMimeTypeFromFile(filePath: string): string {
  // First try to get extension from the file path
  let ext = path.extname(filePath).toLowerCase();

  // If no extension found, try to detect from file content or original name
  if (!ext || ext === ".") {
    // Check if there's a file with a different name pattern
    const basename = path.basename(filePath);

    // Try to extract extension from basename if it contains dots
    const parts = basename.split(".");
    if (parts.length > 1) {
      ext = "." + parts[parts.length - 1].toLowerCase();
    }
  }

  const mimeTypes: { [key: string]: string } = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".webp": "image/webp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".txt": "text/plain",
  };

  return mimeTypes[ext] || null;
}

export const extractHotelData = async (filePath: string) => {
  if (!filePath) {
    throw new Error("No file path provided");
  }

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    throw new Error("File does not exist at the provided path");
  }

  // Determine MIME type from file extension
  const mimeType = getMimeTypeFromFile(filePath);

  // Check if the file type is supported
  if (!mimeType) {
    const ext = path.extname(filePath) || "unknown";
    throw new Error(
      `Unsupported file format: ${ext}. Please upload PDF, image (JPG, PNG, GIF, BMP, WebP, TIFF), or document files (DOC, DOCX, XLS, XLSX, TXT).`
    );
  }

  try {
    // Upload file to Gemini
    const uploadedFile = await uploadToGemini(filePath, mimeType);

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

Example:
{
  "hotels": [
    {
      "hotelName": "LA SINFONIA CITADEL HOTEL",
      "starsCategory": 4,
      "category": "Executive internal window",
      "fromDate": "01-05-2025",
      "toDate": "30-09-2025",
      "price": 1550000,
      "extraBed": {
        "adult": 600000,
        "child": 500000,
        "breakfastWithoutExtraBed": 0
      },
      "meals": "Breakfast",
      "vat": 1,
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

    const result = await chatSession.sendMessage(
      `Extract all hotel data from this document following the specified format.
      - Create SEPARATE hotel objects for each unique combination of hotel, room category, pricing period, and price.
      - Each hotel object should contain the room category information directly at the hotel level, not nested.
      - Use DD-MM-YYYY format for dates.
      - Only include VAT and surcharge fields if they are explicitly mentioned in the document.
      - DO NOT return duplicate hotel objects. Each object in the hotels array must be unique.`
    );

    const jsonResponse = JSON.parse(result.response.text());

    // Clean up: delete the uploaded file from Gemini (optional)
    try {
      await fileManager.deleteFile(uploadedFile.name);
    } catch (deleteError) {
      console.warn("Could not delete uploaded file from Gemini:", deleteError);
    }

    return jsonResponse;
  } catch (error) {
    console.error("Error in extractHotelData:", error);

    // Provide more specific error messages
    if (error.message?.includes("mimeType parameter")) {
      throw new Error(
        `Unsupported file type: ${mimeType}. Please try a different file format.`
      );
    }

    throw error;
  }
};

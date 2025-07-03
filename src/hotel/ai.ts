// @ts-nocheck
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
                "Meal plan (e.g., Fullboard, Halfboard, Breakfast, Dinner) Halfboard means breakfast and dinner included, Fullboard means all meals included",
            },
            vat: {
              type: "number",
              description:
                "VAT multiplier (e.g., 1.1 for 10% VAT, 1.2 for 20% VAT). If not mentioned, vat is 1",
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
                      "Surcharge percentage (e.g., 10 for 10%). Leave as 0 if fixed amount.",
                  },
                  date: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                    description:
                      "Array of dates when surcharge applies (e.g., ['2023-12-25 - 2023-12-31']). Leave empty if surcharge applies generally.",
                  },
                  description: {
                    type: "string",
                    description:
                      "Complete description for surcharge including amount, conditions, and age ranges.",
                  },
                },
              },
              description:
                "Array of surcharges including child policies and additional charges. Empty array if no surcharges mentioned.",
            },
            galaDinner: {
              type: "object",
              properties: {
                adult: {
                  type: "number",
                  description:
                    "Gala dinner price for adults (0 if not mentioned)",
                },
                child: {
                  type: "number",
                  description:
                    "Gala dinner price for children (0 if not mentioned)",
                },
                date: {
                  type: "string",
                  description: "Date of gala dinner (empty if not mentioned)",
                },
                childAgeRange: {
                  type: "string",
                  description:
                    "Age range for children (empty if not mentioned)",
                },
              },
            },
            promotions: {
              type: "array",
              items: {
                type: "string",
              },
              description:
                "Hotel promotions or special offers (empty array if none)",
            },
          },
        },
      },
    },
  },
};

// Function to handle File/Blob objects
export const extractHotelDataFromFile = async (file: File | Blob) => {
  if (!file) {
    throw new Error("No file provided");
  }

  // Validate file type
  const fileType = file.type;
  const fileName = (file as File).name?.toLowerCase() || "unknown";

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
  const isValidExtension = validExtensions.some((ext) =>
    fileName.endsWith(ext)
  );

  if (!isValidType && !isValidExtension) {
    throw new Error(
      "Unsupported file format. Please upload PDF, image, or document files."
    );
  }

  // Create a temporary path to save the file
  const tempDir = path.join(process.cwd(), "tmp/uploads");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const tempPath = path.join(
    tempDir,
    (file as File).name || `file_${Date.now()}`
  );

  let uploadedFile;

  try {
    // Save the file to the temporary directory
    const fileBuffer = await file.arrayBuffer();
    fs.writeFileSync(tempPath, Buffer.from(fileBuffer));

    console.log(`Uploading file to Gemini: ${fileName} (${fileType})`);

    // Upload file to Gemini
    uploadedFile = await uploadToGemini(tempPath, fileType);

    console.log("File uploaded successfully, starting chat session...");

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

    console.log("Sending message to Gemini...");

    const result = await chatSession.sendMessage(
      `Extract all hotel data from this document following the specified format.
      - Create SEPARATE hotel objects for each unique combination of hotel, room category, pricing period, and price.
      - Each hotel object should contain the room category information directly at the hotel level, not nested.
      - Use DD-MM-YYYY format for dates.
      - Only include VAT and surcharge fields if they are explicitly mentioned in the document.
      - DO NOT return duplicate hotel objects. Each object in the hotels array must be unique.
      - Return ONLY valid JSON without any markdown formatting.`
    );

    const responseText = result.response.text();
    console.log("Received response from Gemini, parsing JSON...");

    if (!responseText || responseText.trim() === "") {
      throw new Error("Empty response from AI model");
    }

    const jsonResponse = JSON.parse(responseText);

    console.log(
      `Successfully extracted ${jsonResponse.hotels.length} hotel records`
    );

    // Clean up: delete the uploaded file from Gemini
    try {
      await fileManager.deleteFile(uploadedFile.name);
      console.log("Cleaned up uploaded file from Gemini");
    } catch (deleteError) {
      console.warn("Could not delete uploaded file from Gemini:", deleteError);
    }

    return jsonResponse;
  } catch (error) {
    console.error("Error in extractHotelDataFromFile:", error);

    // Clean up on error
    if (uploadedFile) {
      try {
        await fileManager.deleteFile(uploadedFile.name);
        console.log("Cleaned up uploaded file on error");
      } catch (deleteError) {
        console.warn("Could not delete uploaded file on error:", deleteError);
      }
    }

    throw error;
  } finally {
    // Clean up temporary file
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
        console.log("Cleaned up temporary file");
      }
    } catch (cleanupError) {
      console.warn("Could not delete temporary file:", cleanupError);
    }
  }
};

// Original function to handle file paths (keeping for backward compatibility)
export const extractHotelData = async (filePath: string) => {
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
    console.log(`Uploading file to Gemini: ${fileName} (${mimeType})`);

    // Upload file to Gemini
    uploadedFile = await uploadToGemini(filePath, mimeType);

    console.log("File uploaded successfully, starting chat session...");

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

    console.log("Sending message to Gemini...");

    const result = await chatSession.sendMessage(
      `Extract all hotel data from this document following the specified format.
      - Create SEPARATE hotel objects for each unique combination of hotel, room category, pricing period, and price.
      - Each hotel object should contain the room category information directly at the hotel level, not nested.
      - Use DD-MM-YYYY format for dates.
      - Only include VAT and surcharge fields if they are explicitly mentioned in the document.
      - DO NOT return duplicate hotel objects. Each object in the hotels array must be unique.
      - Return ONLY valid JSON without any markdown formatting.`
    );

    const responseText = result.response.text();
    console.log("Received response from Gemini, parsing JSON...");

    if (!responseText || responseText.trim() === "") {
      throw new Error("Empty response from AI model");
    }

    const jsonResponse = JSON.parse(responseText);

    console.log(
      `Successfully extracted ${jsonResponse.hotels.length} hotel records`
    );

    // Clean up: delete the uploaded file from Gemini
    try {
      await fileManager.deleteFile(uploadedFile.name);
      console.log("Cleaned up uploaded file from Gemini");
    } catch (deleteError) {
      console.warn("Could not delete uploaded file from Gemini:", deleteError);
    }

    return jsonResponse;
  } catch (error) {
    console.error("Error in extractHotelData:", error);

    // Clean up on error
    if (uploadedFile) {
      try {
        await fileManager.deleteFile(uploadedFile.name);
        console.log("Cleaned up uploaded file on error");
      } catch (deleteError) {
        console.warn("Could not delete uploaded file on error:", deleteError);
      }
    }

    throw error;
  }
};

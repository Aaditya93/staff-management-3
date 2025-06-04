// @ts-nocheck
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import dotenv from "dotenv";
dotenv.config();
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  throw new Error("API key is not defined");
}

const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

// Optimized response schema with more concise descriptions
const emailAnalysisConfig = {
  temperature: 0.2,
  topP: 0.8,
  topK: 20,
  maxOutputTokens: 8192,
  responseMimeType: "application/json",
  responseSchema: {
    type: "object",
    required: [
      "destination",
      "numberOfPersons",
      "isTravelEmail",
      "companyName",

      "travelAgent",
      "salesStaff",
      "isInquiryEmail",
      "isSupplierEmail",
    ],
    properties: {
      destination: {
        type: "string",
        description: "Travel destination country",
      },
      arrivalDate: {
        type: "string",
        description: "Format: DD/MM/YYYY",
      },
      departureDate: {
        type: "string",
        description: "Format: DD/MM/YYYY",
      },
      numberOfPersons: {
        type: "number",
        description: "Number of travelers",
      },

      isInquiryEmail: {
        type: "boolean",
        description: "Email requests travel packages, pricing, or availability",
      },

      isTravelEmail: {
        type: "boolean",
        description: "Related to travel booking (true if ticket ID present)",
      },
      companyName: {
        type: "string",
        description:
          "Business name in lowercase (exclude domains, emails, URLs, 'Victoria Tours')",
      },
      isSupplierEmail: {
        type: "boolean",
        description:
          "Whether the email relates to supplier operations, including: " +
          "1) Payment requests from hotels or service providers (look for 'thanh toán', 'booking', account numbers, payment details) " +
          "2) Payment confirmations or reports (look for 'BÁO CÁO TIỀN VỀ', payment codes like 'MARAOF250500661', 'STTIOF250500062') " +
          "3) Travel service offerings from partners (hotels, visa services, etc.) " +
          "4) B2B marketing/event invitations from industry partners (travel marts, exhibitions) " +
          "Supplier emails typically contain specific booking codes, payment amounts, account details, or industry event information. " +
          "These emails are NOT client inquiries about travel packages.",
      },
      travelAgent: {
        type: "object",
        properties: {
          name: { type: "string", description: "Agent's full name" },
          emailId: {
            type: "string",
            description: "Agent's email (non-Victoria Tours)",
          },
        },
      },
      salesStaff: {
        type: "object",
        properties: {
          name: { type: "string", description: "Sales rep's name" },
          emailId: { type: "string", description: "Sales rep's email" },
        },
      },
    },
  },
};

// Optimized prompt in the history
export const analyzeEmail = async (emailData: {
  bodyText: string;
  emailType: string;
  from: { name: string; email: string };
  to: Array<{ name: string; email: string }>;
  subject: string;
}) => {
  try {
    const chatSession = model.startChat({
      generationConfig: emailAnalysisConfig,
      history: [
        {
          role: "user",
          parts: [
            {
              text: `Analyze this travel email. Extract: destination, dates, travelers, company (lowercase), 
              and determine if it's travel-related, confirmation, inquiry or supplier email. 
              Rate communication quality (0-10) and summarize in 50 words.`,
            },
          ],
        },
        {
          role: "model",
          parts: [
            {
              text: `I'll analyze the email and provide structured JSON data.`,
            },
          ],
        },
      ],
    });

    // Simplified email prompt
    const emailPrompt = `
    Subject: ${emailData.subject}
    From: ${emailData.from.name} <${emailData.from.email}>
    To: ${emailData.to.map((r) => `${r.name} <${r.email}>`).join(", ")}
    Type: ${emailData.emailType}
    
    ${emailData.bodyText}`;

    const result = await chatSession.sendMessage(emailPrompt);

    try {
      const jsonResponse = JSON.parse(result.response.text());

      // Ensure company name is lowercase
      if (jsonResponse.companyName) {
        jsonResponse.companyName = jsonResponse.companyName.toLowerCase();
      }

      return jsonResponse;
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError);

      // Try to extract JSON content if parsing fails
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        try {
          const extractedJson = JSON.parse(jsonMatch[0]);

          // Ensure company name is lowercase
          if (extractedJson.companyName) {
            extractedJson.companyName = extractedJson.companyName.toLowerCase();
          }

          return extractedJson;
        } catch (e) {
          throw new Error(`Failed to extract JSON from response: ${e}`);
        }
      }

      throw new Error("Response is not in valid JSON format");
    }
  } catch (error) {
    console.error("Error analyzing email:", error);
    throw new Error(`Failed to analyze email: ${error || error}`);
  }
};

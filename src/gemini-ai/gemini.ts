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
      "personnelMentioned",
      "travelAgent",
      "salesStaff",
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
      isTravelEmail: {
        type: "boolean",
        description: "Related to travel booking (true if ticket ID present)",
      },
      companyName: {
        type: "string",
        description:
          "Business name in lowercase (exclude domains, emails, URLs, 'Victoria Tours')",
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
      personnelMentioned: {
        type: "array",
        description:
          "Array of personnel from email headers only (From, To, CC fields) - do not extract names from email body content",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Full name of the person from email headers",
            },
            emailId: {
              type: "string",
              description: "Email address from From/To/CC fields only",
            },
          },
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

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
exports.analyzeEmail = void 0;
// @ts-nocheck
const generative_ai_1 = require("@google/generative-ai");
const server_1 = require("@google/generative-ai/server");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
    throw new Error("API key is not defined");
}
const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
const fileManager = new server_1.GoogleAIFileManager(apiKey);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
});
// First, update the response schema to include the personnel fields
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
            "summary",
            "rating",
            "hasTicketId",
            "isTravelEmail",
            "companyName",
            "isConfirmationEmail",
            "travelAgent",
            "salesStaff",
            "isInquiryEmail",
            "isSupplierEmail",
        ],
        properties: {
            destination: {
                type: "string",
                description: "The travel destination mentioned in the email. It should be a Country name",
            },
            arrivalDate: {
                type: "string",
                description: "Arrival date in DD/MM/YYYY format",
            },
            departureDate: {
                type: "string",
                description: "Departure date in DD/MM/YYYY format",
            },
            numberOfPersons: {
                type: "number",
                description: "Number of people traveling",
            },
            summary: {
                type: "string",
                description: "A concise and accurate summary of the email content in about 100 words",
            },
            rating: {
                type: "number",
                description: "Rating from 0-10 based on how helpful and polite the staff was and how well the deal is progressing",
                minimum: 0,
                maximum: 10,
            },
            hasTicketId: {
                type: "boolean",
                description: "Whether the email contains a ticket ID or reference number",
            },
            isInquiryEmail: {
                type: "boolean",
                description: "Whether the email is an inquiry about travel packages or rates. Usually contains requests for itineraries, pricing, or availability for specific destinations and dates.",
            },
            ticketId: {
                type: "string",
                description: "The ticket ID must be exactly 24 characters long and contain only hexadecimal characters (0-9, a-f). " +
                    "Example format: '68021f4013d187f32b23ae9c'. Only extract this if the ID matches this exact pattern. " +
                    "IDs might be labeled as 'TicketID:', 'Reference:', or similar. Return an empty string if no valid ticket ID is found.",
            },
            isConfirmationEmail: {
                type: "boolean",
                description: "Whether the email is a of recevide Travel request confirmation.It has Thank You for Your Inquiry! menitioned in the mail",
            },
            isTravelEmail: {
                type: "boolean",
                description: "Whether the email is related to travel booking and packages. If Ticket id is present then this should be true",
            },
            // For the schema description
            companyName: {
                type: "string",
                description: "The actual business/company name mentioned in the email (e.g., 'Your Vacation DMC', not 'yourvacationdmc.com'). Return in lowercase letters. Exclude domain names, email addresses, and URLs. Do not include 'Victoria Tours' as the company name.",
            },
            isSupplierEmail: {
                type: "boolean",
                description: "Whether the email relates to supplier operations, including: " +
                    "1) Payment requests from hotels or service providers (look for 'thanh toán', 'booking', account numbers, payment details) " +
                    "2) Payment confirmations or reports (look for 'BÁO CÁO TIỀN VỀ', payment codes like 'MARAOF250500661', 'STTIOF250500062') " +
                    "3) Travel service offerings from partners (hotels, visa services, etc.) " +
                    "4) B2B marketing/event invitations from industry partners (travel marts, exhibitions) " +
                    "Supplier emails typically contain specific booking codes, payment amounts, account details, or industry event information. " +
                    "These emails are NOT client inquiries about travel packages.",
            },
            travelAgent: {
                type: "object",
                description: "Travel agent handling the booking",
                properties: {
                    name: {
                        type: "string",
                        description: "Full name of the travel agent",
                    },
                    emailId: {
                        type: "string",
                        description: "Email address of the travel agent. It should not be of Victoria Tours employee",
                    },
                },
            },
            salesStaff: {
                type: "object",
                description: "Sales staff involved in the transaction or booking process",
                properties: {
                    name: {
                        type: "string",
                        description: "Full name of the sales representative",
                    },
                    emailId: {
                        type: "string",
                        description: "Email address of the sales representative",
                    },
                },
            },
            personnelMentioned: {
                type: "array",
                description: "Array of all personnel mentioned in the email",
                items: {
                    type: "object",
                    properties: {
                        name: {
                            type: "string",
                            description: "Full name of the person",
                        },
                        emailId: {
                            type: "string",
                            description: "Email address of the person",
                        },
                    },
                },
            },
            // Add the personnel information schemas
        },
    },
};
// Update the prompt in the history for the chat session
const analyzeEmail = (emailData) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const chatSession = model.startChat({
            generationConfig: emailAnalysisConfig,
            history: [
                {
                    role: "user",
                    parts: [
                        {
                            text: `You are a travel and hospitality AI assistant. Analyze the following email and extract key information about travel plans. 
              Extract the destination, arrival date, departure date, number of persons traveling, company name (in lowercase letters),
              provide a concise 100-word summary, and assign a rating from 0-10 based on how helpful/polite 
              the communication is and how well the deal seems to be progressing. Also determine if the email contains 
              a ticket ID/reference number and if the email is related to travel booking and packages.`,
                        },
                    ],
                },
                {
                    role: "model",
                    parts: [
                        {
                            text: `I'll analyze the travel email and extract the requested information in JSON format.`,
                        },
                    ],
                },
            ],
        });
        // ...existing code...
        const emailPrompt = `
    Subject: ${emailData.subject}
    From: ${emailData.from.name} <${emailData.from.email}>
    To: ${emailData.to
            .map((recipient) => `${recipient.name} <${recipient.email}>`)
            .join(", ")}
    Type: ${emailData.emailType}
    
    Body:
    ${emailData.bodyText}
    
    Extract the following information and return it as valid JSON:
    1. destination: The travel destination mentioned in the email. It should be a Country name.
    2. arrivalDate: Arrival date in DD/MM/YYYY format
    3. departureDate: Departure date in DD/MM/YYYY format
    4. numberOfPersons: Number of people traveling
    5. summary: A concise and accurate summary of the email content in about 100 words
    6. rating: Rating from 0-10 based on how helpful/polite the communication is and how well the deal seems to be progressing
    7. hasTicketId: Boolean (true/false) indicating if the email contains any ticket ID or reference number
    8. ticketId: The actual ticket ID or reference number if present (empty string if none)
    9. isTravelEmail: Boolean (true/false) indicating if the email is related to travel booking and packages
    10. companyName: The company or travel agency name mentioned in the email (convert to all lowercase letters). It should not be 'Victoria Tours'.
    11. travelAgent: Travel agent handling the booking (with name and emailId). It should not be of victoria Tours employee
    12. salesStaff: Sales Staff handling the booking (with name and emailId). It Should be  of victoria Tours employee 
    13. personnelMentioned: Array of all unique personnel mentioned in the email with their name, emailId, and role if available
    14. isConfirmationEmail: Boolean (true/false) indicating if the email is a confirmation email for travel request. It has Thank You for Your Inquiry! mentioned in the mail
    15. isInquiryEmail: Boolean (true/false) indicating if the email is an inquiry about travel packages, rates, or itineraries
    16. isSupplierEmail: Boolean (true/false) indicating if the email relates to supplier operations (payment requests, confirmations, service offerings, or industry events)
    Look carefully for ticket IDs, booking references, or confirmation numbers in any format.
    For the company name, ensure it's in all lowercase letters and is consistent.
    Identify all personnel mentioned in the email with their full names and email addresses if available.
    If an email signature is present, extract the contact details from it.
    `;
        // ...existing code...
        // Rest of the function remains the same
        const result = yield chatSession.sendMessage(emailPrompt);
        try {
            const jsonResponse = JSON.parse(result.response.text());
            // Ensure company name is lowercase
            if (jsonResponse.companyName) {
                jsonResponse.companyName = jsonResponse.companyName.toLowerCase();
            }
            return jsonResponse;
        }
        catch (parseError) {
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
                }
                catch (e) {
                    throw new Error(`Failed to extract JSON from response: ${e}`);
                }
            }
            throw new Error("Response is not in valid JSON format");
        }
    }
    catch (error) {
        console.error("Error analyzing email:", error);
        throw new Error(`Failed to analyze email: ${error || error}`);
    }
});
exports.analyzeEmail = analyzeEmail;

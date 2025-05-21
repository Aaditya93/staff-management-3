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
Object.defineProperty(exports, "__esModule", { value: true });
exports.processIncomingEmail = void 0;
const gemini_1 = require("./gemini-ai/gemini");
const create_ticket_1 = require("./db/create-ticket");
const process_email_transform_1 = require("./process-email-transform");
/**
 * Processes an incoming email with AI analysis and ticket handling
 *
 * @param email - The raw email data
 * @returns Result object with analysis and ticket information
 */
function processIncomingEmail(emailData) {
    return __awaiter(this, void 0, void 0, function* () {
        const aiData = yield (0, process_email_transform_1.transformEmailData)(emailData.email);
        const analysis = yield (0, gemini_1.analyzeEmail)(aiData);
        console.log("AI Analysis Result:", analysis);
        let ticketResult = null;
        // Handle ticket creation if it's a travel email
        if (analysis.isTravelEmail && !analysis.isConfirmationEmail) {
            try {
                ticketResult = yield (0, create_ticket_1.handleIncomingEmail)(analysis, emailData.email);
            }
            catch (error) {
                console.error("Error handling ticket:", error);
                throw new Error(`Ticket processing failed: ${error}`);
            }
        }
        return {
            analysis,
            ticketResult,
            success: true,
        };
    });
}
exports.processIncomingEmail = processIncomingEmail;

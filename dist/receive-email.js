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
exports.processIncomingEmail = void 0;
const gemini_1 = require("./gemini-ai/gemini");
const create_ticket_1 = require("./db/create-ticket");
const process_email_transform_1 = require("./process-email-transform");
const ticket_id_1 = require("./ticket-id");
const ticket_1 = __importDefault(require("./db/ticket"));
const db_1 = __importDefault(require("./db/db"));
/**
 * Processes an incoming email with AI analysis and ticket handling
 *
 * @param email - The raw email data
 * @returns Result object with analysis and ticket information
 */
function processIncomingEmail(emailData) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        // Check if email contains an existing ticket ID
        // Check if email contains an existing ticket ID - check both subject and body
        const subjectTicketId = emailData.email.subject
            ? (0, ticket_id_1.extractTicketId)(emailData.email.subject)
            : null;
        const bodyTicketId = emailData.email.bodyText
            ? (0, ticket_id_1.extractTicketId)(emailData.email.bodyText)
            : null;
        // Use subject ticket ID first if available, otherwise use body ticket ID
        const ticketId = subjectTicketId || bodyTicketId;
        if (ticketId) {
            // If ticket ID exists, add the email to the existing ticket
            try {
                yield (0, db_1.default)();
                const existingTicket = yield ticket_1.default.findById(ticketId);
                if (existingTicket) {
                    // Create a new email entry
                    const newEmail = {
                        id: emailData.email.id || emailData.emailId,
                        weblink: emailData.email.webLink,
                        preview: emailData.email.bodyPreview || "",
                        emailType: emailData.email.emailType || "received",
                        from: {
                            name: ((_a = emailData.email.from) === null || _a === void 0 ? void 0 : _a.name) || "",
                            email: ((_b = emailData.email.from) === null || _b === void 0 ? void 0 : _b.email) || "",
                        },
                        to: emailData.email.to || [],
                        timestamp: new Date(),
                    };
                    // Update email counts and timestamps based on email type
                    if (newEmail.emailType === "received") {
                        existingTicket.inbox += 1;
                        existingTicket.lastMailTimeReceived = new Date(emailData.email.receivedDateTime || new Date());
                    }
                    else if (newEmail.emailType === "sent") {
                        existingTicket.sent += 1;
                        existingTicket.lastMailTimeSent = new Date(emailData.email.receivedDateTime || new Date());
                    }
                    if (existingTicket.email && existingTicket.email.length > 0) {
                        // Get all emails sorted by timestamp
                        const sortedEmails = [...existingTicket.email, newEmail].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                        let totalWaitTime = 0;
                        let waitTimeCount = 0;
                        // Calculate time differences between received and subsequent sent emails
                        for (let i = 0; i < sortedEmails.length - 1; i++) {
                            const currentEmail = sortedEmails[i];
                            const nextEmail = sortedEmails[i + 1];
                            // If current is received and next is sent, calculate waiting time
                            if (currentEmail.emailType === "received" &&
                                nextEmail.emailType === "sent") {
                                const receivedTime = new Date(currentEmail.timestamp).getTime();
                                const sentTime = new Date(nextEmail.timestamp).getTime();
                                const waitTime = sentTime - receivedTime; // in milliseconds
                                if (waitTime > 0) {
                                    totalWaitTime += waitTime;
                                    waitTimeCount++;
                                }
                            }
                        }
                        if (waitTimeCount > 0) {
                            const avgWaitTimeMinutes = Math.round(totalWaitTime / waitTimeCount / (1000 * 60));
                            existingTicket.waitingTime = avgWaitTimeMinutes;
                        }
                    }
                    // Add the new email to the ticket's email array
                    existingTicket.email.push(newEmail);
                    // Save the updated ticket
                    const updatedTicket = yield existingTicket.save();
                    return {
                        ticketResult: updatedTicket,
                        existingTicketUpdated: true,
                        ticketId: ticketId,
                        success: true,
                    };
                }
            }
            catch (error) {
                console.error("Error updating existing ticket:", error);
            }
        }
        // If no ticket ID found or ticket not found, proceed with normal flow
        const aiData = yield (0, process_email_transform_1.transformEmailData)(emailData.email);
        const analysis = yield (0, gemini_1.analyzeEmail)(aiData);
        let ticketResult = null;
        if (analysis.isTravelEmail) {
            try {
                const ticket = yield (0, create_ticket_1.createTicketFromEmail)(analysis, emailData.email);
            }
            catch (error) {
                console.error("Error creating ticket from email:", error);
                throw new Error(`Ticket creation failed: ${error}`);
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

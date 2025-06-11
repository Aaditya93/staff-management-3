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
exports.processAllUserEmails = void 0;
const User_1 = require("./db/User");
const fetch_emails_1 = require("./fetch-emails");
const ticket_id_1 = require("./ticket-id");
const process_email_ai_1 = require("./process-email-ai"); // Import the processEmailForAI function
const sqs_1 = require("./sqs/sqs");
function processAllUserEmails() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get all users
            const users = yield (0, User_1.getAllUsersWithUpdate)();
            // Process each user
            for (const user of users) {
                // Skip if user has no accounts
                if (!user.accounts || user.accounts.length === 0) {
                    continue;
                }
                // Process each account of the user
                for (const account of user.accounts) {
                    try {
                        const result = yield (0, fetch_emails_1.fetchAllEmails)(account.accessToken, account.refreshToken, account.expiresAt, user._id.toString(), account.email, {
                            // Convert to ISO string if it's a Date object or non-ISO string
                            lastSyncTime: account.emailUpdatedAt
                                ? typeof account.emailUpdatedAt === "string" &&
                                    account.emailUpdatedAt.includes("T")
                                    ? account.emailUpdatedAt
                                    : new Date(account.emailUpdatedAt).toISOString()
                                : undefined,
                        });
                        if (result.error) {
                            console.error(`Error fetching email for ${account.email}:`, result.error);
                        }
                        else {
                            if (result.emails && result.emails.length > 0) {
                                const nonBlockedEmails = result.emails.filter((email) => {
                                    var _a, _b;
                                    // Check if sender email is in the block list
                                    const senderEmail = (_b = (_a = email.from) === null || _a === void 0 ? void 0 : _a.emailAddress) === null || _b === void 0 ? void 0 : _b.address;
                                    if (senderEmail &&
                                        user.blockEmails &&
                                        user.blockEmails.length > 0) {
                                        const isBlocked = user.blockEmails.some((blockedEmail) => blockedEmail.toLowerCase() === senderEmail);
                                        if (isBlocked) {
                                            return false;
                                        }
                                    }
                                    return true;
                                });
                                // Process emails through AI processing before forwarding
                                const processedEmails = nonBlockedEmails.map((email) => (0, process_email_ai_1.processEmailForAI)(user._id.toString(), user.name, account.email, email));
                                // Filter out any emails that returned with errors
                                const validProcessedEmails = processedEmails.filter((email) => !("error" in email));
                                // Process each email individually
                                const forwardResults = yield Promise.all(validProcessedEmails.map((email) => __awaiter(this, void 0, void 0, function* () {
                                    try {
                                        // Ensure email is properly formatted for processIncomingEmail
                                        const emailData = {
                                            userId: user._id.toString(),
                                            emailId: account.email,
                                            email: email,
                                        };
                                        if ("emailType" in email && email.emailType === "sent") {
                                            // Extract ticket ID from subject and body
                                            const ticketIdFromSubject = (0, ticket_id_1.extractTicketId)(email.subject || "");
                                            const ticketIdFromBody = (0, ticket_id_1.extractTicketId)(email.bodyText || "");
                                            const hasTicketId = !!(ticketIdFromSubject || ticketIdFromBody);
                                            // Skip if no ticket ID found in sent emails
                                            if (!hasTicketId) {
                                                return {
                                                    success: true,
                                                    emailId: "id" in email ? email.id : "unknown",
                                                    skipped: true,
                                                    reason: "Sent email without ticket ID",
                                                };
                                            }
                                        }
                                        if ("subject" in email &&
                                            "bodyText" in email &&
                                            (0, ticket_id_1.isConfirmationEmail)(email.subject || "", email.bodyText || "")) {
                                            return {
                                                success: true,
                                                emailId: "id" in email ? email.id : "unknown",
                                                skipped: true,
                                                reason: "Confirmation email",
                                            };
                                        }
                                        const result = yield (0, sqs_1.sendMessageToQueue)(emailData);
                                        // Forward the email to the API
                                        return {
                                            success: true,
                                            emailId: "id" in email ? email.id : "unknown",
                                            result,
                                        };
                                    }
                                    catch (error) {
                                        console.error(`Failed to process email ID ${"id" in email ? email.id : "unknown"}:`, error);
                                        return {
                                            success: false,
                                            emailId: "id" in email ? email.id : "unknown",
                                            error: error instanceof Error ? error.message : String(error),
                                        };
                                    }
                                })));
                            }
                        }
                    }
                    catch (error) {
                        console.error(`Exception while fetching email for ${account.email}:`, error);
                    }
                }
            }
        }
        catch (error) {
            console.error("Error in main process:", error);
        }
    });
}
exports.processAllUserEmails = processAllUserEmails;

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
exports.processAllUserEmails = exports.forwardEmailsToAPI = void 0;
const User_1 = require("./db/User");
const fetch_emails_1 = require("./fetch-emails");
const axios_1 = __importDefault(require("axios"));
// Configure email receiver API URL
const EMAIL_RECEIVER_API = process.env.EMAIL_RECEIVER_API || "http://localhost:3001/api/email/receive";
/**
 * Forwards fetched emails to the email receiver API
 */
function forwardEmailsToAPI(emails, userId, accountEmail) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!emails || emails.length === 0) {
                return { success: true, count: 0 };
            }
            // Process each email and send to API
            const results = yield Promise.all(emails.map((email) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const response = yield axios_1.default.post(EMAIL_RECEIVER_API, {
                        userId: userId,
                        emailId: accountEmail,
                        email: email,
                    });
                    return { success: true, emailId: email.id, status: response.status };
                }
                catch (error) {
                    console.error(`Failed to forward email ID ${email.id || "unknown"} to API:`, error);
                    return {
                        success: false,
                        emailId: email.id,
                        error: error instanceof Error ? error.message : String(error),
                    };
                }
            })));
            const successCount = results.filter((r) => r.success).length;
            return {
                success: true,
                count: successCount,
                totalProcessed: emails.length,
            };
        }
        catch (error) {
            console.error(`Error in email forwarding for ${accountEmail}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    });
}
exports.forwardEmailsToAPI = forwardEmailsToAPI;
function processAllUserEmails() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get all users
            const users = yield (0, User_1.getAllUsers)();
            // Process each user
            for (const user of users) {
                // Skip if user has no accounts
                if (!user.accounts || user.accounts.length === 0) {
                    continue;
                }
                // Process each account of the user
                for (const account of user.accounts) {
                    try {
                        const result = yield (0, fetch_emails_1.fetchAllEmails)(account.accessToken, account.refreshToken, account.expiresAt, user._id.toString(), account.email);
                        // Update user timestamp after fetching emails
                        const updateUserTimestamp = yield (0, User_1.updateUserEmailTimestamp)(user._id, account.email);
                        if (result.error) {
                            console.error(`Error fetching email for ${account.email}:`, result.error);
                        }
                        else {
                            // Forward fetched emails to the email receiver API
                            if (result.emails && result.emails.length > 0) {
                                const forwardResult = yield forwardEmailsToAPI(result.emails, user._id.toString(), account.email);
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

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
const process_email_ai_1 = require("./process-email-ai"); // Import the processEmailForAI function
const receive_email_1 = require("./receive-email");
function processAllUserEmails() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get all users
            const users = yield (0, User_1.getAllUsers)();
            console.log(`Found ${users.length} users`);
            // Process each user
            for (const user of users) {
                console.log(`Processing user: ${user.name} (${user.email})`);
                // Skip if user has no accounts
                if (!user.accounts || user.accounts.length === 0) {
                    console.log(`No accounts found for user: ${user.name}`);
                    continue;
                }
                // Process each account of the user
                for (const account of user.accounts) {
                    console.log(`Processing account: ${account.email} (${account.provider})`);
                    try {
                        console.log(`Attempting to fetch email with ID: ${account.email}`);
                        console.log("usertid", account.emailUpdatedAt);
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
                            // await updateUserEmailTimestamp(
                            //   (user._id as any).toString(),
                            //   account.email
                            // );
                            if (result.emails && result.emails.length > 0) {
                                // Process emails through AI processing before forwarding
                                const processedEmails = result.emails.map((email) => (0, process_email_ai_1.processEmailForAI)(user._id.toString(), user.name, account.email, email));
                                console.log(`Processed emails:`, processedEmails);
                                // Filter out any emails that returned with errors
                                const validProcessedEmails = processedEmails.filter((email) => !("error" in email));
                                console.log(`Processed ${validProcessedEmails.length} emails for AI analysis`);
                                const forwardResult = yield (0, receive_email_1.processIncomingEmail)({
                                    userId: user._id.toString(),
                                    emailId: account.email,
                                    email: validProcessedEmails,
                                });
                                console.log(`Email forwarding results for ${account.email}:`, forwardResult);
                            }
                            else {
                                console.log(`No new emails to forward for ${account.email}`);
                            }
                            console.log(`Successfully fetched email for ${account.email}:`);
                        }
                    }
                    catch (error) {
                        console.error(`Exception while fetching email for ${account.email}:`, error);
                    }
                }
            }
            console.log("Finished processing all users and accounts");
        }
        catch (error) {
            console.error("Error in main process:", error);
        }
    });
}
exports.processAllUserEmails = processAllUserEmails;

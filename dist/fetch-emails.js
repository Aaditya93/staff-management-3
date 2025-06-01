"use strict";
"use server";
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
exports.fetchAllEmails = exports.fetchEmailById = void 0;
const token_1 = require(".//token");
function fetchEmailById(emailId, accessToken, refreshToken, expiresAt, userId) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Input validation
            if (!emailId || typeof emailId !== "string") {
                return { error: "Invalid email ID: ID must be a non-empty string" };
            }
            // Clean the emailId - remove any whitespace and ensure proper encoding
            const cleanEmailId = emailId.trim();
            // Additional validation for empty ID after trimming
            if (!cleanEmailId) {
                return { error: "Invalid email ID: ID cannot be empty" };
            }
            // Properly encode the ID for URL
            const encodedEmailId = encodeURIComponent(cleanEmailId);
            // Build the Graph API query with proper parameters
            const graphUrl = `https://graph.microsoft.com/v1.0/me/messages/${encodedEmailId}`;
            // Add query parameters for additional data
            const queryParams = [
                "$select=id,subject,body,receivedDateTime,sentDateTime,sender,isRead,hasAttachments,toRecipients,ccRecipients,bccRecipients",
                "$expand=attachments($select=id,name,contentType,size,isInline)",
            ];
            const fullUrl = `${graphUrl}?${queryParams.join("&")}`;
            const newToken = yield (0, token_1.getValidAccessToken)(accessToken, refreshToken, expiresAt, emailId, userId);
            const response = yield fetch(fullUrl, {
                headers: {
                    Authorization: `Bearer ${newToken}`,
                    "Content-Type": "application/json",
                    ConsistencyLevel: "eventual",
                },
            });
            if (!response.ok) {
                // Handle error responses more gracefully
                let errorMessage = `Failed to fetch email: ${response.status} ${response.statusText}`;
                try {
                    const contentType = response.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                        const text = yield response.text();
                        if (text && text.trim()) {
                            const errorData = JSON.parse(text);
                            console.error("Graph API error details:", errorData);
                            if ((_a = errorData.error) === null || _a === void 0 ? void 0 : _a.message) {
                                errorMessage = `Graph API error: ${errorData.error.message}`;
                                // Handle specific error for malformed ID
                                if (((_b = errorData.error) === null || _b === void 0 ? void 0 : _b.code) === "ErrorInvalidIdMalformed") {
                                    errorMessage = "The provided email ID format is invalid";
                                }
                            }
                        }
                    }
                }
                catch (parseError) {
                    console.error("Error parsing error response:", parseError);
                }
                return { error: errorMessage };
            }
            const email = yield response.json();
            return { email };
        }
        catch (error) {
            console.error("Error fetching email:", error);
            return {
                error: error instanceof Error ? error.message : "Unknown error occurred",
            };
        }
    });
}
exports.fetchEmailById = fetchEmailById;
/**
 * Fetches all emails across folders in a single API call
 */
function fetchAllEmails(accessToken, refreshToken, expiresAt, userId, emailId, options = {}) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Set default options
            const { pageSize = 100, // Maximum allowed by Microsoft Graph API
            filterUnread = false, searchQuery = "", lastSyncTime = "", // Default to empty string (no timestamp filtering)
             } = options;
            // Get a valid access token
            const newToken = yield (0, token_1.getValidAccessToken)(accessToken, refreshToken, expiresAt, emailId, userId);
            if (!newToken) {
                return {
                    emails: [],
                    error: "Authentication failed. Please sign in again.",
                };
            }
            // Build the Graph API query - using search instead of folder-specific queries
            const graphUrl = "https://graph.microsoft.com/v1.0/me/messages";
            // Add query parameters
            const queryParams = [
                `$top=${pageSize}`,
                "$select=id,subject,body,bodyPreview,receivedDateTime,sentDateTime,sender,from,isRead,toRecipients,hasAttachments,parentFolderId,ccRecipients,bccRecipients,categories,conversationId,importance,flag,webLink,replyTo",
                "$orderby=receivedDateTime desc",
            ];
            // Build filter conditions
            let filterConditions = [];
            // Add filter for unread messages if requested
            if (filterUnread) {
                filterConditions.push("isRead eq false");
            }
            // Add timestamp filter if provided
            if (lastSyncTime) {
                // Filter for emails that were either received or sent after the last sync time
                filterConditions.push(`(receivedDateTime ge ${lastSyncTime} or sentDateTime ge ${lastSyncTime})`);
            }
            // Combine filter conditions if any exist
            if (filterConditions.length > 0) {
                queryParams.push(`$filter=${filterConditions.join(" and ")}`);
            }
            // Add search query if provided
            if (searchQuery) {
                queryParams.push(`$search="${encodeURIComponent(searchQuery)}"`);
            }
            const fullUrl = `${graphUrl}?${queryParams.join("&")}`;
            // Make request to Microsoft Graph API
            const response = yield fetch(fullUrl, {
                headers: {
                    Authorization: `Bearer ${newToken}`,
                    "Content-Type": "application/json",
                    ConsistencyLevel: "eventual", // Required for search queries
                },
            });
            // Handle error responses
            if (!response.ok) {
                // Process error response
                let errorMessage = `Failed to fetch emails: ${response.status} ${response.statusText}`;
                try {
                    const contentType = response.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                        const text = yield response.text();
                        if (text && text.trim()) {
                            const errorData = JSON.parse(text);
                            console.error("Graph API error details:", errorData);
                            if ((_a = errorData.error) === null || _a === void 0 ? void 0 : _a.message) {
                                errorMessage = `Graph API error: ${errorData.error.message}`;
                            }
                        }
                    }
                }
                catch (parseError) {
                    console.error("Error parsing error response:", parseError);
                }
                return {
                    emails: [],
                    error: errorMessage,
                };
            }
            // Process successful response
            const data = yield response.json();
            // Extract the emails
            const emails = data.value;
            // You can get additional pages if needed with @odata.nextLink
            // This is the basic implementation without pagination handling
            return {
                emails,
            };
        }
        catch (error) {
            console.error("Error fetching all emails:", error);
            return {
                emails: [],
                error: error instanceof Error ? error.message : "Unknown error occurred",
            };
        }
    });
}
exports.fetchAllEmails = fetchAllEmails;

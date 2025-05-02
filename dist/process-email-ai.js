"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processEmailForAI = void 0;
/**
 * Processes email data to create a simplified JSON structure for AI processing
 * @param email The raw email object
 * @returns A simplified JSON object with essential email data
 */
// ...existing code...
/**
 * Processes email data to create a simplified JSON structure for AI processing
 * @param email The raw email object
 * @returns A simplified JSON object with essential email data
 */
/**
 * Processes email data to create a simplified JSON structure for AI processing
 * @param email The raw email object
 * @returns A simplified JSON object with essential email data
 */
/**
 * Processes email data to create a simplified JSON structure for AI processing
 * @param userId The ID of the user processing this email
 * @param emailId Optional email ID (can override the ID in the email object)
 * @param email The raw email object
 * @returns A simplified JSON object with essential email data
 */
function processEmailForAI(userId, userName, emailId, email) {
    var _a, _b, _c, _d, _e, _f, _g;
    try {
        let isSent = false;
        if (((_b = (_a = email.sender) === null || _a === void 0 ? void 0 : _a.emailAddress) === null || _b === void 0 ? void 0 : _b.address) === emailId) {
            isSent = true;
        }
        // Extract body text without HTML
        let bodyText = "";
        if ((_c = email.body) === null || _c === void 0 ? void 0 : _c.content) {
            if (email.body.contentType === "html") {
                bodyText = cleanHtmlContent(email.body.content);
            }
            else {
                bodyText = email.body.content;
            }
        }
        // Single timestamp for all emails (either received or sent time)
        const timestamp = isSent
            ? email.sentDateTime || new Date().toISOString()
            : email.receivedDateTime || new Date().toISOString();
        // Base structure for all emails
        const processedEmail = {
            id: email.id || "",
            emailId: emailId || "",
            userName: userName,
            userId: userId,
            subject: email.subject || "No Subject",
            bodyText: bodyText || "No Content",
            receivedDateTime: timestamp,
            importance: email.importance || "normal",
            hasAttachments: !!email.hasAttachments,
            webLink: email.webLink || "",
            categories: email.categories || [],
            emailType: isSent ? "sent" : "received",
            from: {
                name: "",
                email: "",
            },
            to: [],
        };
        // Rest of the function remains the same
        if (isSent) {
            // For sent emails:
            // - 'from' is our email address (sender's data)
            // - 'to' is the toRecipients
            processedEmail.from = {
                name: userName,
                email: emailId || "",
            };
            processedEmail.to = Array.isArray(email.toRecipients)
                ? email.toRecipients.map((recipient) => {
                    var _a, _b;
                    return ({
                        name: ((_a = recipient.emailAddress) === null || _a === void 0 ? void 0 : _a.name) || "Unknown",
                        email: ((_b = recipient.emailAddress) === null || _b === void 0 ? void 0 : _b.address) || "unknown",
                    });
                })
                : [];
        }
        else {
            // For received emails:
            // - 'from' is the sender's data
            // - 'to' is toRecipients (which should include our email)
            processedEmail.from = {
                name: ((_e = (_d = email.sender) === null || _d === void 0 ? void 0 : _d.emailAddress) === null || _e === void 0 ? void 0 : _e.name) || "Unknown",
                email: ((_g = (_f = email.sender) === null || _f === void 0 ? void 0 : _f.emailAddress) === null || _g === void 0 ? void 0 : _g.address) || "unknown",
            };
            // Use actual toRecipients instead of just "Me"
            processedEmail.to = [
                {
                    name: userName,
                    email: emailId || "unknown",
                },
            ];
        }
        return processedEmail;
    }
    catch (error) {
        console.error("Error processing email for AI:", error);
        return {
            error: "Failed to process email",
            message: error.message,
        };
    }
}
exports.processEmailForAI = processEmailForAI;
/**
 * Cleans HTML content by removing tags, CSS, and extracting meaningful text
 * @param htmlContent The HTML content to clean
 * @returns Clean text content
 */
function cleanHtmlContent(htmlContent) {
    try {
        // First remove all CSS styles (including media queries)
        let cleanedContent = htmlContent
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "") // Remove style tags and their content
            .replace(/<!\-\-[\s\S]*?\-\->/g, "") // Remove comments
            .replace(/<!--\[if[^>]*>[\s\S]*?<!\[endif\]-->/g, ""); // Remove conditional comments
        // Remove media query remnants that might remain
        cleanedContent = cleanedContent.replace(/@media[^{]*{[\s\S]*?}/g, "");
        // Replace table structures with simplified content
        cleanedContent = cleanedContent
            .replace(/<table[^>]*>/gi, "\n") // Start of table
            .replace(/<\/table>/gi, "\n") // End of table
            .replace(/<tr[^>]*>/gi, "\n") // Start of row
            .replace(/<\/tr>/gi, "") // End of row
            .replace(/<td[^>]*>/gi, " ") // Start of cell
            .replace(/<\/td>/gi, " ") // End of cell
            .replace(/<th[^>]*>/gi, " ") // Start of header cell
            .replace(/<\/th>/gi, " "); // End of header cell
        // Handle other common HTML elements
        cleanedContent = cleanedContent
            .replace(/<br\s*\/?>/gi, "\n") // Line breaks to newlines
            .replace(/<li[^>]*>/gi, "\n- ") // List items as bullet points
            .replace(/<\/li>/gi, "")
            .replace(/<ul[^>]*>|<\/ul>|<ol[^>]*>|<\/ol>/gi, "\n") // List containers
            .replace(/<div[^>]*>/gi, "\n") // Divs as paragraph breaks
            .replace(/<\/div>/gi, "\n")
            .replace(/<p[^>]*>/gi, "\n") // Paragraphs
            .replace(/<\/p>/gi, "\n")
            .replace(/<[^>]*>/g, ""); // Remove all remaining tags
        // Clean up excessive whitespace
        cleanedContent = cleanedContent
            .replace(/&nbsp;/g, " ") // Replace &nbsp; with spaces
            .replace(/\n\s+\n/g, "\n\n") // Remove lines with only whitespace
            .replace(/\n{3,}/g, "\n\n") // Limit to max 2 consecutive newlines
            .replace(/\s{2,}/g, " ") // Replace multiple spaces with single space
            .trim(); // Remove leading/trailing whitespace
        return cleanedContent;
    }
    catch (error) {
        console.error("Error cleaning HTML content:", error);
        // Return a simple stripped version as fallback
        return htmlContent
            .replace(/<[^>]*>?/gm, "") // Remove HTML tags
            .replace(/\s+/g, " ") // Normalize whitespace
            .trim();
    }
}

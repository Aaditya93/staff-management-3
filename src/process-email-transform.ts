// Define interfaces for email objects
interface EmailAddress {
  name?: string;
  address?: string;
}

interface Recipient {
  emailAddress?: EmailAddress;
}

interface EmailBody {
  contentType?: string;
  content?: string;
}

interface EmailObject {
  id?: string;
  subject?: string;
  body?: EmailBody;
  receivedDateTime?: string;
  sentDateTime?: string;
  importance?: string;
  webLink?: string;
  hasAttachments?: boolean;
  categories?: string[];
  sender?: {
    emailAddress?: EmailAddress;
  };
  from?: {
    emailAddress?: EmailAddress;
  };
  toRecipients?: Recipient[];
  ccRecipients?: Recipient[];
  bccRecipients?: Recipient[];
}

interface ProcessedEmail {
  id: string;
  subject: string;
  bodyText: string;
  webLink: string;
  receivedDateTime: string;
  importance: string;
  hasAttachments: boolean;
  categories: string[];
  emailType: "sent" | "received";
  userId: string; // Add userId to the processed email
  userName: string; // Add userName to the processed email
  emailId: string; // Corrected EmailId to emailId for consistency
  from: {
    name: string;
    email: string;
  };
  to: {
    name: string;
    email: string;
  }[];
  cc?: {
    name: string;
    email: string;
  }[];
  bcc?: {
    name: string;
    email: string;
  }[];
  [key: string]: any; // Allow additional properties
}

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
function processEmailForAI(
  userId: string,
  userName: string,
  emailId: string | undefined,
  email: EmailObject
): ProcessedEmail | { error: string; message: string } {
  try {
    let isSent = false;

    if (email.sender?.emailAddress?.address === emailId) {
      isSent = true;
    }
    // If sender's email is found in toRecipients, it's a received email
    // else if (
    //   Array.isArray(email.toRecipients) &&
    //   email.toRecipients.some(
    //     (recipient) =>
    //       recipient.emailAddress?.address ===
    //         email.sender?.emailAddress?.address ||
    //       recipient.emailAddress?.address === email.from?.emailAddress?.address
    //   )
    // ) {
    //   isSent = false;
    // }
    // Fallback to previous logic
    // else if (
    //   Array.isArray(email.toRecipients) &&
    //   email.toRecipients.length > 0
    // ) {
    //   // Check if any of the toRecipients is our email address
    //   const isRecipient = email.toRecipients.some(
    //     (recipient) => recipient.emailAddress?.address === userEmail
    //   );

    //   // If we're not in toRecipients, likely we sent this email
    //   isSent = !isRecipient;
    // }

    // Extract body text without HTML
    let bodyText = "";
    if (email.body?.content) {
      if (email.body.contentType === "html") {
        bodyText = cleanHtmlContent(email.body.content);
      } else {
        bodyText = email.body.content;
      }
    }

    // Single timestamp for all emails (either received or sent time)
    const timestamp = isSent
      ? email.sentDateTime || new Date().toISOString()
      : email.receivedDateTime || new Date().toISOString();

    // Base structure for all emails
    const processedEmail: ProcessedEmail = {
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
        name: "Me",
        email: emailId || "",
      };

      processedEmail.to = Array.isArray(email.toRecipients)
        ? email.toRecipients.map((recipient: Recipient) => ({
            name: recipient.emailAddress?.name || "Unknown",
            email: recipient.emailAddress?.address || "",
          }))
        : [];
    } else {
      // For received emails:
      // - 'from' is the sender's data
      // - 'to' is toRecipients (which should include our email)
      processedEmail.from = {
        name: email.sender?.emailAddress?.name || "Unknown",
        email: email.sender?.emailAddress?.address || "unknown",
      };

      // Use actual toRecipients instead of just "Me"
      processedEmail.to = [
        {
          name: "Me",
          email: emailId || "unknown",
        },
      ];
    }

    return processedEmail;
  } catch (error) {
    console.error("Error processing email for AI:", error);
    return {
      error: "Failed to process email",
      message: (error as Error).message,
    };
  }
}
/**
 * Cleans HTML content by removing tags, CSS, and extracting meaningful text
 * @param htmlContent The HTML content to clean
 * @returns Clean text content
 */
function cleanHtmlContent(htmlContent: string): string {
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
  } catch (error) {
    console.error("Error cleaning HTML content:", error);
    // Return a simple stripped version as fallback
    return htmlContent
      .replace(/<[^>]*>?/gm, "") // Remove HTML tags
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
  }
}

/**
 * Transforms a raw email object into a simplified format with selected fields
 * @param rawEmail - The original email object from the email provider
 * @returns A simplified email object with only essential fields
 */
export function transformEmailData(rawEmail: any) {
  // Extract only the required fields
  const simplifiedEmail = {
    bodyText: rawEmail.bodyText || "",
    emailType: rawEmail.emailType || "unknown",
    from: rawEmail.from || { name: "", email: "" },
    to: rawEmail.to || [],
    subject: rawEmail.subject || "",
  };

  return simplifiedEmail;
}

// Example usage
// const rawEmail = {received email object};
// const simplifiedEmail = transformEmailData(rawEmail);

export { processEmailForAI, EmailObject, ProcessedEmail };

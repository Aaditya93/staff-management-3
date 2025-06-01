/**
 * Extracts a 24-character hexadecimal ticket ID from email content
 * Format example: 6833e6a84947837d59300ab8
 *
 * @param emailContent The email body or subject to search
 * @returns The extracted ticket ID or null if not found
 */
export function extractTicketId(emailContent: string): string | null {
  if (!emailContent) return null;

  // Patterns to find ticket ID with various prefixes
  const patterns = [
    // Match "Ticket ID: 6833e6a84947837d59300ab8" (with colon)
    /Ticket\s*ID\s*:\s*([0-9a-f]{24})(?!\w)/i,

    // Match "Ticket ID 6833e6a84947837d59300ab8" (without colon)
    /Ticket\s*ID\s+([0-9a-f]{24})(?!\w)/i,

    // Match "Ticket: 6833e6a84947837d59300ab8"
    /Ticket\s*:\s*([0-9a-f]{24})(?!\w)/i,

    // Match "TicketID: 6833e6a84947837d59300ab8"
    /TicketID\s*:\s*([0-9a-f]{24})(?!\w)/i,

    // Match "Ref ID: 6833e6a84947837d59300ab8"
    /Ref(?:erence)?\s*ID\s*:\s*([0-9a-f]{24})(?!\w)/i,

    // Match "ID: 6833e6a84947837d59300ab8" (more general)
    /ID\s*:\s*([0-9a-f]{24})(?!\w)/i,

    // Match standalone 24-char hex as last resort
    // (only if preceded by space or line start to reduce false positives)
    /(?:^|\s)([0-9a-f]{24})(?!\w)/,
  ];

  // Try each pattern until we find a match
  for (const pattern of patterns) {
    const match = emailContent.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Usage example:
 *
 * import { extractTicketId } from './utils/extract-ticket-id';
 *
 * const emailBody = "Thank you for your inquiry. Your Ticket ID: 6833e6a84947837d59300ab8";
 * const ticketId = extractTicketId(emailBody);
 * console.log(ticketId); // "6833e6a84947837d59300ab8"
 */

/**
 * Determines if an email is a confirmation email from Victoria Tours
 *
 * @param emailSubject The subject line of the email
 * @param emailBody The body content of the email
 * @returns Boolean indicating if it's a confirmation email
 */
export function isConfirmationEmail(
  emailSubject: string,
  emailBody: string
): boolean {
  if (!emailSubject && !emailBody) {
    return false;
  }

  // Convert inputs to strings and lowercase for case-insensitive matching
  const subject = String(emailSubject || "").toLowerCase();
  const body = String(emailBody || "").toLowerCase();

  // Check for specific confirmation phrases in subject
  const subjectConfirmationPhrases = [
    "thank you for your inquiry",
    "confirmation",
    "confirmed",
    "booking confirmed",
    "reservation confirmed",
    "itinerary confirmed",
    "travel request received",
    "we have received your",
  ];

  // Check for specific confirmation phrases in body
  const bodyConfirmationPhrases = [
    "we are pleased to confirm",
    "thank you for your inquiry",
    "we have received your travel request",
    "your ticket details",
    "your booking is confirmed",
    "your reservation is confirmed",
    "your itinerary is confirmed",
    "has started working on your request",
  ];

  // Check if body contains ticket ID and confirmation structure
  const hasTicketId = /ticket\s*id\s*:/i.test(body);
  const hasDestination = /destination\s*:/i.test(body);
  const hasDates = /(?:arrival|departure)\s*date\s*:/i.test(body);
  const hasPassengers = /(?:number of passengers|travelers|guests)\s*:/i.test(
    body
  );

  // Check if Victoria Tours is mentioned
  const isVictoriaTours = body.includes("victoria tours");

  // Confirmation indicators in subject
  const subjectIndicates = subjectConfirmationPhrases.some((phrase) =>
    subject.includes(phrase)
  );

  // Confirmation indicators in body
  const bodyIndicates = bodyConfirmationPhrases.some((phrase) =>
    body.includes(phrase)
  );

  // Look for structural elements of a confirmation email
  const hasConfirmationStructure =
    hasTicketId &&
    (hasDestination || hasDates || hasPassengers) &&
    isVictoriaTours;

  // Determine if it's a confirmation email based on multiple factors
  return (subjectIndicates || bodyIndicates) && hasConfirmationStructure;
}

/**
 * Usage example:
 *
 * import { isConfirmationEmail } from './email-classification';
 *
 * const subject = "Thank You for Your Inquiry!";
 * const body = "We are pleased to confirm that we have received your travel request...";
 * const isConfirmation = isConfirmationEmail(subject, body);
 * console.log(isConfirmation); // true
 */

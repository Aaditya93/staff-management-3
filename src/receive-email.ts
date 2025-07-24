import { analyzeEmail } from "./gemini-ai/gemini";
import { createTicketFromEmail } from "./db/create-ticket";
import { transformEmailData } from "./process-email-transform";
import { extractTicketId } from "./ticket-id";
import Ticket from "./db/ticket";
import dbConnect from "./db/db";

/**
 * Processes an incoming email with AI analysis and ticket handling
 *
 * @param email - The raw email data
 * @returns Result object with analysis and ticket information
 */
export async function processIncomingEmail(emailData: any) {
  // Check if email contains an existing ticket ID
  // Check if email contains an existing ticket ID - check both subject and body

  const subjectTicketId = emailData.email.subject
    ? extractTicketId(emailData.email.subject)
    : null;
  const bodyTicketId = emailData.email.bodyText
    ? extractTicketId(emailData.email.bodyText)
    : null;

  // Use subject ticket ID first if available, otherwise use body ticket ID
  const ticketId = subjectTicketId || bodyTicketId;

  if (ticketId) {
    // If ticket ID exists, add the email to the existing ticket
    try {
      await dbConnect();
      const existingTicket = await Ticket.findById(ticketId);

      if (existingTicket) {
        // Create a new email entry
        const newEmail = {
          id: emailData.email.id || emailData.emailId,
          weblink: emailData.email.webLink,
          preview: emailData.email.bodyPreview || "",
          emailType: emailData.email.emailType || "received",
          from: {
            name: emailData.email.from?.name || "",
            email: emailData.email.from?.email || "",
          },
          to: emailData.email.to || [],
          timestamp: new Date(),
        };

        // Update email counts and timestamps based on email type
        if (newEmail.emailType === "received") {
          existingTicket.inbox += 1;
          existingTicket.lastMailTimeReceived = new Date(
            emailData.email.receivedDateTime || new Date()
          );
        } else if (newEmail.emailType === "sent") {
          existingTicket.sent += 1;
          existingTicket.lastMailTimeSent = new Date(
            emailData.email.receivedDateTime || new Date()
          );
        }

        if (existingTicket.email && existingTicket.email.length > 0) {
          // Get all emails sorted by timestamp
          const sortedEmails = [...existingTicket.email, newEmail].sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );

          let totalWaitTime = 0;
          let waitTimeCount = 0;

          // Calculate time differences between received and subsequent sent emails
          for (let i = 0; i < sortedEmails.length - 1; i++) {
            const currentEmail = sortedEmails[i];
            const nextEmail = sortedEmails[i + 1];

            // If current is received and next is sent, calculate waiting time
            if (
              currentEmail.emailType === "received" &&
              nextEmail.emailType === "sent"
            ) {
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
            const avgWaitTimeMinutes = Math.round(
              totalWaitTime / waitTimeCount / (1000 * 60)
            );
            existingTicket.waitingTime = avgWaitTimeMinutes;
          }
        }

        // Add the new email to the ticket's email array
        existingTicket.email.push(newEmail);

        // Save the updated ticket
        const updatedTicket = await existingTicket.save();

        return {
          ticketResult: updatedTicket,
          existingTicketUpdated: true,
          ticketId: ticketId,
          success: true,
        };
      }
    } catch (error) {
      console.error("Error updating existing ticket:", error);
    }
  }

  // If no ticket ID found or ticket not found, proceed with normal flow
  const aiData = await transformEmailData(emailData.email);
  const analysis = await analyzeEmail(aiData);

  let ticketResult = null;

  if (analysis.isTravelEmail) {
    try {
      const ticket = await createTicketFromEmail(analysis, emailData.email); 
    } catch (error) {

      throw new Error(`Ticket processing failed: ${error}`);
    }
  }

  return {
    analysis,
    ticketResult,
    success: true,
  };
}

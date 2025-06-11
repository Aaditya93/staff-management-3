import {
  getAllUsers,
  getAllUsersWithUpdate,
  updateUserEmailTimestamp,
} from "./db/User";

import { fetchEmailById, fetchAllEmails } from "./fetch-emails";
import { forwardEmailsToAPI } from "./forward-email";
import { extractTicketId, isConfirmationEmail } from "./ticket-id";
import { processEmailForAI } from "./process-email-ai"; // Import the processEmailForAI function
import { processIncomingEmail } from "./receive-email";
import { sendMessageToQueue } from "./sqs/sqs";

export async function processAllUserEmails() {
  try {
    // Get all users
    const users = await getAllUsersWithUpdate();

    // Process each user
    for (const user of users) {
      // Skip if user has no accounts
      if (!user.accounts || user.accounts.length === 0) {
        continue;
      }

      // Process each account of the user
      for (const account of user.accounts) {
        try {
          const result = await fetchAllEmails(
            account.accessToken,
            account.refreshToken,
            account.expiresAt,
            (user._id as any).toString(),
            account.email,
            {
              // Convert to ISO string if it's a Date object or non-ISO string
              lastSyncTime: account.emailUpdatedAt
                ? typeof account.emailUpdatedAt === "string" &&
                  account.emailUpdatedAt.includes("T")
                  ? account.emailUpdatedAt
                  : new Date(account.emailUpdatedAt).toISOString()
                : undefined,
            }
          );

          if (result.error) {
            console.error(
              `Error fetching email for ${account.email}:`,
              result.error
            );
          } else {
            if (result.emails && result.emails.length > 0) {
              const nonBlockedEmails = result.emails.filter((email) => {
                // Check if sender email is in the block list
                const senderEmail = email.from?.emailAddress?.address;
                if (
                  senderEmail &&
                  user.blockEmails &&
                  user.blockEmails.length > 0
                ) {
                  const isBlocked: boolean = user.blockEmails.some(
                    (blockedEmail: string) =>
                      blockedEmail.toLowerCase() === senderEmail
                  );

                  if (isBlocked) {
                    return false;
                  }
                }
                return true;
              });

              // Process emails through AI processing before forwarding
              const processedEmails = nonBlockedEmails.map((email) =>
                processEmailForAI(
                  (user._id as any).toString(),
                  user.name,
                  account.email,
                  email
                )
              );

              // Filter out any emails that returned with errors
              const validProcessedEmails = processedEmails.filter(
                (email) => !("error" in email)
              );

              // Process each email individually
              const forwardResults = await Promise.all(
                validProcessedEmails.map(async (email) => {
                  try {
                    // Ensure email is properly formatted for processIncomingEmail
                    const emailData = {
                      userId: (user._id as any).toString(),
                      emailId: account.email,
                      email: email,
                    };

                    if ("emailType" in email && email.emailType === "sent") {
                      // Extract ticket ID from subject and body
                      const ticketIdFromSubject = extractTicketId(
                        email.subject || ""
                      );
                      const ticketIdFromBody = extractTicketId(
                        email.bodyText || ""
                      );
                      const hasTicketId = !!(
                        ticketIdFromSubject || ticketIdFromBody
                      );

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
                    if (
                      "subject" in email &&
                      "bodyText" in email &&
                      isConfirmationEmail(
                        email.subject || "",
                        email.bodyText || ""
                      )
                    ) {
                      return {
                        success: true,
                        emailId: "id" in email ? email.id : "unknown",
                        skipped: true,
                        reason: "Confirmation email",
                      };
                    }

                    const result = await sendMessageToQueue(emailData);

                    // Forward the email to the API

                    return {
                      success: true,
                      emailId: "id" in email ? email.id : "unknown",
                      result,
                    };
                  } catch (error) {
                    console.error(
                      `Failed to process email ID ${
                        "id" in email ? email.id : "unknown"
                      }:`,
                      error
                    );
                    return {
                      success: false,
                      emailId: "id" in email ? email.id : "unknown",
                      error:
                        error instanceof Error ? error.message : String(error),
                    };
                  }
                })
              );
            }
          }
        } catch (error) {
          console.error(
            `Exception while fetching email for ${account.email}:`,
            error
          );
        }
      }
    }
  } catch (error) {
    console.error("Error in main process:", error);
  }
}

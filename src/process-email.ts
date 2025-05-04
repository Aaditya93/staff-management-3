import { getAllUsers, updateUserEmailTimestamp } from "./db/User";

import { fetchEmailById, fetchAllEmails } from "./fetch-emails";
import { forwardEmailsToAPI } from "./forward-email";

import { processEmailForAI } from "./process-email-ai"; // Import the processEmailForAI function
import { processIncomingEmail } from "./receive-email";

export async function processAllUserEmails() {
  try {
    // Get all users
    const users = await getAllUsers();
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
        console.log(
          `Processing account: ${account.email} (${account.provider})`
        );

        try {
          console.log(`Attempting to fetch email with ID: ${account.email}`);
          console.log("usertid", account.emailUpdatedAt);
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
            await updateUserEmailTimestamp(
              (user._id as any).toString(),
              account.email
            );
            if (result.emails && result.emails.length > 0) {
              // Process emails through AI processing before forwarding
              const processedEmails = result.emails.map((email) =>
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

              console.log(
                `Processed ${validProcessedEmails.length} emails for AI analysis`
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

                    console.log(
                      "Processing email:",
                      "id" in email ? email.id : "unknown ID"
                    );
                    const result = await processIncomingEmail(emailData);

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

              console.log(
                `Email processing results for ${account.email}:`,
                forwardResults
              );
            } else {
              console.log(`No new emails to forward for ${account.email}`);
            }
            console.log(`Successfully fetched email for ${account.email}:`);
          }
        } catch (error) {
          console.error(
            `Exception while fetching email for ${account.email}:`,
            error
          );
        }
      }
    }

    console.log("Finished processing all users and accounts");
  } catch (error) {
    console.error("Error in main process:", error);
  }
}

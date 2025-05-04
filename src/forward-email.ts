import { getAllUsers, updateUserEmailTimestamp } from "./db/User";
import { fetchEmailById, fetchAllEmails } from "./fetch-emails";
import axios from "axios";

// Configure email receiver API URL
const EMAIL_RECEIVER_API =
  process.env.EMAIL_RECEIVER_API || "http://localhost:3001/api/email/receive";

/**
 * Forwards fetched emails to the email receiver API
 */
export async function forwardEmailsToAPI(
  emails: any[],
  userId: string,
  accountEmail: string
) {
  try {
    if (!emails || emails.length === 0) {
      return { success: true, count: 0 };
    }

    // Process each email and send to API
    const results = await Promise.all(
      emails.map(async (email) => {
        try {
          const response = await axios.post(EMAIL_RECEIVER_API, {
            userId: userId,
            emailId: accountEmail,
            email: email,
          });

          return { success: true, emailId: email.id, status: response.status };
        } catch (error) {
          console.error(
            `Failed to forward email ID ${email.id || "unknown"} to API:`,
            error
          );
          return {
            success: false,
            emailId: email.id,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );

    const successCount = results.filter((r) => r.success).length;

    return {
      success: true,
      count: successCount,
      totalProcessed: emails.length,
    };
  } catch (error) {
    console.error(`Error in email forwarding for ${accountEmail}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function processAllUserEmails() {
  try {
    // Get all users
    const users = await getAllUsers();

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
            account.email
          );

          // Update user timestamp after fetching emails
          const updateUserTimestamp = await updateUserEmailTimestamp(
            user._id as any,
            account.email
          );

          if (result.error) {
            console.error(
              `Error fetching email for ${account.email}:`,
              result.error
            );
          } else {
            // Forward fetched emails to the email receiver API
            if (result.emails && result.emails.length > 0) {
              const forwardResult = await forwardEmailsToAPI(
                result.emails,
                (user._id as any).toString(),
                account.email
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

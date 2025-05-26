import { analyzeEmail } from "./gemini-ai/gemini";
import { handleIncomingEmail } from "./db/create-ticket";
import { transformEmailData } from "./process-email-transform";
/**
 * Processes an incoming email with AI analysis and ticket handling
 *
 * @param email - The raw email data
 * @returns Result object with analysis and ticket information
 */
export async function processIncomingEmail(emailData: any) {
  const aiData = await transformEmailData(emailData.email);

  const analysis = await analyzeEmail(aiData);
  console.log("Email analysis result:", analysis);

  let ticketResult = null;

  // Handle ticket creation if it's a travel email
  if (analysis.isTravelEmail && !analysis.isConfirmationEmail) {
    try {
      ticketResult = await handleIncomingEmail(analysis, emailData.email);
    } catch (error) {
      console.error("Error handling ticket:", error);
      throw new Error(`Ticket processing failed: ${error}`);
    }
  }

  return {
    analysis,
    ticketResult,
    success: true,
  };
}

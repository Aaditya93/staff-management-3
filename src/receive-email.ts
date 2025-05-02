import { analyzeEmail } from "./gemini-ai/gemini";
import { handleIncomingEmail } from "./db/create-ticket";
import { transformEmailData } from "./process-email-transform";
/**
 * Processes an incoming email with AI analysis and ticket handling
 *
 * @param email - The raw email data
 * @returns Result object with analysis and ticket information
 */
export async function processIncomingEmail(email: any) {
  console.log("Received email:", email);

  // Transform and analyze the email
  const aiData = await transformEmailData(email);
  const analysis = await analyzeEmail(aiData);
  console.log("AI analysis result:", analysis);

  let ticketResult = null;

  // Handle ticket creation if it's a travel email
  if (analysis.isTravelEmail) {
    try {
      ticketResult = await handleIncomingEmail(analysis, email);

      if (ticketResult.isNewTicket) {
        console.log("New ticket created with ID:", ticketResult.ticket?._id);
      } else if (ticketResult.ticket) {
        console.log(
          "Email added to existing ticket with ID:",
          ticketResult.ticket._id
        );
      }
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

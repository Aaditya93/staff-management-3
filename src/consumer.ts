import express from "express";
import {
  receiveMessagesFromQueue,
  deleteMessagesFromQueue,
  MessageBody,
} from "./sqs/sqs";
import { processIncomingEmail } from "./receive-email";
// Initialize Express app
const app = express();
const PORT = process.env.CONSUMER_PORT || 3002;

// Middleware for parsing JSON
app.use(express.json());

// Function to process received SQS messages
async function processMessages() {
  try {
    // Receive messages from SQS queue
    const messages = await receiveMessagesFromQueue(10, 60, 20);

    if (messages.length === 0) {
      return;
    }

    // Process each message
    for (const message of messages) {
      try {
        if (!message.Body) {
          console.warn("Message has no body, skipping");
          continue;
        }

        // Parse message body
        const messageBody: MessageBody = JSON.parse(message.Body);

        await processIncomingEmail(messageBody);

        // Add your message processing logic here
        // For example: analyze email content, update database, etc.
      } catch (error) {
        console.error("Error processing individual message:", error);
        // Continue processing other messages even if one fails
      }
    }

    // Delete processed messages from the queue
    await deleteMessagesFromQueue(messages);
  } catch (error) {
    console.error("Error in message processing cycle:", error);
  }
}

// Function to start periodic message processing
const startPeriodicMessageProcessing = () => {
  // Set interval to poll for messages every 15 seconds
  setInterval(async () => {
    await processMessages();
  }, 5000);

  // Also process messages immediately on startup
  processMessages();
};

// Start the server and message processing
app.listen(PORT, () => {
  console.log(`AI server running on port ${PORT}`);
  startPeriodicMessageProcessing();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).send({ status: "healthy", service: "sqs-consumer" });
});

// Export app for testing purposes
export default app;

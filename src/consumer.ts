import express from "express";
import {
  receiveMessagesFromQueue,
  deleteMessagesFromQueue,
  MessageBody,
} from "./sqs/sqs";
import { deleteMessageFromQueue } from "./sqs/sqs";
import { processIncomingEmail } from "./receive-email";
// Initialize Express app
const app = express();
const PORT = process.env.CONSUMER_PORT || 3002;

// Middleware for parsing JSON
app.use(express.json());

// Function to process received SQS messages
async function processMessages() {
  // Start timer

  try {
    // Receive messages from SQS queue
    const messages = await receiveMessagesFromQueue(10, 60, 10);

    if (messages.length === 0) {
      return;
    }

    // Process each message
    for (const message of messages) {
      const messageStartTime = Date.now();
      try {
        if (!message.Body) {
          console.warn("Message has no body, skipping");
          continue;
        }

        // Parse message body
        const messageBody: MessageBody = JSON.parse(message.Body);

        await processIncomingEmail(messageBody);
        if (!message.ReceiptHandle) {
          console.warn("Message missing receipt handle, cannot delete");
          return Promise.resolve(null);
        }
        await deleteMessageFromQueue(message.ReceiptHandle);
      } catch (error) {
        console.error("Error processing individual message:", error);
        // Continue processing other messages even if one fails
      }
    }
  } catch (error) {
    console.error(`Error in message processing cycle after ms:`, error);
  }
}

// Function to start periodic message processing
const startPeriodicMessageProcessing = () => {
  // Set interval to poll for messages every 15 seconds
  setInterval(async () => {
    await processMessages();
  }, 10000);

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

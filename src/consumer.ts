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
// Function to process received SQS messages
async function processMessages() {
  try {
    const batchSize = 10; // Maximum allowed by SQS
    const maxMessages = 50; // Your desired total messages to process
    let processedCount = 0;

    // Process messages in batches until we reach our target or no more messages
    while (processedCount < maxMessages) {
      // Receive a batch of messages (max 10)
      const messages = await receiveMessagesFromQueue(batchSize, 120, 20);

      if (messages.length === 0) {
        console.log("No more messages available");
        break; // Exit loop if no messages left
      }

      console.log(`Processing batch of ${messages.length} messages`);

      // Process each message in the batch
      for (const message of messages) {
        try {
          if (!message.Body) {
            console.warn("Message has no body, skipping");
            continue;
          }

          // Parse message body
          const messageBody: MessageBody = JSON.parse(message.Body);

          // Process and delete the message
          await processIncomingEmail(messageBody);

          if (!message.ReceiptHandle) {
            console.warn("Message missing receipt handle, cannot delete");
            continue;
          }

          await deleteMessageFromQueue(message.ReceiptHandle);
          processedCount++;
        } catch (error) {
          console.error("Error processing individual message:", error);
          // Continue processing other messages even if one fails
        }
      }

      console.log(`Processed ${processedCount} messages so far`);
    }

    console.log(`Finished processing messages, total: ${processedCount}`);
  } catch (error) {
    console.error("Error in message processing cycle:", error);
  }
}
// Function to start periodic message processing
const startPeriodicMessageProcessing = () => {
  // Set interval to poll for messages every 15 seconds
  setInterval(async () => {
    await processMessages();
  }, 2000);

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

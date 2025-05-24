import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  Message,
} from "@aws-sdk/client-sqs";
import { v4 as uuid } from "uuid";
import dotenv from "dotenv";
dotenv.config();
const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const queueUrl = process.env.AWS_SQS_URL;

if (!region || !accessKeyId || !secretAccessKey) {
  throw new Error("Missing AWS configuration");
}

const sqsClient = new SQSClient({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});
// ...existing code...

export interface MessageBody {
  userId: string;
  emailId: string;
  email: any; // Replace 'any' with a more specific email type if available
}

export async function sendMessageToQueue(messageBody: MessageBody) {
  try {
    const params = {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(messageBody),
      MessageGroupId: "Staff-management", // Required for FIFO queues
      MessageDeduplicationId: uuid(), // Unique ID for message deduplication
    };
    // Send the message
    const command = new SendMessageCommand(params);
    const response = await sqsClient.send(command);

    return response;
  } catch (error) {
    console.error("Error sending message to SQS:", error);
    throw error;
  }
}

export async function receiveMessagesFromQueue(
  maxMessages = 10,
  visibilityTimeout = 30,
  waitTimeSeconds = 5
): Promise<Message[]> {
  try {
    const params = {
      QueueUrl: queueUrl,
      MaxNumberOfMessages: maxMessages, // Max is 10 for SQS
      VisibilityTimeout: visibilityTimeout,
      WaitTimeSeconds: waitTimeSeconds, // Long polling - wait for messages to arrive
    };

    const command = new ReceiveMessageCommand(params);
    const response = await sqsClient.send(command);

    return response.Messages || [];
  } catch (error) {
    console.error("Error receiving messages from SQS:", error);
    throw error;
  }
}

/**
 * Deletes a message from the SQS queue
 * @param receiptHandle - The receipt handle of the message to delete
 * @returns The response from SQS
 */
export async function deleteMessageFromQueue(receiptHandle: string) {
  try {
    const params = {
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
    };

    const command = new DeleteMessageCommand(params);
    const response = await sqsClient.send(command);

    return response;
  } catch (error) {
    console.error("Error deleting message from SQS:", error);
    throw error;
  }
}

/**
 * Deletes multiple messages from the SQS queue
 * @param messages - Array of messages to delete
 * @returns Array of results from delete operations
 */
export async function deleteMessagesFromQueue(
  messages: Message[]
): Promise<any[]> {
  try {
    if (!messages || messages.length === 0) {
      return [];
    }

    const deletePromises = messages.map((message) => {
      if (!message.ReceiptHandle) {
        console.warn("Message missing receipt handle, cannot delete");
        return Promise.resolve(null);
      }
      return deleteMessageFromQueue(message.ReceiptHandle);
    });

    const results = await Promise.allSettled(deletePromises);

    // Log summary of delete operations
    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    const rejected = results.filter((r) => r.status === "rejected").length;

    return results;
  } catch (error) {
    console.error("Error in batch delete operation:", error);
    throw error;
  }
}

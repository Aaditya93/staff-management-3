"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMessagesFromQueue = exports.deleteMessageFromQueue = exports.receiveMessagesFromQueue = exports.sendMessageToQueue = void 0;
const client_sqs_1 = require("@aws-sdk/client-sqs");
const uuid_1 = require("uuid");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const queueUrl = process.env.AWS_SQS_URL;
if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing AWS configuration");
}
const sqsClient = new client_sqs_1.SQSClient({
    region,
    credentials: {
        accessKeyId,
        secretAccessKey,
    },
});
function sendMessageToQueue(messageBody) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const params = {
                QueueUrl: queueUrl,
                MessageBody: JSON.stringify(messageBody),
                MessageGroupId: "Staff-management", // Required for FIFO queues
                MessageDeduplicationId: (0, uuid_1.v4)(), // Unique ID for message deduplication
            };
            // Send the message
            const command = new client_sqs_1.SendMessageCommand(params);
            const response = yield sqsClient.send(command);
            return response;
        }
        catch (error) {
            console.error("Error sending message to SQS:", error);
            throw error;
        }
    });
}
exports.sendMessageToQueue = sendMessageToQueue;
function receiveMessagesFromQueue(maxMessages = 50, visibilityTimeout = 30, waitTimeSeconds = 5) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const params = {
                QueueUrl: queueUrl,
                MaxNumberOfMessages: maxMessages, // Max is 10 for SQS
                VisibilityTimeout: visibilityTimeout,
                WaitTimeSeconds: waitTimeSeconds, // Long polling - wait for messages to arrive
            };
            const command = new client_sqs_1.ReceiveMessageCommand(params);
            const response = yield sqsClient.send(command);
            return response.Messages || [];
        }
        catch (error) {
            console.error("Error receiving messages from SQS:", error);
            throw error;
        }
    });
}
exports.receiveMessagesFromQueue = receiveMessagesFromQueue;
/**
 * Deletes a message from the SQS queue
 * @param receiptHandle - The receipt handle of the message to delete
 * @returns The response from SQS
 */
function deleteMessageFromQueue(receiptHandle) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const params = {
                QueueUrl: queueUrl,
                ReceiptHandle: receiptHandle,
            };
            const command = new client_sqs_1.DeleteMessageCommand(params);
            const response = yield sqsClient.send(command);
            return response;
        }
        catch (error) {
            console.error("Error deleting message from SQS:", error);
            throw error;
        }
    });
}
exports.deleteMessageFromQueue = deleteMessageFromQueue;
/**
 * Deletes multiple messages from the SQS queue
 * @param messages - Array of messages to delete
 * @returns Array of results from delete operations
 */
function deleteMessagesFromQueue(messages) {
    return __awaiter(this, void 0, void 0, function* () {
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
            const results = yield Promise.allSettled(deletePromises);
            // Log summary of delete operations
            const fulfilled = results.filter((r) => r.status === "fulfilled").length;
            const rejected = results.filter((r) => r.status === "rejected").length;
            return results;
        }
        catch (error) {
            console.error("Error in batch delete operation:", error);
            throw error;
        }
    });
}
exports.deleteMessagesFromQueue = deleteMessagesFromQueue;

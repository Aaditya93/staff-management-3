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
const express_1 = __importDefault(require("express"));
const sqs_1 = require("./sqs/sqs");
const sqs_2 = require("./sqs/sqs");
const receive_email_1 = require("./receive-email");
// Initialize Express app
const app = (0, express_1.default)();
const PORT = process.env.CONSUMER_PORT || 3002;
// Middleware for parsing JSON
app.use(express_1.default.json());
// Function to process received SQS messages
function processMessages() {
    return __awaiter(this, void 0, void 0, function* () {
        // Start timer
        try {
            // Receive messages from SQS queue
            const messages = yield (0, sqs_1.receiveMessagesFromQueue)(10, 120, 10);
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
                    const messageBody = JSON.parse(message.Body);
                    yield (0, receive_email_1.processIncomingEmail)(messageBody);
                    if (!message.ReceiptHandle) {
                        console.warn("Message missing receipt handle, cannot delete");
                        return Promise.resolve(null);
                    }
                    yield (0, sqs_2.deleteMessageFromQueue)(message.ReceiptHandle);
                }
                catch (error) {
                    console.error("Error processing individual message:", error);
                    // Continue processing other messages even if one fails
                }
            }
        }
        catch (error) {
            console.error(`Error in message processing cycle after ms:`, error);
        }
    });
}
// Function to start periodic message processing
const startPeriodicMessageProcessing = () => {
    // Set interval to poll for messages every 15 seconds
    setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
        yield processMessages();
    }), 10000);
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
exports.default = app;

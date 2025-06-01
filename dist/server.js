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
const process_email_1 = require("./process-email");
// Initialize Express app
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middleware for parsing JSON
app.use(express_1.default.json());
// Function to process emails periodically
const startPeriodicEmailProcessing = () => {
    // Set interval to call processAllUserEmails every 5 seconds
    setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield (0, process_email_1.processAllUserEmails)();
        }
        catch (error) {
            console.error("Error in scheduled email processing:", error);
        }
    }), 2000);
};
// Start periodic email processing
startPeriodicEmailProcessing();
// Start the server
app.listen(PORT, () => {
    console.log(`Email Server  is running on port ${PORT}`);
});

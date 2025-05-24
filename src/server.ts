import express from "express";
import { processAllUserEmails } from "./process-email";

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware for parsing JSON
app.use(express.json());

// Function to process emails periodically
const startPeriodicEmailProcessing = () => {
  // Set interval to call processAllUserEmails every 5 seconds
  setInterval(async () => {
    try {
      await processAllUserEmails();
    } catch (error) {
      console.error("Error in scheduled email processing:", error);
    }
  }, 50000);
};

// Start periodic email processing
startPeriodicEmailProcessing();

// Start the server
app.listen(PORT, () => {
  console.log(`Email Server  is running on port ${PORT}`);
});

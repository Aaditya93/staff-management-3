import express from "express";
import { processAllUserEmails } from "./process-email";

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware for parsing JSON
app.use(express.json());

// Function to process emails periodically
const startPeriodicEmailProcessing = () => {
  console.log("Starting periodic email processing");

  // Set interval to call processAllUserEmails every 5 seconds
  setInterval(async () => {
    try {
      console.log("Running scheduled email processing job");
      await processAllUserEmails();
      console.log("Email processing completed successfully");
    } catch (error) {
      console.error("Error in scheduled email processing:", error);
    }
  }, 50000); // 5000 milliseconds = 5 seconds
};

// Start periodic email processing
startPeriodicEmailProcessing();

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

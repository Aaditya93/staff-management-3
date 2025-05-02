"use server";
import { forceRefreshToken, getValidAccessToken } from ".//token";

export interface EmailMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  receivedDateTime: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  isRead: boolean;
  hasAttachments: boolean;
}
export async function fetchEmailById(
  emailId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: number,
  userId: string
): Promise<{
  email?: any; // Changed from string to any since we return the full email object
  error?: string;
}> {
  try {
    // Input validation
    if (!emailId || typeof emailId !== "string") {
      return { error: "Invalid email ID: ID must be a non-empty string" };
    }

    // Clean the emailId - remove any whitespace and ensure proper encoding
    const cleanEmailId = emailId.trim();

    // Additional validation for empty ID after trimming
    if (!cleanEmailId) {
      return { error: "Invalid email ID: ID cannot be empty" };
    }

    // Properly encode the ID for URL
    const encodedEmailId = encodeURIComponent(cleanEmailId);

    // Build the Graph API query with proper parameters
    const graphUrl = `https://graph.microsoft.com/v1.0/me/messages/${encodedEmailId}`;

    // Add query parameters for additional data
    const queryParams = [
      "$select=id,subject,body,receivedDateTime,sentDateTime,sender,isRead,hasAttachments,toRecipients,ccRecipients,bccRecipients",
      "$expand=attachments($select=id,name,contentType,size,isInline)",
    ];

    const fullUrl = `${graphUrl}?${queryParams.join("&")}`;

    const newToken = await getValidAccessToken(
      accessToken,
      refreshToken,
      expiresAt,
      emailId,
      userId
    );

    console.log("Fetching email with ID:", cleanEmailId);

    const response = await fetch(fullUrl, {
      headers: {
        Authorization: `Bearer ${newToken}`,
        "Content-Type": "application/json",
        ConsistencyLevel: "eventual",
      },
    });

    if (!response.ok) {
      // Handle error responses more gracefully
      let errorMessage = `Failed to fetch email: ${response.status} ${response.statusText}`;

      try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const text = await response.text();
          if (text && text.trim()) {
            const errorData = JSON.parse(text);
            console.error("Graph API error details:", errorData);
            if (errorData.error?.message) {
              errorMessage = `Graph API error: ${errorData.error.message}`;

              // Handle specific error for malformed ID
              if (errorData.error?.code === "ErrorInvalidIdMalformed") {
                errorMessage = "The provided email ID format is invalid";
              }
            }
          }
        }
      } catch (parseError) {
        console.error("Error parsing error response:", parseError);
      }

      return { error: errorMessage };
    }

    const email = await response.json();
    return { email };
  } catch (error) {
    console.error("Error fetching email:", error);
    return {
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Fetches all emails across folders in a single API call
 */
export async function fetchAllEmails(
  accessToken: string,
  refreshToken: string,
  expiresAt: number,
  userId: string,
  emailId: string,
  options: {
    pageSize?: number;
    filterUnread?: boolean;
    searchQuery?: string;
    lastSyncTime?: string; // New option to filter by timestamp
  } = {}
): Promise<{
  emails: EmailMessage[];
  error?: string;
}> {
  try {
    // Set default options
    const {
      pageSize = 100, // Maximum allowed by Microsoft Graph API
      filterUnread = false,
      searchQuery = "",
      lastSyncTime = "", // Default to empty string (no timestamp filtering)
    } = options;
    console.log("lastSyncTime", lastSyncTime);

    // Get a valid access token
    const newToken = await getValidAccessToken(
      accessToken,
      refreshToken,
      expiresAt,
      emailId,
      userId
    );

    if (!newToken) {
      return {
        emails: [],
        error: "Authentication failed. Please sign in again.",
      };
    }

    // Build the Graph API query - using search instead of folder-specific queries
    const graphUrl = "https://graph.microsoft.com/v1.0/me/messages";

    // Add query parameters
    const queryParams = [
      `$top=${pageSize}`,
      "$select=id,subject,body,receivedDateTime,sentDateTime,sender,from,isRead,toRecipients,hasAttachments,parentFolderId,ccRecipients,bccRecipients,categories,conversationId,importance,flag,webLink,replyTo",
      "$orderby=receivedDateTime desc",
    ];

    // Build filter conditions
    let filterConditions = [];

    // Add filter for unread messages if requested
    if (filterUnread) {
      filterConditions.push("isRead eq false");
    }

    // Add timestamp filter if provided
    if (lastSyncTime) {
      // Format: receivedDateTime ge 2023-01-01T00:00:00Z
      // filterConditions.push(`receivedDateTime ge ${lastSyncTime}`);

      filterConditions.push(`receivedDateTime ge 2025-04-11T09:15:09.908Z`);
    }

    // Combine filter conditions if any exist
    if (filterConditions.length > 0) {
      queryParams.push(`$filter=${filterConditions.join(" and ")}`);
    }

    // Add search query if provided
    if (searchQuery) {
      queryParams.push(`$search="${encodeURIComponent(searchQuery)}"`);
    }

    const fullUrl = `${graphUrl}?${queryParams.join("&")}`;

    console.log(`Fetching emails since ${lastSyncTime || "the beginning"}`);

    // Make request to Microsoft Graph API
    const response = await fetch(fullUrl, {
      headers: {
        Authorization: `Bearer ${newToken}`,
        "Content-Type": "application/json",
        ConsistencyLevel: "eventual", // Required for search queries
      },
    });

    // Handle error responses
    if (!response.ok) {
      // Process error response
      let errorMessage = `Failed to fetch emails: ${response.status} ${response.statusText}`;

      try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const text = await response.text();
          if (text && text.trim()) {
            const errorData = JSON.parse(text);
            console.error("Graph API error details:", errorData);
            if (errorData.error?.message) {
              errorMessage = `Graph API error: ${errorData.error.message}`;
            }
          }
        }
      } catch (parseError) {
        console.error("Error parsing error response:", parseError);
      }

      return {
        emails: [],
        error: errorMessage,
      };
    }

    // Process successful response
    const data = await response.json();

    // Extract the emails
    const emails = data.value;

    console.log(`Retrieved ${emails.length} email(s) matching criteria`);

    // You can get additional pages if needed with @odata.nextLink
    // This is the basic implementation without pagination handling

    return {
      emails,
    };
  } catch (error) {
    console.error("Error fetching all emails:", error);

    return {
      emails: [],
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

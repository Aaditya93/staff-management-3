import Ticket, { ITicket } from "../db/ticket";
import dbConnect from "./db";
import {
  createTravelAgentUser,
  getTravelAgentUserByEmail,
} from "./travelAgentUser";

import User from "./User";
/**
 * Creates a new ticket from analyzed email data and raw email information
 *
 * @param analysisData - The AI-analyzed email data
 * @param emailData - The raw email data
 * @returns The created ticket document
 */ /**
 * Person information with name and email
 */
export interface IPerson {
  name: string;
  emailId: string;
}

/**
 * Extended person information with optional role
 */
export interface IPersonWithRole extends IPerson {
  role?: string;
}

/**
 * Email recipient/sender format
 */
export interface IEmailContact {
  name: string;
  email: string;
}

/**
 * Analysis data returned from AI processing of emails
 */
export interface IEmailAnalysisData {
  destination: string;
  arrivalDate: string;
  departureDate: string;
  numberOfPersons: number;
  isTravelEmail: boolean;
  companyName: string;
  travelAgent: IPerson;
  salesStaff: IPerson;
  isInquiryEmail: boolean;
  isSupplierEmail: boolean;
}

export interface IEmailData {
  id: string;
  emailId: string;
  userId: string;
  userName: string;
  subject: string;
  bodyText: string;
  preview?: string;
  receivedDateTime: string;
  sentDateTime?: string;
  webLink: string;
  emailType: string;
  from: IEmailContact;
  to: IEmailContact[];
}

export async function createTicketFromEmail(
  analysisData: IEmailAnalysisData,
  emailData: IEmailData
) {
  try {
    await dbConnect();

    // Parse dates from the analysis data (format: DD/MM/YYYY)
    const parseDate = (dateString: string) => {
      const [day, month, year] = dateString.split("/").map(Number);
      return new Date(year, month - 1, day); // month is 0-indexed in JS Date
    };

    const isValidDateFormat = (dateString?: string) => {
      if (!dateString) return false;
      const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
      return dateRegex.test(dateString);
    };

    // Only create ticket if it's a travel email and not a supplier email or inquiry email
    if (analysisData.isTravelEmail) {
      // Create a new ticket document
      const newTicket = new Ticket({
        // Agent information
        agent: analysisData.companyName,

        // Email metadata
        receivedDateTime:
          emailData.emailType === "received"
            ? emailData.receivedDateTime
            : null,
        sentDateTime:
          emailData.emailType === "sent" ? emailData.receivedDateTime : null,

        lastTimeReceived:
          emailData.emailType === "received"
            ? emailData.receivedDateTime
            : null,
        lastTimeSent:
          emailData.emailType === "sent" ? emailData.receivedDateTime : null,

        destination: analysisData.destination,
        ...(isValidDateFormat(analysisData.arrivalDate) && {
          arrivalDate: parseDate(analysisData.arrivalDate),
        }),
        ...(isValidDateFormat(analysisData.departureDate) && {
          departureDate: parseDate(analysisData.departureDate),
        }),
        pax: analysisData.numberOfPersons,

        // Personnel information
        travelAgent: {
          name: analysisData.travelAgent?.name || "",
          emailId: analysisData.travelAgent?.emailId || "",
        },

        companyName: analysisData.companyName,

        reservationInCharge: {
          name:
            emailData.emailType === "sent"
              ? emailData.from.name
              : emailData.to[0]?.name || "",
          emailId:
            emailData.emailType === "sent"
              ? emailData.from.email
              : emailData.to[0]?.email || "",
          id: emailData.userId,
        },
        createdBy: {
          id: emailData.userId,
          name:
            emailData.emailType === "sent"
              ? emailData.from.name
              : emailData.to[0]?.name || "",
          emailId:
            emailData.emailType === "sent"
              ? emailData.from.email
              : emailData.to[0]?.email || "",
        },

        salesInCharge: {
          name: analysisData.salesStaff?.name || "",
          emailId: analysisData.salesStaff?.emailId || "",
        },

        // Default fields
        isApproved: false,
        status: "pending",

        estimateTimeToSendPrice: 0,
        cost: 0,
        waitingTime: 0,
        speed: "normal",
        inbox: emailData.emailType === "received" ? 1 : 0,
        sent: emailData.emailType === "sent" ? 1 : 0,

        // Email tracking
        lastMailTimeReceived:
          emailData.emailType === "received"
            ? emailData.receivedDateTime
            : null,
        lastMailTimeSent:
          emailData.emailType === "sent" ? emailData.receivedDateTime : null,

        // Add the first email to the email array
        email: [
          {
            id: emailData.id,
            preview: emailData.preview || "",
            weblink: emailData.webLink,
            emailType: emailData.emailType,
            from: {
              name: emailData.from.name,
              email: emailData.from.email,
            },
            to: emailData.to,
            timestamp: new Date(),
          },
        ],
      });

      // Save the ticket and return it
      const savedTicket = await newTicket.save();
      console.log("Ticket created successfully:", savedTicket);
      return savedTicket;
    } else {
      console.log("Email doesn't qualify for ticket creation:", {
        isTravelEmail: analysisData.isTravelEmail,
        isSupplierEmail: analysisData.isSupplierEmail,
        isInquiryEmail: analysisData.isInquiryEmail,
      });
      return null;
    }
  } catch (error) {
    console.error("Error creating ticket from email:", error);
    throw new Error(`Failed to create ticket: ${(error as Error).message}`);
  }
}

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
  summary: string;
  rating: number;
  hasTicketId: boolean;
  ticketId?: string;
  isTravelEmail: boolean;
  companyName: string;
  travelAgent: IPerson;
  salesStaff: IPerson;
  personnelMentioned?: IPersonWithRole[];
}

/**
 * Raw email data structure
 */
export interface IEmailData {
  id: string;
  emailId: string;
  userId: string;
  userName: string;
  subject: string;
  bodyText: string;
  receivedDateTime: string;
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

    // Calculate timestamps for email tracking
    let travelAgentUserId: string | null = null;
    const receivedTime = new Date(emailData.receivedDateTime).getTime();
    const TravelAgentUser = await User.findOne({
      email: analysisData.travelAgent.emailId,
    });
    travelAgentUserId = TravelAgentUser?._id.toString();
    if (!TravelAgentUser && analysisData.travelAgent.emailId) {
      const travelAgentUser = await createTravelAgentUser(
        analysisData.travelAgent.name,
        analysisData.travelAgent.emailId,
        analysisData.companyName
      );

      const user = await User.create({
        name: analysisData.travelAgent.name,
        email: analysisData.travelAgent.emailId,
        role: "TravelAgent",
        travelAgentId: travelAgentUser?._id,
      });
      travelAgentUserId = user._id.toString();
    }

    // Create a new ticket document
    const newTicket = new Ticket({
      // Agent information
      agent: analysisData.companyName,

      // Email metadata
      receivedDateTime: emailData.receivedDateTime,
      sentDateTime:
        emailData.emailType === "sent" ? emailData.receivedDateTime : null,

      // If ticketId exists in analysis, use it
      ...(analysisData.ticketId && { ticketId: analysisData.ticketId }),

      // Travel details from analysis

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
        id: travelAgentUserId,
      },

      companyName: analysisData.companyName,

      reservationInCharge: {
        name:
          emailData.emailType === "sent"
            ? emailData.from.name
            : emailData.to[0].name,
        emailId:
          emailData.emailType === "sent"
            ? emailData.from.email
            : emailData.to[0].email,
      },
      createdBy: {
        id: emailData.userId,
        name:
          emailData.emailType === "sent"
            ? emailData.from.name
            : emailData.to[0].name,
        emailId:
          emailData.emailType === "sent"
            ? emailData.from.email
            : emailData.to[0].email,
      },

      salesInCharge: {
        name: analysisData.salesStaff.name,
        emailId: analysisData.salesStaff.emailId,
      },

      // Default fields
      isApproved: false,
      market: "pending",
      status: "new",

      estimateTimeToSendPrice: 0,
      cost: 0,
      waitingTime: 0,
      speed: "normal",
      inbox: emailData.emailType === "received" ? 1 : 0,
      sent: emailData.emailType === "sent" ? 1 : 0,

      // Email tracking
      lastMailTimeReceived:
        emailData.emailType === "received" ? receivedTime : 0,
      lastMailTimeSent: emailData.emailType === "sent" ? receivedTime : 0,

      // Add the first email to the email array
      email: [
        {
          id: emailData.id,
          emailSummary: analysisData.summary,
          rating: analysisData.rating,
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

    const savedTicket = await newTicket.save();

    return savedTicket;
  } catch (error) {
    console.error("Error creating ticket from email:", error);
    throw new Error(`Failed to create ticket: ${(error as Error).message}`);
  }
}
/**
 * Handles incoming emails by either creating a new ticket or adding to an existing one
 *
 * @param analysisData - The AI-analyzed email data
 * @param emailData - The raw email data
 * @returns Object with ticket info and whether it's a new ticket or updated one
 */
export async function handleIncomingEmail(
  analysisData: IEmailAnalysisData,
  emailData: IEmailData
) {
  try {
    await dbConnect();
    let ticket;
    let isNewTicket = false;

    // Check if this email has a ticket ID and is travel-related
    if (analysisData.isTravelEmail) {
      if (
        analysisData.hasTicketId &&
        analysisData.ticketId &&
        analysisData.ticketId.length === 24
      ) {
        const existingTicket = await Ticket.findById({
          _id: analysisData.ticketId,
        });

        if (existingTicket) {
          // Create a new email entry
          const newEmail = {
            id: emailData.id,
            emailSummary: analysisData.summary,
            rating: analysisData.rating,
            weblink: emailData.webLink,
            emailType: emailData.emailType,
            from: {
              name: emailData.from.name,
              email: emailData.from.email,
            },
            to: emailData.to,
            timestamp: new Date(),
          };

          // Update email counts and timestamps based on email type
          const receivedTime = new Date(emailData.receivedDateTime).getTime();

          if (emailData.emailType === "received") {
            existingTicket.inbox += 1;
            existingTicket.lastMailTimeReceived = receivedTime;
          } else if (emailData.emailType === "sent") {
            existingTicket.sent += 1;
            existingTicket.lastMailTimeSent = receivedTime;
          }

          // Add the new email to the ticket's email array
          existingTicket.email.push(newEmail);

          // Save the updated ticket
          ticket = await existingTicket.save();
        } else {
          // If ticketId is present but ticket not found, create a new one with that ID

          ticket = await createTicketFromEmail(analysisData, emailData); // UNCOMMENTED
          isNewTicket = true;
        }
      } else {
        // No ticket ID in the email, create a new ticket
        ticket = await createTicketFromEmail(analysisData, emailData); // UNCOMMENTED
        isNewTicket = true;
      }

      return {
        ticket,
        isNewTicket,
      };
    } else {
      // Not a travel email
      return {
        ticket: null,
        isNewTicket: false,
      };
    }
  } catch (error) {
    console.error("Error handling incoming email:", error);
    throw new Error(`Failed to process email: ${(error as Error).message}`);
  }
}

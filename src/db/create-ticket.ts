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
  isInquiryEmail: boolean;

  isSupplierEmail: boolean;
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

    // Create a new ticket document
    const newTicket = new Ticket({
      // Agent information
      agent: analysisData.companyName,

      // Email metadata
      receivedDateTime:
        emailData.emailType === "received" ? emailData.receivedDateTime : null,
      sentDateTime:
        emailData.emailType === "sent" ? emailData.receivedDateTime : null,

      lastTimeReceived:
        emailData.emailType === "received" ? emailData.receivedDateTime : null,
      lastTimeSent:
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
        id: emailData.userId,
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
      status: "pending",

      estimateTimeToSendPrice: 0,
      cost: 0,
      waitingTime: 0,
      speed: "normal",
      inbox: emailData.emailType === "received" ? 1 : 0,
      sent: emailData.emailType === "sent" ? 1 : 0,

      // Email tracking
      lastMailTimeReceived:
        emailData.emailType === "received" ? emailData.receivedDateTime : null,
      lastMailTimeSent:
        emailData.emailType === "sent" ? emailData.receivedDateTime : null,

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
    if (analysisData.isTravelEmail || analysisData.hasTicketId) {
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

          if (emailData.emailType === "received") {
            existingTicket.inbox += 1;
            existingTicket.lastMailTimeReceived = emailData.receivedDateTime;
          } else if (emailData.emailType === "sent") {
            existingTicket.sent += 1;
            existingTicket.lastMailTimeSent = emailData.receivedDateTime;
          }

          if (existingTicket.email && existingTicket.email.length > 0) {
            // Get all emails sorted by timestamp
            const sortedEmails = [...existingTicket.email, newEmail].sort(
              (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime()
            );

            let totalWaitTime = 0;
            let waitTimeCount = 0;

            // Calculate time differences between received and subsequent sent emails
            for (let i = 0; i < sortedEmails.length - 1; i++) {
              const currentEmail = sortedEmails[i];
              const nextEmail = sortedEmails[i + 1];

              // If current is received and next is sent, calculate waiting time
              if (
                currentEmail.emailType === "received" &&
                nextEmail.emailType === "sent"
              ) {
                const receivedTime = new Date(currentEmail.timestamp).getTime();
                const sentTime = new Date(nextEmail.timestamp).getTime();
                const waitTime = sentTime - receivedTime; // in milliseconds

                if (waitTime > 0) {
                  totalWaitTime += waitTime;
                  waitTimeCount++;
                }
              }
            }
            if (waitTimeCount > 0) {
              const avgWaitTimeMinutes = Math.round(
                totalWaitTime / waitTimeCount / (1000 * 60)
              );
              existingTicket.waitingTime = avgWaitTimeMinutes;
            }
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
      } else if (!analysisData.isSupplierEmail) {
        // No ticket ID in the email, create a new ticket
        ticket = await createTicketFromEmail(analysisData, emailData); // UNCOMMENTED
        isNewTicket = true;
      }

      return {
        ticket,
        isNewTicket,
        isInquiryEmail: analysisData.isInquiryEmail,
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

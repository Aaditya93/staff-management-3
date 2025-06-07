// @ts-nocheck
import Ticket, { ITicket } from "../db/ticket";
import dbConnect from "./db";
import TravelAgentUser from "./travelAgentUser";
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
// Add this new interface for personnel with travel agent info
export interface IPersonnelWithTravelAgent {
  name: string;
  emailId: string;
  role?: string;
  travelAgentId?: string;
}

// Add this interface for the return type
export interface IPersonnelLookupResult {
  salesStaff: { name: string; email: string; id: string } | null;
  travelAgent: {
    name: string;
    email: string;
    id: string;
    travelAgentId?: string;
  } | null;
  allPersonnel: IPersonnelWithTravelAgent[];
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
  personnelMentioned: Array<{ name: string; emailId: string }>; // Add this
}

// ...existing code...

// Optimized helper function to lookup personnel and extract roles
async function lookupPersonnelInUsers(
  personnelMentioned: Array<{ name: string; emailId: string }>
): Promise<IPersonnelLookupResult> {
  try {
    await dbConnect();

    if (!personnelMentioned || personnelMentioned.length === 0) {
      return {
        salesStaff: null,
        travelAgent: null,
        allPersonnel: [],
      };
    }

    // Extract all email addresses for the query
    const emailIds = personnelMentioned
      .map((person) => person.emailId)
      .filter(Boolean); // Remove empty/null emails

    if (emailIds.length === 0) {
      return {
        salesStaff: null,
        travelAgent: null,
        allPersonnel: personnelMentioned.map((person) => ({
          name: person.name,
          emailId: person.emailId,
        })),
      };
    }

    // Single query to fetch all users by email
    const users = await User.find({ email: { $in: emailIds } }).lean();

    // Create a map for faster lookup
    const userMap = new Map(users.map((user) => [user.email, user]));

    let salesStaff: { name: string; email: string; id: string } | null = null;
    let travelAgent: { name: string; email: string; id: string } | null = null;

    // Map personnel with their corresponding user data
    const personnelWithTravelAgentInfo: IPersonnelWithTravelAgent[] =
      personnelMentioned.map((person) => {
        const user = userMap.get(person.emailId);

        if (user) {
          const personnelInfo: IPersonnelWithTravelAgent = {
            name: person.name || user.name,
            emailId: person.emailId,
            role: user.role,
          };

          // Extract salesStaff and travelAgent based on role
          if (user.role === "SalesStaff" && !salesStaff) {
            salesStaff = {
              name: person.name || user.name,
              email: person.emailId,
              id: user._id as string,
            };
          }

          if (user.role === "TravelAgent" && !travelAgent) {
            travelAgent = {
              name: person.name || user.name,
              email: person.emailId,
              id: user._id as string,
              travelAgentId: user.travelAgentId
                ? user.travelAgentId.toString()
                : undefined,
            };

            // If user is a travel agent and has travelAgentId, add it
            if (user.travelAgentId) {
              personnelInfo.travelAgentId = user.travelAgentId.toString();
            }
          }

          return personnelInfo;
        } else {
          // User not found in database, add as-is
          return {
            name: person.name,
            emailId: person.emailId,
          };
        }
      });

    return {
      salesStaff,
      travelAgent,
      allPersonnel: personnelWithTravelAgentInfo,
    };
  } catch (error) {
    console.error("Error looking up personnel in users:", error);
    return {
      salesStaff: null,
      travelAgent: null,
      allPersonnel: personnelMentioned.map((person) => ({
        name: person.name,
        emailId: person.emailId,
      })),
    };
  }
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

      let personnelLookup: IPersonnelLookupResult = {
        salesStaff: null,
        travelAgent: null,
        allPersonnel: [],
      };
      let travelAgentData: any = null;
      if (
        analysisData.personnelMentioned &&
        analysisData.personnelMentioned.length > 0
      ) {
        personnelLookup = await lookupPersonnelInUsers(
          analysisData.personnelMentioned
        );

        if (
          personnelLookup.travelAgent &&
          personnelLookup.travelAgent.travelAgentId
        ) {
          travelAgentData = await User.findById(personnelLookup.travelAgent.id)
            .lean()
            .populate({
              path: "travelAgentId",
              model: TravelAgentUser.modelName || "TravelAgentUser",
            });
        }
        console.log("Personnel lookup result:", travelAgentData);
      }

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
          name: travelAgentData?.name || analysisData.travelAgent?.name || "",
          emailId:
            travelAgentData?.email || analysisData.travelAgent?.emailId || "",
          id: travelAgentData?._id || "",
        },

        companyName: travelAgentData?.travelAgentId.company || "No Name",

        reservationInCharge: {
          name:
            emailData.emailType === "sent"
              ? emailData.from.name
              : emailData.to[0]?.name || "No Name",
          emailId:
            emailData.emailType === "sent"
              ? emailData.from.email
              : emailData.to[0]?.email || "No Email",
          id: emailData.userId,
        },
        createdBy: {
          id: emailData.userId,
          name:
            emailData.emailType === "sent"
              ? emailData.from.name
              : emailData.to[0]?.name || "No Name",
          emailId:
            emailData.emailType === "sent"
              ? emailData.from.email
              : emailData.to[0]?.email || "No Email",
        },

        salesInCharge: {
          id: travelAgentData?.salesInCharge?.id || "",
          name:
            travelAgentData?.salesInCharge?.name ||
            analysisData.salesStaff?.name ||
            "No Name",
          emailId:
            travelAgentData?.salesInCharge?.email ||
            analysisData.salesStaff?.emailId ||
            "No Email",
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

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
exports.handleIncomingEmail = exports.createTicketFromEmail = void 0;
const ticket_1 = __importDefault(require("../db/ticket"));
const db_1 = __importDefault(require("./db"));
const travelAgentUser_1 = require("./travelAgentUser");
const User_1 = __importDefault(require("./User"));
function createTicketFromEmail(analysisData, emailData) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, db_1.default)();
            // Parse dates from the analysis data (format: DD/MM/YYYY)
            const parseDate = (dateString) => {
                const [day, month, year] = dateString.split("/").map(Number);
                return new Date(year, month - 1, day); // month is 0-indexed in JS Date
            };
            const isValidDateFormat = (dateString) => {
                if (!dateString)
                    return false;
                const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
                return dateRegex.test(dateString);
            };
            // Calculate timestamps for email tracking
            let travelAgentUserId = null;
            const receivedTime = new Date(emailData.receivedDateTime).getTime();
            const TravelAgentUser = yield User_1.default.findOne({
                email: analysisData.travelAgent.emailId,
            });
            travelAgentUserId = TravelAgentUser === null || TravelAgentUser === void 0 ? void 0 : TravelAgentUser._id.toString();
            if (!TravelAgentUser && analysisData.travelAgent.emailId) {
                const travelAgentUser = yield (0, travelAgentUser_1.createTravelAgentUser)(analysisData.travelAgent.name, analysisData.travelAgent.emailId, analysisData.companyName);
                const user = yield User_1.default.create({
                    name: analysisData.travelAgent.name,
                    email: analysisData.travelAgent.emailId,
                    role: "TravelAgent",
                    travelAgentId: travelAgentUser === null || travelAgentUser === void 0 ? void 0 : travelAgentUser._id,
                });
                travelAgentUserId = user._id.toString();
            }
            // Create a new ticket document
            const newTicket = new ticket_1.default(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ 
                // Agent information
                agent: analysisData.companyName, 
                // Email metadata
                receivedDateTime: emailData.receivedDateTime, sentDateTime: emailData.emailType === "sent" ? emailData.receivedDateTime : null }, (analysisData.ticketId && { ticketId: analysisData.ticketId })), { 
                // Travel details from analysis
                destination: analysisData.destination }), (isValidDateFormat(analysisData.arrivalDate) && {
                arrivalDate: parseDate(analysisData.arrivalDate),
            })), (isValidDateFormat(analysisData.departureDate) && {
                departureDate: parseDate(analysisData.departureDate),
            })), { pax: analysisData.numberOfPersons, 
                // Personnel information
                travelAgent: {
                    name: ((_a = analysisData.travelAgent) === null || _a === void 0 ? void 0 : _a.name) || "",
                    emailId: ((_b = analysisData.travelAgent) === null || _b === void 0 ? void 0 : _b.emailId) || "",
                    id: travelAgentUserId,
                }, companyName: analysisData.companyName, reservationInCharge: {
                    name: emailData.emailType === "sent"
                        ? emailData.from.name
                        : emailData.to[0].name,
                    emailId: emailData.emailType === "sent"
                        ? emailData.from.email
                        : emailData.to[0].email,
                }, createdBy: {
                    id: emailData.userId,
                    name: emailData.emailType === "sent"
                        ? emailData.from.name
                        : emailData.to[0].name,
                    emailId: emailData.emailType === "sent"
                        ? emailData.from.email
                        : emailData.to[0].email,
                }, salesInCharge: {
                    name: analysisData.salesStaff.name,
                    emailId: analysisData.salesStaff.emailId,
                }, 
                // Default fields
                isApproved: false, market: "", status: "new", estimateTimeToSendPrice: 0, cost: 0, waitingTime: 0, speed: "normal", inbox: emailData.emailType === "received" ? 1 : 0, sent: emailData.emailType === "sent" ? 1 : 0, 
                // Email tracking
                lastMailTimeReceived: emailData.emailType === "received" ? receivedTime : 0, lastMailTimeSent: emailData.emailType === "sent" ? receivedTime : 0, 
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
                ] }));
            const savedTicket = yield newTicket.save();
            console.log("Ticket created successfully:", savedTicket);
            return savedTicket;
        }
        catch (error) {
            console.error("Error creating ticket from email:", error);
            throw new Error(`Failed to create ticket: ${error.message}`);
        }
    });
}
exports.createTicketFromEmail = createTicketFromEmail;
/**
 * Handles incoming emails by either creating a new ticket or adding to an existing one
 *
 * @param analysisData - The AI-analyzed email data
 * @param emailData - The raw email data
 * @returns Object with ticket info and whether it's a new ticket or updated one
 */
function handleIncomingEmail(analysisData, emailData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, db_1.default)();
            let ticket;
            let isNewTicket = false;
            // Check if this email has a ticket ID and is travel-related
            if (analysisData.isTravelEmail) {
                if (analysisData.hasTicketId &&
                    analysisData.ticketId &&
                    analysisData.ticketId.length === 24) {
                    // Try to find existing ticket by ID
                    const existingTicket = yield ticket_1.default.findById({
                        _id: analysisData.ticketId,
                    });
                    if (existingTicket) {
                        console.log(`Found existing ticket with ID: ${analysisData.ticketId}`);
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
                        }
                        else if (emailData.emailType === "sent") {
                            existingTicket.sent += 1;
                            existingTicket.lastMailTimeSent = receivedTime;
                        }
                        // Add the new email to the ticket's email array
                        existingTicket.email.push(newEmail);
                        // Save the updated ticket
                        ticket = yield existingTicket.save();
                        console.log("Added new email to existing ticket");
                    }
                    else {
                        // If ticketId is present but ticket not found, create a new one with that ID
                        console.log(`No ticket found with ID ${analysisData.ticketId}. Creating new ticket.`);
                        ticket = yield createTicketFromEmail(analysisData, emailData); // UNCOMMENTED
                        isNewTicket = true;
                    }
                }
                else {
                    // No ticket ID in the email, create a new ticket
                    ticket = yield createTicketFromEmail(analysisData, emailData); // UNCOMMENTED
                    isNewTicket = true;
                }
                return {
                    ticket,
                    isNewTicket,
                };
            }
            else {
                // Not a travel email
                return {
                    ticket: null,
                    isNewTicket: false,
                };
            }
        }
        catch (error) {
            console.error("Error handling incoming email:", error);
            throw new Error(`Failed to process email: ${error.message}`);
        }
    });
}
exports.handleIncomingEmail = handleIncomingEmail;

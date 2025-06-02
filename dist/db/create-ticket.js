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
exports.createTicketFromEmail = void 0;
const ticket_1 = __importDefault(require("../db/ticket"));
const db_1 = __importDefault(require("./db"));
function createTicketFromEmail(analysisData, emailData) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
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
            // Only create ticket if it's a travel email and not a supplier email or inquiry email
            if (analysisData.isTravelEmail &&
                !analysisData.isSupplierEmail &&
                !analysisData.isInquiryEmail) {
                // Create a new ticket document
                const newTicket = new ticket_1.default(Object.assign(Object.assign(Object.assign({ 
                    // Agent information
                    agent: analysisData.companyName, 
                    // Email metadata
                    receivedDateTime: emailData.emailType === "received"
                        ? emailData.receivedDateTime
                        : null, sentDateTime: emailData.emailType === "sent" ? emailData.receivedDateTime : null, lastTimeReceived: emailData.emailType === "received"
                        ? emailData.receivedDateTime
                        : null, lastTimeSent: emailData.emailType === "sent" ? emailData.receivedDateTime : null, destination: analysisData.destination }, (isValidDateFormat(analysisData.arrivalDate) && {
                    arrivalDate: parseDate(analysisData.arrivalDate),
                })), (isValidDateFormat(analysisData.departureDate) && {
                    departureDate: parseDate(analysisData.departureDate),
                })), { pax: analysisData.numberOfPersons, 
                    // Personnel information
                    travelAgent: {
                        name: ((_a = analysisData.travelAgent) === null || _a === void 0 ? void 0 : _a.name) || "",
                        emailId: ((_b = analysisData.travelAgent) === null || _b === void 0 ? void 0 : _b.emailId) || "",
                    }, companyName: analysisData.companyName, reservationInCharge: {
                        name: emailData.emailType === "sent"
                            ? emailData.from.name
                            : ((_c = emailData.to[0]) === null || _c === void 0 ? void 0 : _c.name) || "",
                        emailId: emailData.emailType === "sent"
                            ? emailData.from.email
                            : ((_d = emailData.to[0]) === null || _d === void 0 ? void 0 : _d.email) || "",
                        id: emailData.userId,
                    }, createdBy: {
                        id: emailData.userId,
                        name: emailData.emailType === "sent"
                            ? emailData.from.name
                            : ((_e = emailData.to[0]) === null || _e === void 0 ? void 0 : _e.name) || "",
                        emailId: emailData.emailType === "sent"
                            ? emailData.from.email
                            : ((_f = emailData.to[0]) === null || _f === void 0 ? void 0 : _f.email) || "",
                    }, salesInCharge: {
                        name: ((_g = analysisData.salesStaff) === null || _g === void 0 ? void 0 : _g.name) || "",
                        emailId: ((_h = analysisData.salesStaff) === null || _h === void 0 ? void 0 : _h.emailId) || "",
                    }, 
                    // Default fields
                    isApproved: false, status: "pending", estimateTimeToSendPrice: 0, cost: 0, waitingTime: 0, speed: "normal", inbox: emailData.emailType === "received" ? 1 : 0, sent: emailData.emailType === "sent" ? 1 : 0, 
                    // Email tracking
                    lastMailTimeReceived: emailData.emailType === "received"
                        ? emailData.receivedDateTime
                        : null, lastMailTimeSent: emailData.emailType === "sent" ? emailData.receivedDateTime : null, 
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
                    ] }));
                // Save the ticket and return it
                const savedTicket = yield newTicket.save();
                console.log("Ticket created successfully:", savedTicket);
                return savedTicket;
            }
            else {
                console.log("Email doesn't qualify for ticket creation:", {
                    isTravelEmail: analysisData.isTravelEmail,
                    isSupplierEmail: analysisData.isSupplierEmail,
                    isInquiryEmail: analysisData.isInquiryEmail,
                });
                return null;
            }
        }
        catch (error) {
            console.error("Error creating ticket from email:", error);
            throw new Error(`Failed to create ticket: ${error.message}`);
        }
    });
}
exports.createTicketFromEmail = createTicketFromEmail;

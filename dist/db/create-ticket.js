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
// @ts-nocheck
const ticket_1 = __importDefault(require("../db/ticket"));
const db_1 = __importDefault(require("./db"));
const travelAgentUser_1 = __importDefault(require("./travelAgentUser"));
const User_1 = __importDefault(require("./User"));
// ...existing code...
// Optimized helper function to lookup personnel and extract roles
function lookupPersonnelInUsers(personnelMentioned) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, db_1.default)();
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
            const users = yield User_1.default.find({ email: { $in: emailIds } }).lean();
            // Create a map for faster lookup
            const userMap = new Map(users.map((user) => [user.email, user]));
            let salesStaff = null;
            let travelAgent = null;
            // Map personnel with their corresponding user data
            const personnelWithTravelAgentInfo = personnelMentioned.map((person) => {
                const user = userMap.get(person.emailId);
                if (user) {
                    const personnelInfo = {
                        name: person.name || user.name,
                        emailId: person.emailId,
                        role: user.role,
                    };
                    // Extract salesStaff and travelAgent based on role
                    if (user.role === "SalesStaff" && !salesStaff) {
                        salesStaff = {
                            name: person.name || user.name,
                            email: person.emailId,
                            id: user._id,
                        };
                    }
                    if (user.role === "TravelAgent" && !travelAgent) {
                        travelAgent = {
                            name: person.name || user.name,
                            email: person.emailId,
                            id: user._id,
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
                }
                else {
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
        }
        catch (error) {
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
    });
}
function createTicketFromEmail(analysisData, emailData) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
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
            if (analysisData.isTravelEmail) {
                // Create a new ticket document
                let personnelLookup = {
                    salesStaff: null,
                    travelAgent: null,
                    allPersonnel: [],
                };
                let travelAgentData = null;
                if (analysisData.personnelMentioned &&
                    analysisData.personnelMentioned.length > 0) {
                    personnelLookup = yield lookupPersonnelInUsers(analysisData.personnelMentioned);
                    if (personnelLookup.travelAgent &&
                        personnelLookup.travelAgent.travelAgentId) {
                        travelAgentData = yield User_1.default.findById(personnelLookup.travelAgent.id)
                            .lean()
                            .populate({
                            path: "travelAgentId",
                            model: travelAgentUser_1.default.modelName || "TravelAgentUser",
                        });
                    }
                }
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
                        name: (travelAgentData === null || travelAgentData === void 0 ? void 0 : travelAgentData.name) || "No Name",
                        emailId: (travelAgentData === null || travelAgentData === void 0 ? void 0 : travelAgentData.email) || ((_a = analysisData.travelAgent) === null || _a === void 0 ? void 0 : _a.emailId) || "",
                        id: (travelAgentData === null || travelAgentData === void 0 ? void 0 : travelAgentData._id) || "",
                    }, companyName: (travelAgentData === null || travelAgentData === void 0 ? void 0 : travelAgentData.travelAgentId.company) || "No Name", reservationInCharge: {
                        name: ((_b = travelAgentData === null || travelAgentData === void 0 ? void 0 : travelAgentData.reservationInCharge) === null || _b === void 0 ? void 0 : _b.name) || "No Name",
                        emailId: ((_c = travelAgentData === null || travelAgentData === void 0 ? void 0 : travelAgentData.reservationInCharge) === null || _c === void 0 ? void 0 : _c.email) ||
                            (emailData.emailType === "sent"
                                ? emailData.from.email
                                : (_d = emailData.to[0]) === null || _d === void 0 ? void 0 : _d.email) ||
                            "No Email",
                        id: ((_e = travelAgentData === null || travelAgentData === void 0 ? void 0 : travelAgentData.reservationInCharge) === null || _e === void 0 ? void 0 : _e.id) || emailData.userId,
                    }, createdBy: {
                        id: emailData.userId,
                        name: emailData.emailType === "sent"
                            ? emailData.from.name
                            : ((_f = emailData.to[0]) === null || _f === void 0 ? void 0 : _f.name) || "No Name",
                        emailId: emailData.emailType === "sent"
                            ? emailData.from.email
                            : ((_g = emailData.to[0]) === null || _g === void 0 ? void 0 : _g.email) || "No Email",
                    }, salesInCharge: {
                        id: ((_h = travelAgentData === null || travelAgentData === void 0 ? void 0 : travelAgentData.salesInCharge) === null || _h === void 0 ? void 0 : _h.id) || "",
                        name: ((_j = travelAgentData === null || travelAgentData === void 0 ? void 0 : travelAgentData.salesInCharge) === null || _j === void 0 ? void 0 : _j.name) || "No Name",
                        emailId: ((_k = travelAgentData === null || travelAgentData === void 0 ? void 0 : travelAgentData.salesInCharge) === null || _k === void 0 ? void 0 : _k.email) ||
                            ((_l = analysisData.salesStaff) === null || _l === void 0 ? void 0 : _l.emailId) ||
                            "No Email",
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
                return savedTicket;
            }
            else {
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

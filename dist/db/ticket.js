"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const mongoose_2 = __importDefault(require("mongoose"));
// Define email sub-schemas to improve structure
const EmailFromSchema = new mongoose_1.Schema({
    name: String,
    email: {
        type: String,
        trim: true,
        lowercase: true,
    },
}, { _id: false });
const EmailToSchema = new mongoose_1.Schema({
    name: String,
    email: {
        type: String,
        trim: true,
        lowercase: true,
    },
}, { _id: false });
const EmailEntrySchema = new mongoose_1.Schema({
    id: {
        type: String,
        required: true,
    },
    preview: {
        type: String,
        required: false, // Optional field for email preview
    },
    weblink: String,
    emailType: String,
    timestamp: {
        type: Date,
    },
    from: {
        type: EmailFromSchema,
        required: true,
    },
    to: [EmailToSchema],
}, { _id: true }); // Keep _id for email entries for better reference
// Define schema for personnel info
const PersonnelSchema = new mongoose_1.Schema({
    id: {
        type: String,
        required: false,
    },
    name: {
        type: String,
        trim: true,
    },
    emailId: {
        type: String,
        trim: true,
        lowercase: true,
    },
}, { _id: false });
// Then update the schema
const ReplyEntrySchema = new mongoose_1.Schema({
    text: {
        type: String,
        required: true,
    },
    authorId: {
        type: String,
        required: true,
    },
    authorName: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, { _id: false });
const ReviewSchema = new mongoose_1.Schema({
    attitude: {
        type: Number,
        min: 1,
        max: 5,
        required: true,
    },
    knowledge: {
        type: Number,
        min: 1,
        max: 5,
        required: true,
    },
    speed: {
        type: Number,
        min: 1,
        max: 5,
        required: true,
    },
    reviewTitle: {
        type: String,
        required: false,
    },
    positiveText: {
        type: String,
        required: false,
    },
    negativeText: {
        type: String,
        required: false,
    },
    userRole: {
        type: String,
        required: false,
    },
    reviewDate: {
        type: Date,
        default: Date.now,
    },
    // New fields for replies and helpfulness
    replies: [ReplyEntrySchema],
    helpfulCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    notHelpfulCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    // Store who voted and how they voted in an efficient map structure
    voterIds: {
        type: Map,
        of: Boolean, // true = helpful, false = not helpful
        default: new Map(),
    },
}, { _id: true });
// Define the schema for the Ticket model
const TicketSchema = new mongoose_1.Schema({
    receivedDateTime: Date,
    sentDateTime: Date,
    pax: {
        type: Number,
        default: 0,
        min: 0,
    },
    companyName: {
        type: String,
        trim: true,
        lowercase: true,
        index: true,
    },
    cost: {
        type: Number,
        default: 0,
        min: 0,
    },
    destination: String,
    arrivalDate: Date,
    departureDate: Date,
    reservationInCharge: {
        type: PersonnelSchema,
    },
    salesInCharge: {
        type: PersonnelSchema,
    },
    travelAgent: {
        type: PersonnelSchema,
    },
    approvedBy: {
        type: PersonnelSchema,
    },
    market: String,
    status: {
        type: String,
    },
    estimateTimeToSendPrice: Number,
    waitingTime: {
        type: Number,
        min: 0,
    },
    speed: String,
    inbox: {
        type: Number,
        default: 0,
        min: 0,
    },
    sent: {
        type: Number,
        default: 0,
        min: 0,
    },
    lastMailTimeReceived: {
        type: Date,
    },
    lastMailTimeSent: {
        type: Date,
    },
    balance: Number,
    isApproved: {
        type: Boolean,
        default: false,
        index: true,
    },
    teamLead: {
        name: {
            type: String,
        },
        emailId: {
            type: String,
            trim: true,
            lowercase: true,
        },
    },
    review: ReviewSchema,
    createdBy: {
        type: PersonnelSchema,
    },
    email: [EmailEntrySchema],
}, {
    timestamps: true,
});
TicketSchema.statics.findByTicketNo = function (ticketNo) {
    return this.findOne({ ticketNo });
};
// Add virtual property for ticket age
TicketSchema.virtual("ticketAge").get(function () {
    return new Date().getTime() - this.createdAt.getTime();
});
// Create and export the Ticket model
const Ticket = (((_a = mongoose_2.default.models) === null || _a === void 0 ? void 0 : _a.Ticket) ||
    mongoose_2.default.model("Ticket", TicketSchema));
exports.default = Ticket;

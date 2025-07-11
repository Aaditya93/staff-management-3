"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const ExtraBedSchema = new mongoose_1.Schema({
    adult: {
        type: Number,
        min: 0,
    },
    child: {
        type: Number,
        min: 0,
    },
    childAgeRange: {
        type: String,
    },
}, { _id: false });
const SurchargeSchema = new mongoose_1.Schema({
    percentage: {
        type: Number,
        min: 0,
        max: 100,
    },
    date: [
        {
            type: String,
            trim: true,
        },
    ],
    description: {
        type: String,
        trim: true,
    },
});
const GalaDinnerSchema = new mongoose_1.Schema({
    adult: {
        type: Number,
        min: 0,
    },
    child: {
        type: Number,
        min: 0,
    },
    date: {
        type: String,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    childAgeRange: {
        type: String,
    },
}, { _id: false });
const HotelSchema = new mongoose_1.Schema({
    supplierId: {
        type: String,
        trim: true,
        ref: "Supplier",
    },
    currency: {
        type: String,
    },
    season: {
        type: String,
        trim: true,
    },
    maxOccupancy: {
        type: String,
        trim: true,
    },
    breakfast: {
        child: {
            type: Number,
            trim: true,
        },
        adult: {
            type: Number,
            trim: true,
        },
        childAgeRange: {
            type: String,
            trim: true,
        },
    },
    fullBoard: {
        child: {
            type: Number,
        },
        adult: {
            type: Number,
            trim: true,
        },
        childAgeRange: {
            type: String,
            trim: true,
        },
    },
    halfBoard: {
        child: {
            type: Number,
            trim: true,
        },
        adult: {
            type: Number,
            trim: true,
        },
        childAgeRange: {
            type: String,
            trim: true,
        },
    },
    allInclusive: {
        child: {
            type: Number,
            trim: true,
        },
        adult: {
            type: Number,
            trim: true,
        },
        childAgeRange: {
            type: String,
            trim: true,
        },
    },
    markets: {
        type: [String],
        trim: true,
    },
    childPolicies: {
        type: [String],
        trim: true,
    },
    hotelName: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    vat: {
        type: Number,
        default: 0,
    },
    surcharge: {
        type: [SurchargeSchema],
        default: [],
    },
    starsCategory: {
        type: Number,
        required: true,
        trim: true,
        index: true,
    },
    country: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    city: {
        type: String,
        required: true,
        trim: true,
    },
    category: {
        type: String,
        trim: true,
    },
    cancellationPolicys: {
        type: [String],
        trim: true,
    },
    fromDate: {
        type: Date,
    },
    toDate: {
        type: Date,
    },
    inboundPrice: {
        type: Number,
        index: true,
        min: 0,
    },
    domesticPrice: {
        type: Number,
        index: true,
        min: 0,
    },
    fitPrice: {
        type: Number,
        index: true,
        min: 0,
    },
    gitPrice: {
        type: Number,
        index: true,
        min: 0,
    },
    fitGitCondition: {
        type: String,
        trim: true,
    },
    extraBed: {
        type: ExtraBedSchema,
    },
    meals: {
        type: String,
        trim: true,
    },
    noofChildren: {
        type: Number,
        min: 0,
    },
    galaDinner: {
        type: [GalaDinnerSchema],
        default: [],
        trim: true,
    },
    promotions: {
        type: [String],
        default: [],
        trim: true,
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
    reservationEmail: {
        type: String,
        trim: true,
    },
    ratings: [
        {
            userId: {
                type: String,
                required: true,
                ref: "User",
            },
            score: {
                type: Number,
                min: 1,
                max: 5,
                required: true,
            },
        },
    ],
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
const Hotel = mongoose_1.default.models.Hotel || mongoose_1.default.model("Hotel", HotelSchema);
exports.default = Hotel;

"use strict";
"use server";
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
exports.createHotels = void 0;
const db_1 = __importDefault(require("../db/db"));
const hotel_1 = __importDefault(require("../db/hotel"));
function parseDDMMYYYY(dateStr) {
    if (!dateStr)
        return undefined;
    const [day, month, year] = dateStr.split("-");
    if (!day || !month || !year)
        return undefined;
    // Month is 0-indexed in JS Date
    return new Date(Number(year), Number(month) - 1, Number(day));
}
const createHotels = (input) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        if (!input || !input.hotels || !Array.isArray(input.hotels)) {
            return {
                success: false,
                message: "Input with a non-empty 'hotels' array is required.",
            };
        }
        yield (0, db_1.default)();
        const { hotels, supplierId, country, city, currency, createdBy } = input;
        if (!hotels || !Array.isArray(hotels) || hotels.length === 0) {
            return {
                success: false,
                message: "Hotels array is required and cannot be empty",
            };
        }
        let newRecords = 0;
        let updatedRecords = 0;
        const errors = [];
        console.log(hotels);
        for (const hotelData of hotels) {
            try {
                // Prepare hotel document - each record represents one room category
                const hotelDocument = {
                    supplierId: supplierId || hotelData.supplierId,
                    hotelName: hotelData.hotelName.trim(),
                    starsCategory: hotelData.starsCategory,
                    country: country || hotelData.country || "-",
                    city: city || hotelData.city || "-",
                    category: hotelData.category.trim(),
                    fromDate: parseDDMMYYYY(hotelData.fromDate.trim()),
                    toDate: parseDDMMYYYY(hotelData.toDate.trim()),
                    inboundPrice: hotelData.inboundPrice,
                    domesticPrice: hotelData.domesticPrice,
                    fitPrice: hotelData.fitPrice,
                    gitPrice: hotelData.gitPrice,
                    fitGitCondition: hotelData.fitGitCondition,
                    currency: currency || hotelData.currency,
                    reservationEmail: hotelData.reservationEmail,
                    extraBed: {
                        adult: (_a = hotelData.extraBed) === null || _a === void 0 ? void 0 : _a.adult,
                        child: (_b = hotelData.extraBed) === null || _b === void 0 ? void 0 : _b.child,
                        childAgeRange: (_c = hotelData.extraBed) === null || _c === void 0 ? void 0 : _c.childAgeRange,
                    },
                    allInclusive: hotelData.allInclusive
                        ? {
                            child: hotelData.allInclusive.child,
                            adult: hotelData.allInclusive.adult,
                            childAgeRange: hotelData.allInclusive.childAgeRange,
                        }
                        : undefined,
                    fullBoard: hotelData.fullBoard
                        ? {
                            child: hotelData.fullBoard.child,
                            adult: hotelData.fullBoard.adult,
                            childAgeRange: hotelData.fullBoard.childAgeRange,
                        }
                        : undefined,
                    halfBoard: hotelData.halfBoard
                        ? {
                            child: hotelData.halfBoard.child,
                            adult: hotelData.halfBoard.adult,
                            childAgeRange: hotelData.halfBoard.childAgeRange,
                        }
                        : undefined,
                    breakfast: hotelData.breakfast
                        ? {
                            child: hotelData.breakfast.child,
                            adult: hotelData.breakfast.adult,
                            childAgeRange: hotelData.breakfast.childAgeRange,
                            noofChildren: hotelData.breakfast.noofChildren,
                        }
                        : undefined,
                    season: hotelData.season,
                    maxOccupancy: hotelData.maxOccupancy,
                    childPolicies: hotelData.childPolicies,
                    markets: hotelData.markets,
                    cancellationPolicys: hotelData.cancellationPolicys,
                    meals: hotelData.meals,
                    galaDinner: hotelData.galaDinner,
                    promotions: hotelData.promotions || [],
                    vat: hotelData.vat || undefined,
                    surcharge: hotelData.surcharge || [],
                    isActive: true,
                    createdBy: createdBy
                };
                // Create new hotel room category record
                const result = yield hotel_1.default.create(hotelDocument);
                console.log("Created hotel record:", result);
                newRecords++;
            }
            catch (error) {
                console.error(`Error processing hotel ${hotelData.hotelName} - ${hotelData.category}:`, error);
                errors.push(`Hotel: ${hotelData.hotelName} - ${hotelData.category}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        const totalProcessed = newRecords + updatedRecords;
        if (totalProcessed === 0 && errors.length > 0) {
            return {
                success: false,
                message: `All hotel entries failed. First few errors: ${errors
                    .slice(0, 3)
                    .join(", ")}`,
                data: {
                    totalProcessed: 0,
                    newRecords: 0,
                    updatedRecords: 0,
                },
            };
        }
        return {
            success: true,
            message: `Successfully processed ${totalProcessed} hotel room categories. New: ${newRecords}, Updated: ${updatedRecords}${errors.length > 0 ? `, Errors: ${errors.length}` : ""}`,
            data: {
                totalProcessed,
                newRecords,
                updatedRecords,
            },
        };
    }
    catch (error) {
        console.error("Error in createHotels:", error);
        return {
            success: false,
            message: "Failed to process hotel data",
        };
    }
});
exports.createHotels = createHotels;

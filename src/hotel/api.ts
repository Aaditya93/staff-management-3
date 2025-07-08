"use server";

import dbConnect from "../db/db";
import Hotel from "../db/hotel";

export interface ExtraBedData {
  adult: number;
  breakfastWithoutExtraBed?: number; // Optional, can be added later
  child: number;
}

export interface GalaDinnerData {
  adult?: number;
  child?: number;
  date?: string;
  childAgeRange?: string;
}
function parseDDMMYYYY(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;
  const [day, month, year] = dateStr.split("-");
  if (!day || !month || !year) return undefined;
  // Month is 0-indexed in JS Date
  return new Date(Number(year), Number(month) - 1, Number(day));
}
export interface SurchargeData {
  percentage: number; // e.g., 10 for 10%
  date: string[]; // e.g., ["2023-12-25", "2023-12-31"]
  reason: string; // e.g., "Holiday surcharge"
}

// Updated interface to include VAT and surcharge
export interface HotelData {
  hotelName: string;
  starsCategory: number;
  country?: string;
  city?: string;
  category: string;
  fromDate: string;
  toDate: string;
  price: number;
  currency?: string;
  extraBed: ExtraBedData;
  meals: string;
  galaDinner?: GalaDinnerData;
  promotions?: string[];
  vat?: number; // Optional VAT percentage
  surcharge?: SurchargeData[]; // Optional surcharge array
  supplierId?: string;
}

export interface CreateHotelsInput {
  hotels: HotelData[];
  supplierId?: string;
  country?: string;
  city?: string;
  currency?: string;
  createdBy?: string; // Optional, can be used for tracking
}

export interface CreateHotelsResult {
  success: boolean;
  message: string;
  data?: {
    totalProcessed: number;
    newRecords: number;
    updatedRecords: number;
  };
}

export const createHotels = async (
  input: CreateHotelsInput
): Promise<CreateHotelsResult> => {
  try {
    if (!input || !input.hotels || !Array.isArray(input.hotels)) {
      return {
        success: false,
        message: "Input with a non-empty 'hotels' array is required.",
      };
    }

    await dbConnect();

    const { hotels, supplierId, country, city, currency, createdBy } = input;

    if (!hotels || !Array.isArray(hotels) || hotels.length === 0) {
      return {
        success: false,

        message: "Hotels array is required and cannot be empty",
      };
    }

    let newRecords = 0;
    let updatedRecords = 0;
    const errors: string[] = [];

    for (const hotelData of hotels) {
      try {
        // Prepare hotel document - each record represents one room category
        const hotelDocument = {
          supplierId: supplierId || hotelData.supplierId,
          hotelName: hotelData.hotelName.trim(),
          starsCategory: hotelData.starsCategory,
          country: country || hotelData.country || "Unknown",
          city: city || hotelData.city || "Unknown",
          category: hotelData.category.trim(),
          fromDate: parseDDMMYYYY(hotelData.fromDate.trim()),
          toDate: parseDDMMYYYY(hotelData.toDate.trim()),
          price: hotelData.price,
          currency: currency || hotelData.currency,
          extraBed: {
            breakfastWithoutExtraBed:
              hotelData.extraBed?.breakfastWithoutExtraBed || 0,
            adult: hotelData.extraBed?.adult || 0,
            child: hotelData.extraBed?.child || 0,
          },
          meals: hotelData.meals,
          galaDinner: hotelData.galaDinner,
          promotions: hotelData.promotions || [],
          vat: hotelData.vat || undefined,
          surcharge: hotelData.surcharge || [],
          isActive: true,
          createdBy: createdBy 
        };

        // Create new hotel room category record
        const result = await Hotel.create(hotelDocument);
 

        newRecords++;
      } catch (error) {
        console.error(
          `Error processing hotel ${hotelData.hotelName} - ${hotelData.category}:`,
          error
        );
        errors.push(
          `Hotel: ${hotelData.hotelName} - ${hotelData.category}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
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
      message: `Successfully processed ${totalProcessed} hotel room categories. New: ${newRecords}, Updated: ${updatedRecords}${
        errors.length > 0 ? `, Errors: ${errors.length}` : ""
      }`,
      data: {
        totalProcessed,
        newRecords,
        updatedRecords,
      },
    };
  } catch (error) {
    console.error("Error in createHotels:", error);
    return {
      success: false,
      message: "Failed to process hotel data",
    };
  }
};

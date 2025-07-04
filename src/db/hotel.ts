import mongoose, { Document, Schema, Model } from "mongoose";

export interface IExtraBed {
  adult: number;
  child: number;
  breakfastWithoutExtraBed?: number; // Optional, can be added later
}

export interface IGalaDinner {
  adult?: number;
  child?: number;
  date?: string;
  childAgeRange?: string; // e.g., "0-12 years"
}

export interface ISurcharge {
  percentage: number; // e.g., 10 for 10%
  date: string[]; // e.g., ["2023-12-25", "2023-12-31"]
  descirption: string; // e.g., "Holiday surcharge"
}

export interface IHotel extends Document {
  supplierId?: string;
  hotelName: string;
  market: string; // e.g., "Europe", "Asia"
  starsCategory: number;
  country: string;
  vat?: number; // Optional, can be added later
  surcharge?: ISurcharge[];
  currency: string; // Optional, can be added later
  city: string;
  category: string;
  fromDate: string;
  toDate: string;
  price: number;
  extraBed: IExtraBed;
  meals: string;
  galaDinner?: IGalaDinner;
  promotions: string[];
  isActive?: boolean;

  ratings?: Array<{
    userId: string;
    score: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const ExtraBedSchema = new Schema(
  {
    adult: {
      type: Number,

      min: 0,
    },
    child: {
      type: Number,

      min: 0,
    },
    breakfastWithoutExtraBed: {
      type: Number,
      default: false,
    },
  },
  { _id: false }
);
const SurchargeSchema = new Schema({
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

const GalaDinnerSchema = new Schema(
  {
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
    childAgeRange: {
      type: String,
    },
  },
  { _id: false }
);

const HotelSchema: Schema = new Schema(
  {
    supplierId: {
      type: String,
      trim: true,

      ref: "Supplier",
    },
    currency: {
      type: String,
    },
    // market: {
    //   type: String,
    //   required: true,
    //   trim: true,
    //   index: true,
    // },
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
    fromDate: {
      type: Date,
    },
    toDate: {
      type: Date,
    },
    price: {
      type: Number,

      min: 0,
    },
    extraBed: {
      type: ExtraBedSchema,
    },
    meals: {
      type: String,
      trim: true,
    },
    galaDinner: {
      type: GalaDinnerSchema,
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const Hotel: Model<IHotel> =
  mongoose.models.Hotel || mongoose.model<IHotel>("Hotel", HotelSchema);

export default Hotel;

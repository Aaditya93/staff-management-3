"use server";
import mongoose, { Document, Model, Schema } from "mongoose";
import dbConnect from "./db";
// Create schema
export interface ITravelAgentUser extends Document {
  id: string;
  name: string;
  email: string;
  password: string;
  company: string;
  country: string;
  address: string;
  phoneNumber: string;
  accountApproved: boolean;
  code: string;
  district: string;
  city: string;
  reservationInCharge: string;
  salesInCharge: string;
  employees: {
    id: string;
    name: string;
    email: string;
  }[];
  staff: {
    name: string;
    email: string;
    phone: string;
    review: number;
  }[]; // Added staff field to interface
  staffSize: number;
  destination: string[];
  office: string;
  language: string[];
  market: string[];
}

const TravelAgentUserSchema = new Schema<ITravelAgentUser>(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    password: {
      type: String,
    },
    company: {
      type: String,
    },
    country: {
      type: String,
    },
    address: {
      type: String,
    },
    phoneNumber: {
      type: String,
    },
    accountApproved: {
      type: Boolean,
    },
    reservationInCharge: {
      type: String,
      ref: "User",
    },
    salesInCharge: {
      type: String,
      ref: "User",
    },
    code: {
      type: String,
    },
    district: {
      type: String,
    },
    city: {
      type: String,
    },
    staffSize: {
      type: Number,
    },
    destination: {
      type: [String],
      default: [],
    },
    office: {
      type: String,
    },
    language: {
      type: [String],
      default: [],
    },
    market: {
      type: [String],
      default: [],
    },
    employees: [
      {
        id: {
          type: String,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        email: {
          type: String,
          required: true,
        },
      },
    ],
    staff: [
      {
        name: {
          type: String,
          required: true,
        },
        email: {
          type: String,
          required: true,
        },
        phone: {
          type: String,
          required: true,
        },
        review: {
          type: Number,
          default: 0,
        },
      },
    ], // Fixed: Added staff field properly inside schema
  },
  { timestamps: true }
);

const TravelAgentUser: Model<ITravelAgentUser> =
  mongoose.models.TravelAgentUser ||
  mongoose.model<ITravelAgentUser>("TravelAgentUser", TravelAgentUserSchema);

export default TravelAgentUser;

export const getTravelAgentUserByEmail = async (email: string) => {
  try {
    await dbConnect();
    const user = await TravelAgentUser.findOne({ email }).lean();

    return user;
  } catch (error) {
    console.error("Error while getting user by email:", error);
    return null;
  }
};

export const createTravelAgentUser = async (
  name: string,
  email: string,
  company: string // Added missing required field
) => {
  // Corrected syntax: removed space and '>'
  try {
    await dbConnect();
    const newUser = new TravelAgentUser({
      name,
      email,

      company, // Added missing required field
    });
    const savedUser = await newUser.save();
    return savedUser;
  } catch (error) {
    console.error("Error while creating user:", error);

    return null;
  }
  // Removed unnecessary closing brace and empty lines
};

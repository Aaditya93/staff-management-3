import mongoose, { Document, Model, Schema } from "mongoose";
import dbConnect from "./db";

export interface ITravelAgentUser extends Document {
  id: string;
  name: string;
  email: string;
  password: string;
  company: string;
  country: string;
  address: string;
  market: string;
  phoneNumber: string;
}

// Create schema
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
  company: string
) => {
  try {
    await dbConnect();
    const newUser = new TravelAgentUser({
      name,
      email,

      company,
    });
    const savedUser = await newUser.save();
    return savedUser;
  } catch (error) {
    console.error("Error while creating user:", error);

    return null;
  }
};

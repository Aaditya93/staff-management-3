import mongoose from "mongoose";

import dbConnect from "./db";
const accountSchema = new mongoose.Schema(
  {
    accessToken: String,
    refreshToken: String,
    expiresAt: Number,
    email: String,
    provider: String,
    emailUpdatedAt: Date,
  },
  { _id: true }
);
const userSchema = new mongoose.Schema(
  {
    name: String,
    email: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    password: {
      type: String,
    },
    role: {
      type: String,
      required: true,
      index: true,
    },
    office: {
      type: String,
    },
    rating: {
      type: Number,
      default: 0,
    },
    position: {
      type: String,
    },
    accounts: [accountSchema],
    travelAgentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TravelAgentUser",
    },
    country: String,
    provider: String,
    image: String,
    backgroundImage: String,

    emailVerified: Date,
  },
  { timestamps: true }
);

const User = (mongoose.models?.User ||
  mongoose.model("User", userSchema)) as ReturnType<typeof mongoose.model<any>>;

export default User;

export async function getUserById(id: string) {
  try {
    await dbConnect();
    const user = await User.findById(id).lean();

    return user;
  } catch (error) {
    console.error("Error while getting user by ID:", error);
    return null;
  }
}

export async function getUserByEmail(email: string) {
  try {
    await dbConnect();
    const user = await User.findOne({ email });
    return user;
  } catch (error) {
    console.error("Error while getting user by ID:", error);
    return null;
  }
}
export async function emailVerified(id: string) {
  try {
    await dbConnect();
    const user = await User.findByIdAndUpdate(
      id,
      { emailVerified: new Date() },
      { new: true }
    );

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  } catch (error) {
    console.error("Error verifying email:", error);
    throw error;
  }
}

export const getAllUsers = async () => {
  try {
    await dbConnect();
    const users = await User.find({ role: "ReservationStaff" }).lean();
    return users;
  } catch (error) {
    console.error("Error while getting all users:", error);
    return [];
  }
};

export const updateUserEmailTimestamp = async (id: string, email: string) => {
  try {
    await dbConnect();

    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        $set: {
          [`accounts.$[elem].emailUpdatedAt`]: new Date(),
        },
      },
      {
        arrayFilters: [{ "elem.email": email }],
        new: true,
        lean: true,
      }
    );
    console.log("User Updated");

    if (!updatedUser) {
      throw new Error(`User with ID ${id} not found`);
    }
    console.log("Updated User", updatedUser);

    return updatedUser;
  } catch (error) {
    console.error("Error updating user email timestamp:", error);
    throw error;
  }
};

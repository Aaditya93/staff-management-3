import mongoose, { Document, Schema, Model } from "mongoose";

export interface IHotelRequest extends Document {
  _id: string;
  isComplete: boolean;

  createdBy: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const HotelRequestSchema: Schema = new Schema(
  {
  
    isComplete: {
      type: Boolean,
      default: false,
    },
   
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const HotelRequest: Model<IHotelRequest> =
  mongoose.models.HotelRequest || mongoose.model<IHotelRequest>("HotelRequest", HotelRequestSchema);

export default HotelRequest;
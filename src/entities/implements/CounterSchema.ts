import { Schema, model } from "mongoose";

const CounterSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    collection: "Counter",
    timestamps: false,
  }
);

export const CounterModel = model("Counter", CounterSchema);

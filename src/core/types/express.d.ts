import { Express } from "express";

declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
      files?: Express.Multer.File[];
      user?: any; // You can replace 'any' with a more specific type based on your user model
      plan?: any; // You can replace 'any' with a more specific type based on your subscription plan model
      features?: string[]; // Array of feature names from the subscription plan
    }
  }
}

export {};
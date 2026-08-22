import { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const errors: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError)
    return res.status(error.status).json({ message: error.message });
  if (error instanceof ZodError)
    return res.status(400).json({
      message: "Validation failed",
      errors: error.flatten().fieldErrors,
    });
  if (error?.name === "MulterError")
    return res.status(400).json({
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "File exceeds the 10 MB limit"
          : "Invalid file upload",
    });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002")
      return res
        .status(409)
        .json({ message: "A record with these unique details already exists" });
    if (error.code === "P2003")
      return res
        .status(400)
        .json({ message: "A referenced record does not exist" });
  }
  console.error(error);
  return res.status(500).json({ message: "Unexpected server error" });
};

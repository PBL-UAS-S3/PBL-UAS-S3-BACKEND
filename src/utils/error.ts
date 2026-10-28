import { Response } from "express";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function kirimError(res: Response, err: any) {
  res.status(err.status || 500).json({ error: err.message });
}
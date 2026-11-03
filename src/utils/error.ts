import { Response } from "express";

export class HttpError extends Error {
  status: number;
  kode?: string;
  constructor(status: number, message: string, kode?: string) {
    super(message);
    this.status = status;
    this.kode = kode;
  }
}

export function kirimError(res: Response, err: any) {
  res.status(err.status || 500).json({ error: err.message, kode: err.kode });
}
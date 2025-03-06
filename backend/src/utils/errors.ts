import { AppErrorCode } from "../utils/constants";
import { HttpStatusCode } from "../utils/constants";

//app error
export class AppError extends Error {
	constructor(
		public statusCode: HttpStatusCode,
		public message: string,
		public errorCode?: AppErrorCode
	) {
		super(message);
	}
}

//catch error
import { Request, Response, NextFunction } from "express";

type AsyncController = (
	req: Request,
	res: Response,
	next: NextFunction
) => Promise<any>;

export const catchErrors =
	(controller: AsyncController): AsyncController =>
	async (req, res, next) => {
		try {
			await controller(req, res, next);
		} catch (error) {
			// pass error on
			next(error);
		}
	};

import { Response, ErrorRequestHandler } from "express";
import { z } from "zod";
import { REFRESH_PATH, clearAuthCookies } from "../utils/cookies";

const handleZodError = (res: Response, error: z.ZodError) => {
	const errors = error.issues.map((err) => ({
		path: err.path.join("."),
		message: err.message,
	}));

	return res.status(400).json({
		errors,
		message: error.message,
	});
};

const handleAppError = (res: Response, error: any) => {
	return res.status(error.statusCode).json({
		message: error.message,
		errorCode: error.errorCode,
	});
};

const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
	console.log(`PATH ${req.path}`, error);

	if (req.path === REFRESH_PATH) {
		clearAuthCookies(res);
	}

	if (error instanceof z.ZodError) {
		return handleZodError(res, error);
	}

	if (error instanceof Error) {
		return handleAppError(res, error);
	}

	return res.status(500).send("Internal server error");
};

export default errorHandler;

import assert from "node:assert";
import { AppError } from "./errors";
import { HttpStatusCode } from "../utils/constants";
import { AppErrorCode } from "../utils/constants";

type AppAssert = (
	condition: any,
	httpStatusCode: HttpStatusCode,
	message: string,
	appErrorCode?: AppErrorCode
) => asserts condition;
/**
 * Asserts a condition and throws an AppError if the condition is falsy.
 */
const appAssert: AppAssert = (
	condition,
	httpStatusCode,
	message,
	appErrorCode
) => assert(condition, new AppError(httpStatusCode, message, appErrorCode));

export default appAssert;

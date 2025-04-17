import { Request, Response } from "express";
import bcrypt from "bcrypt";
import {
	VerificationCodeType,
	ONE_DAY_MS,
	fiveMinutesAgo,
	oneHourFromNow,
	oneYearFromNow,
	thirtyDaysFromNow,
	getPasswordResetTemplate,
	getVerifyEmailTemplate,
} from "../utils/constants";
import SessionModel from "../models/session.model";
import UserModel from "../models/user.model";
import VerificationCodeModel from "../models/verificationCode.model";
import {
	clearAuthCookies,
	getAccessTokenCookieOptions,
	getRefreshTokenCookieOptions,
	setAuthCookies,
} from "../utils/cookies";
import {
	signToken,
	verifyToken,
	refreshTokenSignOptions,
	RefreshTokenPayload,
} from "../utils/jwt";
import { sendMail } from "../utils/sendMail";
import {
	emailSchema,
	loginSchema,
	registerSchema,
	resetPasswordSchema,
	verificationCodeSchema,
} from "./auth.schemas";

export const registerHandler = async (req: Request, res: Response) => {
	try {
		const request = registerSchema.parse({
			...req.body,
			userAgent: req.headers["user-agent"],
		});

		const existingUser = await UserModel.exists({ email: request.email });
		if (existingUser) {
			return res.status(409).json({ message: "Email already in use" });
		}

		const user = await UserModel.create({
			email: request.email,
			password: request.password,
		});

		const verificationCode = await VerificationCodeModel.create({
			userId: user._id,
			type: VerificationCodeType.EmailVerification,
			expiresAt: oneYearFromNow(),
		});

		const url = `${process.env.APP_ORIGIN}/email/verify/${verificationCode._id}`;
		const { error } = await sendMail({
			to: user.email,
			...getVerifyEmailTemplate(url),
		});
		if (error) console.error(error);

		const session = await SessionModel.create({
			userId: user._id,
			userAgent: request.userAgent,
		});

		const refreshToken = signToken(
			{ sessionId: session._id },
			refreshTokenSignOptions
		);
		const accessToken = signToken({
			userId: user._id,
			sessionId: session._id,
		});

		return setAuthCookies({ res, accessToken, refreshToken })
			.status(200)
			.json(user.omitPassword());
	} catch (error: any) {
		console.error(error);
		return res.status(500).json({ message: "Internal Server Error" });
	}
};

export const loginHandler = async (req: Request, res: Response) => {
	try {
		const request = loginSchema.parse({
			...req.body,
			userAgent: req.headers["user-agent"],
		});

		const user = await UserModel.findOne({ email: request.email });
		if (!user || !(await user.comparePassword(request.password))) {
			return res.status(401).json({ message: "Invalid email or password" });
		}

		const session = await SessionModel.create({
			userId: user._id,
			userAgent: request.userAgent,
		});

		const refreshToken = signToken(
			{ sessionId: session._id },
			refreshTokenSignOptions
		);
		const accessToken = signToken({
			userId: user._id,
			sessionId: session._id,
		});

		return setAuthCookies({ res, accessToken, refreshToken })
			.status(200)
			.json({ message: "Login successful" });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Internal Server Error" });
	}
};

export const logoutHandler = async (req: Request, res: Response) => {
	try {
		const accessToken = req.cookies.accessToken as string | undefined;
		const { payload } = verifyToken(accessToken || "");

		if (payload) {
			await SessionModel.findByIdAndDelete(payload.sessionId);
		}

		return clearAuthCookies(res)
			.status(200)
			.json({ message: "Logout successful" });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Internal Server Error" });
	}
};

export const refreshHandler = async (req: Request, res: Response) => {
	try {
		const refreshToken = req.cookies.refreshToken as string | undefined;
		if (!refreshToken) {
			return res.status(401).json({ message: "Missing refresh token" });
		}

		const { payload } = verifyToken<RefreshTokenPayload>(refreshToken, {
			secret: refreshTokenSignOptions.secret,
		});

		if (!payload) {
			return res.status(401).json({ message: "Invalid refresh token" });
		}

		const session = await SessionModel.findById(payload.sessionId);
		const now = Date.now();

		if (!session || session.expiresAt.getTime() <= now) {
			return res.status(401).json({ message: "Session expired" });
		}

		const sessionNeedsRefresh = session.expiresAt.getTime() - now <= ONE_DAY_MS;
		if (sessionNeedsRefresh) {
			session.expiresAt = thirtyDaysFromNow();
			await session.save();
		}

		const newRefreshToken = sessionNeedsRefresh
			? signToken({ sessionId: session._id }, refreshTokenSignOptions)
			: undefined;

		const accessToken = signToken({
			userId: session.userId,
			sessionId: session._id,
		});

		if (newRefreshToken) {
			res.cookie(
				"refreshToken",
				newRefreshToken,
				getRefreshTokenCookieOptions()
			);
		}

		return res
			.status(200)
			.cookie("accessToken", accessToken, getAccessTokenCookieOptions())
			.json({ message: "Access token refreshed" });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Internal Server Error" });
	}
};

export const verifyEmailHandler = async (req: Request, res: Response) => {
	try {
		const verificationCode = verificationCodeSchema.parse(req.params.code);

		const validCode = await VerificationCodeModel.findOne({
			_id: verificationCode,
			type: VerificationCodeType.EmailVerification,
			expiresAt: { $gt: new Date() },
		});

		if (!validCode) {
			return res
				.status(404)
				.json({ message: "Invalid or expired verification code" });
		}

		const updatedUser = await UserModel.findByIdAndUpdate(
			validCode.userId,
			{ verified: true },
			{ new: true }
		);

		if (!updatedUser) {
			return res.status(500).json({ message: "Failed to verify email" });
		}

		await validCode.deleteOne();
		return res.status(200).json({ message: "Email was successfully verified" });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Internal Server Error" });
	}
};

export const sendPasswordResetHandler = async (req: Request, res: Response) => {
	try {
		const email = emailSchema.parse(req.body.email);

		const user = await UserModel.findOne({ email });
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		const fiveMinAgo = fiveMinutesAgo();
		const count = await VerificationCodeModel.countDocuments({
			userId: user._id,
			type: VerificationCodeType.PasswordReset,
			createdAt: { $gt: fiveMinAgo },
		});

		if (count >= 1) {
			return res
				.status(429)
				.json({ message: "Too many requests, please try again later" });
		}

		const expiresAt = oneHourFromNow();
		const verificationCode = await VerificationCodeModel.create({
			userId: user._id,
			type: VerificationCodeType.PasswordReset,
			expiresAt,
		});

		const url = `${process.env.APP_ORIGIN}/password/reset?code=${
			verificationCode._id
		}&exp=${expiresAt.getTime()}`;
		const { data, error } = await sendMail({
			to: email,
			...getPasswordResetTemplate(url),
		});

		if (!data?.id) {
			return res
				.status(500)
				.json({ message: `${error?.name} - ${error?.message}` });
		}

		return res.status(200).json({ message: "Password reset email sent" });
	} catch (error: any) {
		console.error("SendPasswordResetError:", error.message);
		return res.status(500).json({ message: "Internal Server Error" });
	}
};

export const resetPasswordHandler = async (req: Request, res: Response) => {
	try {
		const request = resetPasswordSchema.parse(req.body);

		const validCode = await VerificationCodeModel.findOne({
			_id: request.verificationCode,
			type: VerificationCodeType.PasswordReset,
			expiresAt: { $gt: new Date() },
		});

		if (!validCode) {
			return res
				.status(404)
				.json({ message: "Invalid or expired verification code" });
		}

		const updatedUser = await UserModel.findByIdAndUpdate(validCode.userId, {
			password: await bcrypt.hash(request.password, 10),
		});

		if (!updatedUser) {
			return res.status(500).json({ message: "Failed to reset password" });
		}

		await validCode.deleteOne();
		await SessionModel.deleteMany({ userId: validCode.userId });

		return clearAuthCookies(res)
			.status(200)
			.json({ message: "Password was reset successfully" });
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Internal Server Error" });
	}
};

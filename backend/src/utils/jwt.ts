import jwt, { VerifyOptions, SignOptions } from "jsonwebtoken";
import { UserDocument } from "../models/user.model";
import { SessionDocument } from "../models/session.model";

export type RefreshTokenPayload = {
	sessionId: SessionDocument["_id"];
};

export type AccessTokenPayload = {
	userId: UserDocument["_id"];
	sessionId: SessionDocument["_id"];
};

type SignOptionsAndSecret = SignOptions & {
	secret: string;
};

const defaults: SignOptions = {
	audience: ["User"],
};

const accessTokenSignOptions: SignOptionsAndSecret = {
	expiresIn: "15m",
	secret: process.env.JWT_SECRET || "",
};

export const refreshTokenSignOptions: SignOptionsAndSecret = {
	expiresIn: "30d",
	secret: process.env.JWT_REFRESH_SECRET || "",
};

export const signToken = (
	payload: AccessTokenPayload | RefreshTokenPayload,
	options?: SignOptionsAndSecret
) => {
	const { secret, ...signOpts } = options || accessTokenSignOptions;
	return jwt.sign(payload, secret, {
		...defaults,
		...signOpts,
	});
};

export const verifyToken = <TPayload extends object = AccessTokenPayload>(
	token: string,
	options?: VerifyOptions & {
		secret?: string;
	}
) => {
	const { secret = process.env.JWT_SECRET || "", ...verifyOpts } =
		options || {};

	try {
		const payload = jwt.verify(token, secret, {
			...defaults,
			...verifyOpts,
		}) as TPayload;
		return {
			payload,
		};
	} catch (error: any) {
		return {
			error: error.message,
		};
	}
};

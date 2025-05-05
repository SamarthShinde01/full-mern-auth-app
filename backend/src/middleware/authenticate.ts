import { RequestHandler } from "express";
import { verifyToken } from "../utils/jwt";
import { InvalidAccessToken, UNAUTHORIZED } from "../utils/constants";

const authenticate: RequestHandler = (req, res, next) => {
	try {
		const accessToken = req.cookies.accessToken as string | undefined;

		if (!accessToken) {
			return res
				.status(UNAUTHORIZED)
				.json({ message: "Not authorized", errorCode: InvalidAccessToken });
		}

		const { payload } = verifyToken(accessToken);

		if (!payload) {
			return res
				.status(UNAUTHORIZED)
				.json({ message: "Invalid token", errorCode: InvalidAccessToken });
		}

		req.userId = payload.userId;
		req.sessionId = payload.sessionId;
		next();
	} catch (error) {
		return res.status(404).json({ error });
	}
};

export default authenticate;

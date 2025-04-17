import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt";

const authenticate = (req: Request, res: Response, next: NextFunction) => {
	try {
		const accessToken = req.cookies.accessToken as string | undefined;

		if (!accessToken) {
			return res.status(401).json({ message: "Not authorized" });
		}

		const { payload } = verifyToken(accessToken);

		if (!payload) {
			return res.status(401).json({ message: "Invalid token" });
		}

		req.userId = payload.userId;
		req.sessionId = payload.sessionId;
		next();
	} catch (error) {
		return res.status(404).json({ error });
	}
};

export default authenticate;

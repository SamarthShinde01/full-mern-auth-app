import { z } from "zod";
import SessionModel from "../models/session.model";
import { Request, Response } from "express";

export const getSessionsHandler = async (req: Request, res: Response) => {
	try {
		const sessions = await SessionModel.find(
			{
				userId: req.userId,
				expiresAt: { $gt: Date.now() },
			},
			{
				_id: 1,
				userAgent: 1,
				createdAt: 1,
			},
			{
				sort: { createdAt: -1 },
			}
		);

		return res.status(200).json(
			sessions.map((session) => ({
				...session.toObject(),
				...(session.id === req.sessionId && {
					isCurrent: true,
				}),
			}))
		);
	} catch (error) {
		console.error("Error in getSessionsHandler:", error);
		return res.status(500).json({ message: "Internal Server Error" });
	}
};

export const deleteSessionHandler = async (req: Request, res: Response) => {
	try {
		const sessionId = z.string().parse(req.params.id);

		const deleted = await SessionModel.findOneAndDelete({
			_id: sessionId,
			userId: req.userId,
		});

		if (!deleted) {
			return res.status(404).json({ message: "Session not found" });
		}

		return res.status(200).json({ message: "Session removed" });
	} catch (error) {
		console.error("Error in deleteSessionHandler:", error);
		return res.status(500).json({ message: "Internal Server Error" });
	}
};

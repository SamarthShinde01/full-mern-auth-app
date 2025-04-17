import { Request, Response } from "express";
import UserModel from "../models/user.model";

export const getUserHandler = async (req: Request, res: Response) => {
	try {
		const user = await UserModel.findById(req.userId);
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		return res.status(200).json(user.omitPassword());
	} catch (error) {
		return res.status(404).json({ error });
	}
};

import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectToDatabase from "./config/db";
import errorHandler from "./middleware/errorHandler";
import authenticate from "./middleware/authenticate";
import authRoutes from "./routes/auth.route";
import userRoutes from "./routes/user.route";
import sessionRoutes from "./routes/session.route";

const app = express();
const PORT = process.env.PORT;

// add middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
	cors({
		origin: process.env.APP_ORIGIN,
		credentials: true,
	})
);
app.use(cookieParser());

// health check
app.get("/", (_, res) => {
	return res.status(200).json({
		status: "healthy",
	});
});

// auth routes
app.use("/auth", authRoutes);

// protected routes
app.use("/user", authenticate, userRoutes);
app.use("/sessions", authenticate, sessionRoutes);

// error handler
app.use(errorHandler);

app.listen(PORT, async () => {
	console.log(`Server listening on port ${PORT}`);
	await connectToDatabase();
});

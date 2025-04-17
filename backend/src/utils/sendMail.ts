import { Resend } from "resend";

type Params = {
	to: string;
	subject: string;
	text: string;
	html: string;
};

const resend = new Resend(process.env.RESEND_API_KEY);

const getFromEmail = () => {
	if (process.env.NODE_ENV === "development") return "onboarding@resend.dev";

	if (!process.env.EMAIL_SENDER) {
		throw new Error("Missing EMAIL_SENDER in environment variables");
	}
	return process.env.EMAIL_SENDER;
};

const getToEmail = (to: string) =>
	process.env.NODE_ENV === "development" ? "delivered@resend.dev" : to;

export const sendMail = async ({ to, subject, text, html }: Params) => {
	try {
		return await resend.emails.send({
			from: getFromEmail(),
			to: getToEmail(to),
			subject,
			text,
			html,
		});
	} catch (error) {
		console.error("Error sending email:", error);
		throw error;
	}
};

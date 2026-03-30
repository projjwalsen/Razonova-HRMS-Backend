import { brevoClient, MailError } from "../../config/mail/mail.config";

type EmailAddress = {
    email: string;
    name?: string;
}

type sendMailArgs = {
    to: EmailAddress | EmailAddress[];
    subject: string;
    htmlContent: string;

}

export async function sendMail({
    to,
    subject,
    htmlContent
}: sendMailArgs) {
    if(!Array.isArray(to)){
        to = [to];
    }
    if(to.length === 0){
        throw new MailError(
            "Receipient email is required to send an email",
            "RECIPIENT_MISSING",
            400
        )
    }
    if(!subject.trim()){
        throw new MailError(
            "Subject is required to send an email",
            "SUBJECT_MISSING",
            400
        )
    }
    if(!htmlContent.trim()){
        throw new MailError(
            "Email content is required to send an email",
            "CONTENT_MISSING",
            400
        )
    }
    try {
            const response = await brevoClient.transactionalEmails.sendTransacEmail({
                sender: {
                    email: process.env.BREVO_SENDER_EMAIL || "",
                    name: process.env.BREVO_SENDER_NAME || ""
                },
                to: to,
                subject,
                htmlContent
            });
            return response;
    } catch (error: any) {
        const status =
        error?.statusCode ||
        error?.status ||
        error?.response?.status ||
        500;

    throw new MailError(
      error?.message || "Failed to send email via Brevo",
      "MAIL_SEND_FAILED",
      status,
      error
    );
    }
}
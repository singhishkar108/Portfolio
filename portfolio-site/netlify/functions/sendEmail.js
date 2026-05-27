// netlify/functions/sendEmail.js

export async function handler(event, context) {
  // 1. Only allow HTTP POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
        Allow: "POST",
      },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    // 2. Parse the incoming contact form data from the frontend
    const { name, email, message } = JSON.parse(event.body);

    // 3. Server-side validation check
    if (
      !name ||
      !email ||
      !message ||
      name.trim() === "" ||
      email.trim() === "" ||
      message.trim() === ""
    ) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "All fields are required and cannot be empty.",
        }),
      };
    }

    // 4. Securely check for your Brevo API key
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      console.error(
        "Missing Environment Variable: BREVO_API_KEY is not defined.",
      );
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Server email configuration error. Please try again later.",
        }),
      };
    }

    // 5. Build and send the payload to Brevo's REST API V3
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        // Configured to pass spam filters using your verified Brevo email account
        sender: {
          name: "Portfolio Contact Form",
          email: "ishkar.singh.108@gmail.com",
        },

        // Routes directly to your primary email address
        to: [{ email: "ishkar.singh.108@gmail.com", name: "Ishkar Singh" }],

        // Allows you to just press "Reply" in your email inbox to answer the visitor
        replyTo: { email: email, name: name },

        subject: `Portfolio Contact Form: Message from ${name}`,
        htmlContent: `
                    <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #eee; rounded: 8px;">
                        <h2 style="color: #2563eb; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 0;">New Portfolio Message</h2>
                        <p style="margin: 15px 0;"><strong>Sender Name:</strong> ${name}</p>
                        <p style="margin: 15px 0;"><strong>Sender Email:</strong> <a href="mailto:${email}">${email}</a></p>
                        <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #2563eb; margin-top: 20px; border-radius: 4px;">
                            <p style="margin: 0; font-weight: bold; margin-bottom: 8px; color: #475569;">Message:</p>
                            <p style="margin: 0; white-space: pre-wrap; line-height: 1.6;">${message}</p>
                        </div>
                    </div>
                `,
      }),
    });

    // 6. Handle Brevo API response statuses
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Brevo API Rejected Request:", errorData);
      throw new Error(
        errorData.message || "Failed to send email via Brevo API.",
      );
    }

    // Success response back to frontend
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Email sent successfully!" }),
    };
  } catch (error) {
    console.error("Serverless Function Runtime Error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Internal Server Error. Please try again later.",
      }),
    };
  }
}

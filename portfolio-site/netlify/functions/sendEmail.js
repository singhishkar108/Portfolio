// Helper to escape HTML characters before embedding in email templates
function escapeHTML(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Helper function to build dynamic CORS headers
function getCorsHeaders(event) {
  const origin = event.headers.origin || event.headers.referer || "";

  const isAllowed =
    origin.startsWith("https://singhishkar108.netlify.app") ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    origin.endsWith(".netlify.app");

  return {
    "Access-Control-Allow-Origin": isAllowed
      ? origin.replace(/\/$/, "")
      : "https://singhishkar108.netlify.app",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export async function handler(event, context) {
  const corsHeaders = getCorsHeaders(event);

  // 1. Handle HTTP OPTIONS Preflight Request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: "",
    };
  }

  // 2. Only allow HTTP POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        Allow: "POST, OPTIONS",
      },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  // 3. Validate Origin / Referer
  const origin = event.headers.origin || event.headers.referer || "";
  const allowedHost = event.headers.host;
  if (
    origin &&
    allowedHost &&
    !origin.includes(allowedHost) &&
    !origin.includes("localhost") &&
    !origin.includes("127.0.0.1")
  ) {
    return {
      statusCode: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Forbidden request source." }),
    };
  }

  try {
    // 4. Parse incoming JSON body safely
    let parsedBody;
    try {
      parsedBody = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid payload formatting." }),
      };
    }

    const { name, email, message, gotcha } = parsedBody;

    // 5. Honeypot check
    if (gotcha) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Email sent successfully!" }),
      };
    }

    // 6. Server-side validation check
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "All fields are required and cannot be empty.",
        }),
      };
    }

    if (name.length > 100 || email.length > 150 || message.length > 5000) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Input payload exceeds allowed character length.",
        }),
      };
    }

    // 7. Check for Brevo API key
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      console.error(
        "Missing Environment Variable: BREVO_API_KEY is not defined.",
      );
      return {
        statusCode: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Server email configuration error. Please try again later.",
        }),
      };
    }

    const safeName = escapeHTML(name.trim());
    const safeEmail = escapeHTML(email.trim());
    const safeMessage = escapeHTML(message.trim());

    // 8. Build and send payload to Brevo API
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "Portfolio Contact Form",
          email: "ishkar.singh.108@gmail.com",
        },
        to: [{ email: "ishkar.singh.108@gmail.com", name: "Ishkar Singh" }],
        replyTo: { email: email.trim(), name: name.trim() },
        subject: `Portfolio Contact Form: Message from ${safeName}`,
        htmlContent: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #2563eb; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 0;">New Portfolio Message</h2>
            <p style="margin: 15px 0;"><strong>Sender Name:</strong> ${safeName}</p>
            <p style="margin: 15px 0;"><strong>Sender Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
            <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #2563eb; margin-top: 20px; border-radius: 4px;">
              <p style="margin: 0; font-weight: bold; margin-bottom: 8px; color: #475569;">Message:</p>
              <p style="margin: 0; white-space: pre-wrap; line-height: 1.6;">${safeMessage}</p>
            </div>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Brevo API Rejected Request:", errorData);
      throw new Error(
        errorData.message || "Failed to send email via Brevo API.",
      );
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Email sent successfully!" }),
    };
  } catch (error) {
    console.error("Serverless Function Runtime Error:", error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Internal Server Error. Please try again later.",
      }),
    };
  }
}

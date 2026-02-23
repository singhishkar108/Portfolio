import fetch from "node-fetch";

export async function handler(event) {
  const { name, email, message } = JSON.parse(event.body);

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: name, email: email },
      to: [{ email: "youremail@example.com" }],
      subject: "Portfolio Contact Form",
      htmlContent: `<p><strong>From:</strong> ${name} (${email})</p><p>${message}</p>`,
    }),
  });

  return {
    statusCode: response.ok ? 200 : 500,
    body: JSON.stringify({ success: response.ok }),
  };
}

// Simple email webhook for Railway deployment
// Deploy this to Vercel as api/send-email.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, message, from } = req.body;

  if (!to || !subject || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Use Vercel's built-in fetch to send via your preferred email service
    // This example uses Resend, but you can adapt it
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `UCP <${from || 'noreply@context-pack.com'}>`,
        to: [to],
        subject: subject,
        text: message
      })
    });

    if (response.ok) {
      return res.status(200).json({ success: true, message: 'Email sent' });
    } else {
      const error = await response.text();
      return res.status(500).json({ error: `Email service failed: ${error}` });
    }
  } catch (error) {
    console.error('Email webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
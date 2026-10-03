import { Resend } from "resend";

function getResend() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    throw new Error("Email delivery is not configured");
  }
  return { client: new Resend(apiKey), from };
}

export async function sendVerificationCode(email: string, code: string): Promise<void> {
  const { client, from } = getResend();
  const { error } = await client.emails.send({
    from,
    to: email,
    subject: "รหัสยืนยันอีเมล Nota",
    text: `รหัสยืนยัน Nota ของคุณคือ ${code}. รหัสนี้ใช้ได้ 15 นาที และใช้ได้ครั้งเดียว`,
  });
  if (error) throw new Error("Unable to send verification email");
}

export async function sendPasswordResetCode(email: string, code: string): Promise<void> {
  const { client, from } = getResend();
  const { error } = await client.emails.send({
    from,
    to: email,
    subject: "รหัสรีเซ็ตรหัสผ่าน Nota",
    text: `รหัสรีเซ็ตรหัสผ่าน Nota ของคุณคือ ${code}. รหัสนี้ใช้ได้ 15 นาที และใช้ได้ครั้งเดียว`,
  });
  if (error) throw new Error("Unable to send password reset email");
}

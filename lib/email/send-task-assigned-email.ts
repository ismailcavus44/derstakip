import nodemailer from "nodemailer";

import {
  buildTaskAssignedEmailHtml,
  buildTaskAssignedEmailText,
  type TaskAssignedTemplateParams,
} from "@/lib/email/task-assigned-html";

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
}

function getFromAddress(): string {
  const from = process.env.SMTP_FROM?.trim();
  if (from) return from;
  const user = process.env.SMTP_USER?.trim();
  if (user) return `Derstakip <${user}>`;
  return "";
}

function getAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "http://localhost:3000";
}

export type SendTaskAssignedEmailInput = {
  to: string;
  studentName: string;
  teacherName: string;
  subjectName: string;
  topicName: string;
  taskKind: "soru_cozumu" | "konu_anlatimi";
  questionCount: number | null;
  followupQuestionCount: number | null;
  description: string | null;
};

function buildQuestionLine(input: SendTaskAssignedEmailInput): string | null {
  if (input.taskKind === "soru_cozumu") {
    const n = input.questionCount;
    if (n != null && n > 0) {
      return `Çözülecek soru sayısı: ${n.toLocaleString("tr-TR")}`;
    }
    return "Soru çözümü";
  }
  const f = input.followupQuestionCount ?? 20;
  return `Konu sonrası soru: ${f.toLocaleString("tr-TR")}`;
}

/** Görev atandığında öğrenciye bildirim (SMTP kapalıysa sessizce atlanır). */
export async function sendTaskAssignedEmail(
  input: SendTaskAssignedEmailInput
): Promise<void> {
  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[email] SMTP tanımlı değil (SMTP_HOST, SMTP_USER, SMTP_PASS); bildirim gönderilmedi."
      );
    }
    return;
  }

  const from = getFromAddress();
  if (!from) {
    console.warn("[email] SMTP_FROM / SMTP_USER eksik.");
    return;
  }

  const host = process.env.SMTP_HOST!.trim();
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure =
    process.env.SMTP_SECURE === "true" || port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER!.trim(),
      pass: process.env.SMTP_PASS!.trim(),
    },
  });

  const taskKindLabel =
    input.taskKind === "konu_anlatimi" ? "Konu anlatımı" : "Soru çözümü";
  const dashboardUrl = `${getAppBaseUrl()}/student`;

  const templateParams: TaskAssignedTemplateParams = {
    studentName: input.studentName,
    teacherName: input.teacherName,
    subjectName: input.subjectName,
    topicName: input.topicName,
    taskKindLabel,
    questionLine: buildQuestionLine(input),
    description: input.description,
    dashboardUrl,
    year: new Date().getFullYear(),
  };

  const html = buildTaskAssignedEmailHtml(templateParams);
  const text = buildTaskAssignedEmailText(templateParams);

  await transporter.sendMail({
    from,
    to: input.to,
    subject: `Yeni görev: ${input.subjectName} — Derstakip`,
    text,
    html,
  });
}

/** E-posta istemcileri için satır içi CSS; tablo tabanlı düzen */

export type TaskAssignedTemplateParams = {
  studentName: string;
  teacherName: string;
  subjectName: string;
  topicName: string;
  taskKindLabel: string;
  questionLine: string | null;
  description: string | null;
  dashboardUrl: string;
  year: number;
};

export function buildTaskAssignedEmailHtml(p: TaskAssignedTemplateParams): string {
  const descBlock =
    p.description && p.description.trim()
      ? `<tr>
          <td style="padding:0 32px 24px;font-size:15px;line-height:1.6;color:#334155;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Not</p>
            <p style="margin:0;padding:16px 18px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">${escapeHtml(p.description.trim())}</p>
          </td>
        </tr>`
      : "";

  const questionRow =
    p.questionLine != null
      ? `<tr>
          <td style="padding:0 32px 12px;font-size:14px;color:#334155;">
            <strong style="color:#0f172a;">Detay:</strong> ${escapeHtml(p.questionLine)}
          </td>
        </tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yeni görev</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);border:1px solid #e2e8f0;">
          <tr>
            <td style="background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:28px 32px 24px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.85);">Derstakip</p>
              <h1 style="margin:0;font-size:22px;font-weight:700;line-height:1.3;color:#ffffff;">Yeni ödev / görev</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;font-size:16px;line-height:1.6;color:#0f172a;">
              Merhaba <strong>${escapeHtml(p.studentName)}</strong>,
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 20px;font-size:15px;line-height:1.65;color:#475569;">
              <strong>${escapeHtml(p.teacherName)}</strong> size yeni bir görev atadı. Aşağıda özet bilgileri bulabilirsiniz.
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
                <tr>
                  <td style="padding:16px 18px;border-bottom:1px solid #e2e8f0;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">Ders</p>
                    <p style="margin:0;font-size:15px;font-weight:600;color:#0f172a;">${escapeHtml(p.subjectName)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 18px;border-bottom:1px solid #e2e8f0;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">Konu</p>
                    <p style="margin:0;font-size:15px;font-weight:600;color:#0f172a;">${escapeHtml(p.topicName)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">Görev türü</p>
                    <p style="margin:0;font-size:15px;font-weight:600;color:#0f172a;">${escapeHtml(p.taskKindLabel)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${questionRow}
          ${descBlock}
          <tr>
            <td style="padding:8px 32px 28px;">
              <a href="${escapeAttr(p.dashboardUrl)}" style="display:inline-block;padding:14px 28px;background:#059669;color:#ffffff !important;text-decoration:none;font-size:15px;font-weight:600;border-radius:12px;box-shadow:0 2px 8px rgba(5,150,105,0.35);">Görevleri görüntüle</a>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #e2e8f0;background:#fafafa;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
                Bu e-posta Derstakip üzerinden otomatik gönderilmiştir. Sorularınız için öğretmeninizle iletişime geçebilirsiniz.
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:#cbd5e1;">© ${p.year} Derstakip</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildTaskAssignedEmailText(p: TaskAssignedTemplateParams): string {
  const lines = [
    "Yeni ödev / görev — Derstakip",
    "",
    `Merhaba ${p.studentName},`,
    "",
    `${p.teacherName} size yeni bir görev atadı.`,
    "",
    `Ders: ${p.subjectName}`,
    `Konu: ${p.topicName}`,
    `Tür: ${p.taskKindLabel}`,
  ];
  if (p.questionLine) lines.push(`Detay: ${p.questionLine}`);
  if (p.description?.trim()) lines.push("", `Not: ${p.description.trim()}`);
  lines.push("", `Panel: ${p.dashboardUrl}`, "", `© ${p.year} Derstakip`);
  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

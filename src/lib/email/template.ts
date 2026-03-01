// src/lib/email/template.ts
// HTML email wrapper for JWF Bursary Assessment System emails.
//
// Inline CSS is intentional: most email clients (Gmail, Outlook, Apple Mail)
// strip <style> blocks and external stylesheets, so every style must be
// applied directly on each element.
//
// Colour palette:
//   Navy  #1a2744  (JWF primary)
//   Gold  #c9a84c  (JWF accent)
//   White #ffffff
//   Light grey #f5f5f5 (body background)
//   Dark text  #333333

/**
 * Wraps a plain-text or HTML body string in a fully-formed, responsive HTML
 * email document branded for the John Whitgift Foundation.
 *
 * The `bodyContent` string is injected verbatim into the content cell; if it
 * is plain text, call this function after converting newlines to `<br>` tags
 * (or wrap paragraphs in `<p>` tags) before passing it in.
 *
 * @param bodyContent - HTML fragment to place inside the email body area.
 * @returns A complete HTML document string suitable for the `html` field of a
 *          Resend email send call.
 */
export function wrapInEmailTemplate(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>John Whitgift Foundation</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="
  margin: 0;
  padding: 0;
  background-color: #f5f5f5;
  font-family: Georgia, 'Times New Roman', Times, serif;
  -webkit-font-smoothing: antialiased;
">
  <!-- Outer wrapper table: centres content in all email clients -->
  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="background-color: #f5f5f5; margin: 0; padding: 0;"
  >
    <tr>
      <td align="center" style="padding: 24px 16px;">

        <!-- Inner container: max 600 px wide -->
        <table
          role="presentation"
          width="600"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="
            max-width: 600px;
            width: 100%;
            background-color: #ffffff;
            border-radius: 4px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          "
        >

          <!-- ── HEADER ───────────────────────────────────────────────── -->
          <tr>
            <td
              style="
                background-color: #1a2744;
                padding: 28px 36px;
                text-align: left;
              "
            >
              <!-- Foundation name -->
              <div style="
                font-family: Georgia, 'Times New Roman', Times, serif;
                font-size: 20px;
                font-weight: normal;
                color: #ffffff;
                letter-spacing: 0.5px;
                line-height: 1.3;
                margin: 0 0 4px 0;
              ">
                John Whitgift Foundation
              </div>
              <!-- Gold rule beneath the name -->
              <div style="
                width: 48px;
                height: 2px;
                background-color: #c9a84c;
                margin-top: 10px;
              "></div>
              <!-- Sub-label -->
              <div style="
                font-family: Arial, Helvetica, sans-serif;
                font-size: 12px;
                color: #a8b4cc;
                letter-spacing: 1px;
                text-transform: uppercase;
                margin-top: 8px;
              ">
                Bursary Assessment System
              </div>
            </td>
          </tr>

          <!-- ── BODY ─────────────────────────────────────────────────── -->
          <tr>
            <td
              style="
                padding: 36px;
                color: #333333;
                font-family: Georgia, 'Times New Roman', Times, serif;
                font-size: 15px;
                line-height: 1.7;
              "
            >
              ${bodyContent}
            </td>
          </tr>

          <!-- ── DIVIDER ──────────────────────────────────────────────── -->
          <tr>
            <td style="padding: 0 36px;">
              <div style="
                border-top: 1px solid #e8e8e8;
                height: 1px;
              "></div>
            </td>
          </tr>

          <!-- ── FOOTER ───────────────────────────────────────────────── -->
          <tr>
            <td
              style="
                padding: 20px 36px 28px;
                background-color: #f9f9f9;
              "
            >
              <p style="
                margin: 0;
                font-family: Arial, Helvetica, sans-serif;
                font-size: 11px;
                color: #888888;
                line-height: 1.6;
                text-align: center;
              ">
                This is an automated message from the John Whitgift Foundation
                Bursary Assessment System.<br />
                Please do not reply directly to this email.
                If you have questions, contact the Bursary Office directly.
              </p>
              <p style="
                margin: 12px 0 0;
                font-family: Arial, Helvetica, sans-serif;
                font-size: 10px;
                color: #bbbbbb;
                text-align: center;
                letter-spacing: 0.3px;
              ">
                &copy; ${new Date().getFullYear()} John Whitgift Foundation. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
        <!-- /inner container -->

      </td>
    </tr>
  </table>
  <!-- /outer wrapper -->
</body>
</html>`;
}

/**
 * Convert a plain-text email body (with newline characters) into a minimal
 * HTML fragment suitable for passing to `wrapInEmailTemplate`.
 *
 * - Double newlines become paragraph breaks (`<p>` tags).
 * - Single newlines within a paragraph become `<br />` tags.
 * - The result is NOT sanitised; do not pass untrusted user input without
 *   sanitising first.
 *
 * @param text - Plain-text content with `\n` line endings.
 * @returns    HTML fragment string.
 */
export function plainTextToHtml(text: string): string {
  const paragraphs = text
    .split(/\n\n+/)
    .map((paragraph) =>
      `<p style="margin: 0 0 16px 0;">${paragraph
        .trim()
        .replace(/\n/g, "<br />")}</p>`
    )
    .filter((p) => p !== "<p style=\"margin: 0 0 16px 0;\"></p>");

  return paragraphs.join("\n");
}

/**
 * Strip HTML tags from a string to produce a plain-text version.
 *
 * Used to generate the `text` field required by Resend alongside `html`.
 *
 * @param html - HTML string.
 * @returns    Plain text with tags removed and common entities decoded.
 */
export function htmlToPlainText(html: string): string {
  return html
    // Replace block-level closing tags with newlines
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    // Remove all remaining tags
    .replace(/<[^>]+>/g, "")
    // Decode common HTML entities
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&copy;/gi, "(c)")
    // Collapse runs of more than two newlines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

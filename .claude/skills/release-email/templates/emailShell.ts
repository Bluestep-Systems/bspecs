// =============================================================================
// emailShell — wraps a stored release-email BODY in its email document shell
// =============================================================================
// Since the gateway MCP lost form_entry, entries are written through GraphQL,
// whose write path renames document-level tags (<html> → <xxhtmlxx>, also head,
// body, meta, link, title) and escapes HTML comments — so a complete email
// document cannot be stored intact. The body (tables, spans, inline styles,
// <style>) survives byte-for-byte. So /release-email stores only the body, with
// the two Outlook ghost-table comments replaced by the %%MSO_OPEN%% /
// %%MSO_CLOSE%% markers, and this module adds the shell back at send/preview
// time.
//
// The SAME file ships in both components (Send post-save, Preview merge report)
// and in the skill's local render step, which asserts that the rendered email
// equals wrapEmailDocument(storedBody, subject). Keep the three copies identical.
//
// A stored value that already starts with <!doctype is a legacy full document
// (entries written before 2026-09) and is returned unchanged.
// =============================================================================

const SHELL_HEAD = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>%%TITLE%%</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&family=Merriweather:wght@300;400;700&display=swap">
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  
  <style>
    a { color: #0063A6; text-decoration: none; }
    a:hover { color: #004f86 !important; }
    @media only screen and (max-width: 620px) {
      .b6p-container { width: 100% !important; max-width: 100% !important; }
      .b6p-pad { padding-left: 24px !important; padding-right: 24px !important; }
      .b6p-entry-ver { display: block !important; width: auto !important; padding: 0 0 4px 0 !important; }
      .b6p-entry-text { display: block !important; width: auto !important; }
      .b6p-footer-id, .b6p-footer-meta { display: block !important; width: 100% !important; text-align: left !important; }
      .b6p-footer-meta { padding-top: 20px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background:#eceef1; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; font-family:'Lato','Segoe UI','Helvetica Neue',Arial,sans-serif; color:#231F20;">`;

const SHELL_TAIL = `</body>
</html>
`;

const MSO_OPEN = `<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->`;
const MSO_CLOSE = `<!--[if mso]></td></tr></table><![endif]-->`;

function escTitle(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function wrapEmailDocument(stored: string, subject: string): string {
  if (/^\s*<!doctype/i.test(stored)) return stored;
  const body = stored.split("%%MSO_OPEN%%").join(MSO_OPEN).split("%%MSO_CLOSE%%").join(MSO_CLOSE);
  return SHELL_HEAD.replace("%%TITLE%%", () => escTitle(subject)) + body + SHELL_TAIL;
}

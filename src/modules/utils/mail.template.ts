export const ONBOARDING_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Welcome to {{companyName}}</title>
<style>
  body{margin:0;padding:0;background:#f2f4f7;font-family:Arial,Helvetica,sans-serif;}
  .wrapper{max-width:600px;margin:28px auto;background:#f2f4f7;}

  .topbar{background:#0A1628;padding:18px 32px;display:flex;align-items:center;justify-content:space-between;}
  .topbar img{height:32px;object-fit:contain;}
  .topbar-tag{font-size:10px;color:#93a3b8;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;}

  .hero{background:#1A2F52;padding:40px 32px 32px;border-top:3px solid #2563EB;}
  .hero-eyebrow{font-size:11px;color:#93c5fd;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;margin-bottom:12px;}
  .hero h1{color:#ffffff;font-size:24px;font-weight:700;margin:0 0 8px;line-height:1.35;}
  .hero p{color:#cbd5e1;font-size:13px;margin:0;}

  .card{background:#ffffff;padding:32px;}

  .card p{font-size:14px;color:#374151;line-height:1.85;margin:0 0 20px;}

  .info-table{width:100%;border:1px solid #e2e8f0;border-radius:5px;overflow:hidden;margin:4px 0 28px;}
  .info-row{display:flex;border-bottom:1px solid #f1f5f9;}
  .info-row:last-child{border-bottom:none;}
  .info-label{width:36%;padding:11px 16px;font-size:12px;font-weight:700;color:#64748b;background:#f8fafc;border-right:1px solid #f1f5f9;text-transform:uppercase;letter-spacing:0.04em;}
  .info-value{flex:1;padding:11px 16px;font-size:13px;color:#0f172a;font-weight:500;}

  .cta-wrap{text-align:center;margin:28px 0 6px;}
  .cta{
    display:inline-block;
    background:#1E3A8A;
    color:#ffffff !important;
    font-size:13px;
    font-weight:700;
    padding:14px 42px;
    border-radius:6px;
    text-decoration:none;
    letter-spacing:0.05em;
    box-shadow:0 4px 10px rgba(0,0,0,0.08);
  }
  .cta-sub{text-align:center;font-size:11px;color:#94a3b8;margin-top:10px;}
  .cta-sub a{color:#2563EB;word-break:break-all;}

  .divider{height:1px;background:#f1f5f9;margin:26px 0;}

  .sig{font-size:13px;color:#374151;line-height:1.9;}
  .sig-name{font-weight:700;color:#0f172a;font-size:14px;}
  .sig-title{color:#64748b;font-size:12px;}

  .footer{background:#EFF6FF;padding:20px 32px;text-align:center;border-top:1px solid #BFDBFE;}
  .footer p{font-size:11px;color:#475569;margin:3px 0;line-height:1.6;}
  .footer a{color:#2563EB;text-decoration:none;}
  .footer-links a{margin:0 8px;font-size:11px;color:#2563EB;}
</style>
</head>
<body>
<div class="wrapper">

  <div class="topbar">
    <img src="{{companyLogoUrl}}" alt="{{companyName}}"/>
    <span class="topbar-tag">Onboarding</span>
  </div>

  <div class="hero">
    <div class="hero-eyebrow">Welcome Aboard</div>
    <h1>Hello, {{participantName}}.</h1>
    <p>We are pleased to confirm your joining at {{companyName}}. Please find your onboarding details below.</p>
  </div>

  <div class="card">
    <p>Dear <strong>{{participantName}}</strong>,</p>
    <p>We are delighted to welcome you to the <strong>{{companyName}}</strong> team. After a thorough selection process, we are confident you are an exceptional addition. We look forward to the contributions and perspectives you will bring to your role.</p>

    <div class="info-table">
      <div class="info-row"><div class="info-label">Full Name</div><div class="info-value">{{participantName}}</div></div>
      <div class="info-row"><div class="info-label">Role</div><div class="info-value">{{role}}</div></div>
      <div class="info-row"><div class="info-label">Department</div><div class="info-value">{{department}}</div></div>
      <div class="info-row"><div class="info-label">Start Date</div><div class="info-value">{{startDate}}</div></div>
      {{managerRow}}
    </div>

    <p>Please access your onboarding portal to complete your pre-joining formalities, submit required documents, and review your appointment letter at your earliest convenience.</p>

    <div class="cta-wrap">
      <a href="{{portalUrl}}" class="cta" 
        style="background:#1E40AF;color:#ffffff;text-decoration:none;display:inline-block;">
        Access Onboarding Portal
      </a>
    </div>
    <p class="cta-sub">Or visit: <a href="{{portalUrl}}">{{portalUrl}}</a></p>

    <div class="divider"></div>

    <div class="sig">
      <p>Regards,</p>
      <p class="sig-name">{{senderName}}</p>
      <p class="sig-title">{{senderTitle}}, {{companyName}}</p>
    </div>
  </div>

  <div class="footer">
    <div class="footer-links">
      <a href="#">Privacy Policy</a>
      <a href="#">Help Center</a>
      <a href="#">Unsubscribe</a>
    </div>
    <p>© 2026 {{companyName}}. All rights reserved.</p>
  </div>

</div>
</body>
</html>`;




export const RESET_PASSWORD_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Password Reset — {{companyName}}</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background: #f2f4f7;
        font-family: Arial, Helvetica, sans-serif;
      }
      .wrapper {
        max-width: 600px;
        margin: 28px auto;
        background: #f2f4f7;
      }

      .topbar {
        background: #0a1628;
        padding: 18px 32px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .topbar img {
        height: 32px;
        object-fit: contain;
      }
      .topbar-tag {
        font-size: 10px;
        color: #93a3b8;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        font-weight: 600;
      }

      .hero {
        background: #1a2f52;
        padding: 40px 32px 32px;
        border-top: 3px solid #dc2626;
      }
      .hero-eyebrow {
        font-size: 11px;
        color: #fca5a5;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-weight: 700;
        margin-bottom: 12px;
      }
      .hero h1 {
        color: #ffffff;
        font-size: 24px;
        font-weight: 700;
        margin: 0 0 8px;
        line-height: 1.35;
      }
      .hero p {
        color: #cbd5e1;
        font-size: 13px;
        margin: 0;
      }

      .card {
        background: #ffffff;
        padding: 32px;
      }
      .card p {
        font-size: 14px;
        color: #374151;
        line-height: 1.85;
        margin: 0 0 20px;
      }

      .otp-block {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-left: 4px solid #dc2626;
        border-radius: 6px;
        padding: 24px 32px;
        text-align: center;
        margin: 8px 0 28px;
      }
      .otp-label {
        font-size: 11px;
        font-weight: 700;
        color: #64748b;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        margin-bottom: 12px;
      }
      .otp-code {
        font-size: 38px;
        font-weight: 700;
        color: #0f172a;
        letter-spacing: 10px;
        font-family: "Courier New", monospace;
      }
      .otp-validity {
        font-size: 12px;
        color: #94a3b8;
        margin-top: 12px;
      }
      .otp-validity span {
        color: #dc2626;
        font-weight: 700;
      }

      .info-table {
        width: 100%;
        border: 1px solid #e2e8f0;
        border-radius: 5px;
        overflow: hidden;
        margin: 4px 0 28px;
      }
      .info-row {
        display: flex;
        border-bottom: 1px solid #f1f5f9;
      }
      .info-row:last-child {
        border-bottom: none;
      }
      .info-label {
        width: 36%;
        padding: 11px 16px;
        font-size: 12px;
        font-weight: 700;
        color: #64748b;
        background: #f8fafc;
        border-right: 1px solid #f1f5f9;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .info-value {
        flex: 1;
        padding: 11px 16px;
        font-size: 13px;
        color: #0f172a;
        font-weight: 500;
      }

      .warning-box {
        background: #fffbeb;
        border: 1px solid #fde68a;
        border-left: 4px solid #f59e0b;
        border-radius: 6px;
        padding: 14px 18px;
        margin: 0 0 24px;
      }
      .warning-box p {
        font-size: 12px;
        color: #92400e;
        margin: 0;
        line-height: 1.7;
      }
      .warning-box strong {
        color: #78350f;
      }

      .divider {
        height: 1px;
        background: #f1f5f9;
        margin: 26px 0;
      }

      .sig {
        font-size: 13px;
        color: #374151;
        line-height: 1.9;
      }
      .sig-name {
        font-weight: 700;
        color: #0f172a;
        font-size: 14px;
      }
      .sig-title {
        color: #64748b;
        font-size: 12px;
      }

      .footer {
        background: #fef2f2;
        padding: 20px 32px;
        text-align: center;
        border-top: 1px solid #fecaca;
      }
      .footer p {
        font-size: 11px;
        color: #475569;
        margin: 3px 0;
        line-height: 1.6;
      }
      .footer a {
        color: #dc2626;
        text-decoration: none;
      }
      .footer-links a {
        margin: 0 8px;
        font-size: 11px;
        color: #dc2626;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="topbar">
        <img src="{{companyLogoUrl}}" alt="{{companyName}}" />
        <span class="topbar-tag">Security Alert</span>
      </div>

      <div class="hero">
        <div class="hero-eyebrow">Password Reset Request</div>
        <h1>Hello, {{name}}.</h1>
        <p>
          We received a request to reset the password associated with your
          {{companyName}} account.
        </p>
      </div>

      <div class="card">
        <p>Dear <strong>{{name}}</strong>,</p>
        <p>
          A password reset was requested for your account. Use the one-time
          passcode below to proceed. Do <strong>not</strong> share this code
          with anyone, including {{companyName}} support staff.
        </p>

        <div class="otp-block">
          <div class="otp-label">Your One-Time Passcode</div>
          <div class="otp-code">{{otp}}</div>
          <div class="otp-validity">
            Expires in <span>10 minutes</span> — single use only
          </div>
        </div>

        <div class="info-table">
          <div class="info-row">
            <div class="info-label">Account</div>
            <div class="info-value">{{email}}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Requested At</div>
            <div class="info-value">{{requestedAt}}</div>
          </div>
        </div>

        <div class="warning-box">
          <p>
            <strong>⚠ Didn't request this?</strong> If you did not initiate this
            request, your account may be at risk. Please ignore this email and
            contact <strong>{{companyName}} IT Support</strong> immediately to
            secure your account.
          </p>
        </div>

        <div class="divider"></div>

        <div class="sig">
          <p>Regards,</p>
          <p class="sig-name">{{companyName}} Security Team</p>
          <p class="sig-title">Identity & Access Management</p>
        </div>
      </div>

      <div class="footer">
        <p>
          This is an automated security notification. Please do not reply to
          this email.
        </p>
        <p>© 2026 {{companyName}}. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>
`;

export const CONTACT_US_EMAIL_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>New Contact Enquiry</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background: #f2f4f7;
        font-family: Arial, Helvetica, sans-serif;
      }
      .wrapper {
        max-width: 640px;
        margin: 28px auto;
        background: #f2f4f7;
      }
      .topbar {
        background: #0a1628;
        padding: 18px 32px;
        color: #fff;
      }
      .topbar-title {
        font-size: 16px;
        font-weight: 700;
      }
      .hero {
        background: #1a2f52;
        padding: 32px;
        border-top: 3px solid #2563eb;
      }
      .hero h1 {
        color: #fff;
        font-size: 22px;
        margin: 0 0 8px;
      }
      .hero p {
        color: #cbd5e1;
        font-size: 13px;
        margin: 0;
      }
      .card {
        background: #fff;
        padding: 32px;
      }
      .card p {
        font-size: 14px;
        color: #374151;
        line-height: 1.7;
        margin: 0 0 18px;
      }
      .info-table {
        width: 100%;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        overflow: hidden;
        margin: 10px 0 24px;
      }
      .info-row {
        display: flex;
        border-bottom: 1px solid #f1f5f9;
      }
      .info-row:last-child {
        border-bottom: none;
      }
      .info-label {
        width: 34%;
        padding: 12px 16px;
        font-size: 12px;
        font-weight: 700;
        color: #64748b;
        background: #f8fafc;
        border-right: 1px solid #f1f5f9;
        text-transform: uppercase;
      }
      .info-value {
        flex: 1;
        padding: 12px 16px;
        font-size: 13px;
        color: #0f172a;
        font-weight: 500;
        word-break: break-word;
      }
      .query-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 18px;
        color: #1f2937;
        font-size: 14px;
        line-height: 1.8;
        white-space: pre-line;
      }
      .footer {
        background: #eff6ff;
        padding: 18px 32px;
        text-align: center;
        border-top: 1px solid #bfdbfe;
      }
      .footer p {
        font-size: 11px;
        color: #475569;
        margin: 3px 0;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="topbar">
        <div class="topbar-title">{{hrmsName}} Contact Enquiry</div>
      </div>

      <div class="hero">
        <h1>New Contact Us Request</h1>
        <p>A visitor submitted a query through the website/contact form.</p>
      </div>

      <div class="card">
        <p>Hello Team,</p>
        <p>
          A new contact enquiry has been submitted. Please review the details
          below and follow up with the user.
        </p>

        <div class="info-table">
          <div class="info-row">
            <div class="info-label">Email</div>
            <div class="info-value">{{email}}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Phone</div>
            <div class="info-value">{{phone}}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Company</div>
            <div class="info-value">{{companyName}}</div>
          </div>
        </div>

        <p><strong>User Query</strong></p>
        <div class="query-box">{{query}}</div>
      </div>

      <div class="footer">
        <p>© 2026 {{hrmsName}}. All rights reserved.</p>
        <p>This message was generated from the Contact Us form.</p>
      </div>
    </div>
  </body>
</html>
`
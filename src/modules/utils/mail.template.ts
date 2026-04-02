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
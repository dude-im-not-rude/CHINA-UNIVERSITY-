"use client";

import { useState } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";

const HCAPTCHA_SITEKEY = "50b2fe65-b00b-4b9e-ad62-3ba471098be2";

export default function ContactWidget() {
  const [open, setOpen] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setStatus("");
    if (!captchaToken) return setStatus("Please complete the CAPTCHA first.");
    const accessKey = process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY;
    if (!accessKey) return setStatus("Contact form is not configured yet.");
    setSending(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("access_key", accessKey);
    formData.set("h-captcha-response", captchaToken);
    formData.set("subject", "New ChinaUniTracker contact message");
    formData.set("from_name", "ChinaUniTracker");
    try {
      const response = await fetch("https://api.web3forms.com/submit", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "The message could not be sent.");
      form.reset();
      setCaptchaToken("");
      setStatus("Message sent successfully. We'll get back to you soon.");
    } catch (error) {
      setStatus(error.message || "Something went wrong. Please try again.");
    } finally { setSending(false); }
  }

  return (
    <>
      <button className="contact-fab" onClick={() => setOpen(true)} aria-label="Open contact form" title="Contact us">✉</button>
      {open && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="contact-modal" role="dialog" aria-modal="true" aria-label="Contact ChinaUniTracker">
            <button className="modal-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            <div className="eyebrow">CONTACT US</div>
            <h2>Tell us what needs fixing.</h2>
            <p>Questions, missing university data, corrections or feedback — send it over.</p>
            <form onSubmit={submit} className="contact-widget-form">
              <label>Name<input name="name" maxLength={100} required /></label>
              <label>Email<input name="email" type="email" maxLength={254} required /></label>
              <label>Message<textarea name="message" rows="5" maxLength={5000} required /></label>
              <input type="checkbox" name="botcheck" tabIndex="-1" autoComplete="off" style={{ display: "none" }} />
              <HCaptcha sitekey={HCAPTCHA_SITEKEY} reCaptchaCompat={false} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken("")} onError={() => setCaptchaToken("")} />
              <button className="btn primary full" type="submit" disabled={sending}>{sending ? "Sending..." : "Send message"}</button>
              {status && <div className="notice" role="status">{status}</div>}
            </form>
          </div>
        </div>
      )}
    </>
  );
}

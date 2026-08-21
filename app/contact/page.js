"use client";

import Link from "next/link";
import { useState } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";

const HCAPTCHA_SITEKEY = "50b2fe65-b00b-4b9e-ad62-3ba471098be2";

export default function Page() {
  const [captchaToken, setCaptchaToken] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setStatus("");

    if (!captchaToken) {
      setStatus("Please complete the CAPTCHA first.");
      return;
    }

    const accessKey = process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY;

    if (!accessKey) {
      setStatus("Contact form is not configured yet.");
      return;
    }

    setSending(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    formData.set("access_key", accessKey);
    formData.set("h-captcha-response", captchaToken);
    formData.set("subject", "New ChinaUniTracker contact message");
    formData.set("from_name", "ChinaUniTracker");

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "The message could not be sent.");
      }

      form.reset();
      setCaptchaToken("");
      setStatus("Message sent successfully. We'll get back to you soon.");
    } catch (error) {
      setStatus(error.message || "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main>
      <header className="nav">
        <Link className="brand" href="/">China<span>Uni</span>Tracker</Link>
        <nav>
          <Link href="/universities">Universities</Link>
          <Link href="/scholarships">Scholarships</Link>
          <Link href="/csca">CSCA</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </header>

      <section className="contact">
        <div>
          <div className="eyebrow">CONTACT</div>
          <h1>Have a question?</h1>
          <p>Send a message about a university, scholarship, missing data or correction.</p>
        </div>

        <form onSubmit={submit}>
          <label>Name<input name="name" maxLength={100} required /></label>
          <label>Email<input name="email" type="email" maxLength={254} required /></label>
          <label>Message<textarea name="message" rows="7" maxLength={5000} required /></label>
          <input type="checkbox" name="botcheck" tabIndex="-1" autoComplete="off" style={{ display: "none" }} />
          <div style={{ margin: "18px 0" }}>
            <HCaptcha sitekey={HCAPTCHA_SITEKEY} reCaptchaCompat={false} onVerify={(token) => setCaptchaToken(token)} onExpire={() => setCaptchaToken("")} onError={() => setCaptchaToken("")} />
          </div>
          <button className="btn primary" type="submit" disabled={sending}>{sending ? "Sending..." : "Send message"}</button>
          {status && <div className="notice" role="status">{status}</div>}
        </form>
      </section>
    </main>
  );
}

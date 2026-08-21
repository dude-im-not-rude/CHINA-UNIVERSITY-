"use client";

import { useEffect, useState } from "react";

const COOKIE_NAME = "chinaunitracker_cookie_consent";

function setConsent(value) {
  document.cookie = `${COOKIE_NAME}=${value}; Max-Age=31536000; Path=/; SameSite=Lax`;
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [details, setDetails] = useState(false);

  useEffect(() => {
    const hasChoice = document.cookie.split("; ").some((item) => item.startsWith(`${COOKIE_NAME}=`));
    if (!hasChoice) setVisible(true);
  }, []);

  function choose(value) {
    setConsent(value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie preferences">
      <div>
        <div className="cookie-title">Your privacy matters</div>
        <p>
          ChinaUniTracker uses essential browser storage for site preferences and third-party services such as hCaptcha. Optional analytics are not enabled by default.
        </p>
        {details && (
          <div className="cookie-details">
            <b>Essential</b><span>Required for preferences and core functionality.</span>
            <b>Analytics</b><span>Optional measurement may be introduced later and will require a separate opt-in.</span>
            <a href="/cookies">Read the full Cookie Notice →</a>
          </div>
        )}
      </div>
      <div className="cookie-actions">
        <button className="cookie-link" onClick={() => setDetails((v) => !v)}>{details ? "Hide details" : "Manage preferences"}</button>
        <button className="btn secondary" onClick={() => choose("essential")}>Continue with essential</button>
        <button className="btn primary" onClick={() => choose("essential")}>Accept</button>
      </div>
    </div>
  );
}

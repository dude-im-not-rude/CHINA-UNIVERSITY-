"use client";

export default function ReportButton({ university, program = "" }) {
  function report() {
    window.dispatchEvent(new CustomEvent("open-contact-widget", { detail: { university, program } }));
  }
  return <button className="report-btn" onClick={report}>⚑ Report incorrect information</button>;
}

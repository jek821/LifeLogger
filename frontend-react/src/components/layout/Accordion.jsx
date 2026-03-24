import { useState } from "react";

export default function Accordion({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card">
      <button
        className="accordion-trigger"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="accordion-trigger-left">
          {icon && <span>{icon}</span>}
          {title}
        </span>
        <svg className="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div className={`accordion-body${open ? " open" : ""}`}>
        {children}
      </div>
    </div>
  );
}

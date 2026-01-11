import React from "react";

type Props = {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title = "Confirm",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
    }}>
      <div style={{
        background: "#fff", padding: 20, borderRadius: 8, width: "min(420px, 92vw)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
      }}>
        <h3 style={{marginTop: 0}}>{title}</h3>
        <p style={{whiteSpace: "pre-wrap"}}>{message}</p>
        <div style={{display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16}}>
          <button onClick={onCancel}>{cancelText}</button>
          <button onClick={onConfirm} style={{background:"#2563eb", color:"#fff", border:"none", padding:"6px 12px", borderRadius:4}}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
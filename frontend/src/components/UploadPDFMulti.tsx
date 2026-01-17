
import React, { useState, useRef } from "react";
import { processPDF } from "../lib/ocr";
import { postRecord } from "../api";
import { postSheetRecord } from "../apiSheets";

const buttonStyle = {
  padding: "10px 20px",
  fontSize: "16px",
  cursor: "pointer",
  backgroundColor: "#007bff",
  color: "white",
  border: "none",
  borderRadius: "5px",
  marginRight: "10px",
  transition: "background-color 0.3s",
};

const progressBarContainerStyle = {
  height: "10px",
  backgroundColor: "#e9ecef",
  borderRadius: "5px",
  overflow: "hidden",
  marginTop: "10px",
  width: "100%",
};

export default function UploadPDFMulti({ sheetId }: { sheetId?: string }) {
  const [status, setStatus] = useState("Ready to upload.");
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileQueueInfo, setFileQueueInfo] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length) return;

    setIsProcessing(true);
    setProgress(0);
    setFileQueueInfo({ current: 0, total: files.length });
    let totalSaved = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setFileQueueInfo({ current: i + 1, total: files.length });
        setStatus(`Processing file ${i + 1}/${files.length}: ${file.name}`);

        const results = await processPDF(file, (p, page, total) => {
          setProgress(p);
          if (total && page) {
            setStatus(
              `Processing file ${i + 1}/${files.length}: ${file.name} — Page ${page}/${total} (${p}%)`
            );
          }
        });

        setStatus(`Saving ${results.length} records from ${file.name}...`);
        for (const r of results) {
          const payload = { ...r, pdfName: file.name };
          if (sheetId) {
            await postSheetRecord(sheetId, payload);
          } else {
            await postRecord(payload);
          }
          totalSaved += 1;
        }
      }

      setStatus(`Successfully saved ${totalSaved} records from ${files.length} file(s). Reloading...`);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setTimeout(() => window.location.reload(), 700);
    } catch (err: any) {
      console.error(err);
      setStatus("Error: " + (err.message || "An unknown error occurred."));
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleButtonClick = () => {
    if (fileInputRef.current && !isProcessing) {
      fileInputRef.current.click();
    }
  };

  return (
    <div
      style={{
        padding: 20,
        border: "1px solid #ddd",
        borderRadius: "8px",
        marginBottom: "30px",
        backgroundColor: "#f9f9f9",
      }}
    >
      <h2>Upload Child PDF(s)</h2>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        multiple
        onChange={handleFile}
        style={{ display: "none" }}
        disabled={isProcessing}
      />

      <button
        onClick={handleButtonClick}
        style={{ ...buttonStyle, opacity: isProcessing ? 0.6 : 1 }}
        disabled={isProcessing}
        title={isProcessing ? "Processing in progress" : "Click to select PDF(s)"}
      >
        {isProcessing ? "Processing..." : "Select PDF(s) for OCR"}
      </button>

      <p
        style={{
          marginTop: "15px",
          fontWeight: "bold",
          color: isProcessing ? "#007bff" : "#333",
        }}
      >
        {fileQueueInfo.total > 1
          ? `${status} (${fileQueueInfo.current}/${fileQueueInfo.total})`
          : status}
      </p>

      {isProcessing && progress > 0 && (
        <div style={progressBarContainerStyle}>
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              backgroundColor: "#28a745",
              borderRadius: "5px",
              transition: "width 0.3s ease-in-out",
            }}
          />
        </div>
      )}
    </div>
  );
}

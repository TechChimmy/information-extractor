import React, { useState, useRef } from "react";
import { processPDF } from "../lib/ocr";
import { postRecord } from "../api";
import { postSheetRecord } from "../apiSheets";
import { FaChevronDown, FaChevronUp, FaTimes, FaPause, FaPlay, FaStop } from "react-icons/fa";

const buttonStyle: React.CSSProperties = {
  padding: "10px 20px",
  fontSize: "16px",
  cursor: "pointer",
  backgroundColor: "#007bff",
  color: "white",
  border: "none",
  borderRadius: "5px",
  marginRight: "10px",
  transition: "background-color 0.3s",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const progressBarContainerStyle: React.CSSProperties = {
  height: "20px",
  backgroundColor: "#e9ecef",
  borderRadius: "10px",
  overflow: "hidden",
  marginTop: "10px",
  width: "100%",
  position: "relative",
};

export default function UploadPDFMulti({ sheetId, onUploadComplete }: {
  sheetId?: string;
  onUploadComplete?: () => void;
}) {
  const [status, setStatus] = useState("Ready to upload.");
  const [overallProgress, setOverallProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileQueueInfo, setFileQueueInfo] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [skippedRecords, setSkippedRecords] = useState<Array<{ file: string, reason: string, name?: string }>>([]);
  const [showSkipped, setShowSkipped] = useState(true);

  // Use refs for pause/stop state to avoid closure issues
  const isPausedRef = useRef(false);
  const isStoppedRef = useRef(false);

  // Calculate realistic progress based on files completed + current file progress
  const updateOverallProgress = (fileIndex: number, totalFiles: number, currentFileProgress: number) => {
    const completedFilesProgress = (fileIndex / totalFiles) * 100;
    const currentFileContribution = (currentFileProgress / totalFiles);
    const total = Math.min(100, Math.round(completedFilesProgress + currentFileContribution));
    setOverallProgress(total);
  };

  const processSingleFile = async (file: File, fileIndex: number, totalFiles: number) => {
    // Check if stopped before starting
    if (isStoppedRef.current) {
      return { saved: 0, skipped: 0, duplicates: 0, stopped: true };
    }

    console.log(`Starting processing of: ${file.name}`);
    setFileQueueInfo({ current: fileIndex + 1, total: totalFiles });
    setStatus(`Processing file ${fileIndex + 1}/${totalFiles}: ${file.name}`);

    try {
      const results = await processPDF(file, (p, page, total) => {
        updateOverallProgress(fileIndex, totalFiles, p);
        if (total && page) {
          setStatus(`Processing file ${fileIndex + 1}/${totalFiles}: ${file.name} — Page ${page}/${total}`);
        }
      }, async () => {
        // Check for stop
        if (isStoppedRef.current) {
          throw new Error('STOPPED');
        }
        // Handle pause
        while (isPausedRef.current && !isStoppedRef.current) {
          await new Promise(res => setTimeout(res, 200));
        }
      });

      // Check if stopped after processing
      if (isStoppedRef.current) {
        return { saved: 0, skipped: 0, duplicates: 0, stopped: true };
      }

      if (!results || results.length === 0) {
        console.warn(`No records extracted from: ${file.name}`);
        setSkippedRecords(prev => [...prev, { file: file.name, reason: 'No records extracted' }]);
        return { saved: 0, skipped: 1, duplicates: 0 };
      }

      let savedCount = 0;
      let duplicateCount = 0;
      let partialCount = 0;

      for (const [index, record] of results.entries()) {
        // Check for stop before each record
        if (isStoppedRef.current) {
          return { saved: savedCount, skipped: 0, duplicates: duplicateCount, stopped: true };
        }

        // Handle pause between records
        while (isPausedRef.current && !isStoppedRef.current) {
          await new Promise(res => setTimeout(res, 200));
        }

        // Check if stopped after pause
        if (isStoppedRef.current) {
          return { saved: savedCount, skipped: 0, duplicates: duplicateCount, stopped: true };
        }

        try {
          // Save the record even if some fields are missing
          const payload = { ...record, pdfName: file.name };
          let response;
          if (sheetId) {
            response = await postSheetRecord(sheetId, payload);
          } else {
            response = await postRecord(payload);
          }

          // Check for duplicate response from backend
          if (response && response.duplicate) {
            duplicateCount++;
            setSkippedRecords(prev => [...prev, { file: file.name, reason: 'Duplicate record', name: record.name || 'Unknown' }]);
          } else {
            savedCount++;
            // Track if record has missing fields (for info only, still saved)
            const expectedFields = ['name', 'childNumber', 'gender', 'dateOfBirth', 'classOfStudy', 'center', 'yearOfAdmission'];
            const missingFields = expectedFields.filter(field => !record[field as keyof typeof record]);
            if (missingFields.length > 0) {
              partialCount++;
              console.log(`Saved partial record from ${file.name}: missing ${missingFields.join(', ')}`);
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Error saving record ${index + 1} from ${file.name}:`, error);
          setSkippedRecords(prev => [...prev, { file: file.name, reason: errorMsg, name: record.name || 'Unknown' }]);
        }
      }

      console.log(`Processed ${file.name}:`, {
        totalRecords: results.length,
        saved: savedCount,
        partialRecords: partialCount,
        duplicates: duplicateCount
      });

      return {
        saved: savedCount,
        skipped: 0, // No longer skipping for missing fields
        duplicates: duplicateCount,
        partial: partialCount
      };
    } catch (error: any) {
      if (error.message === 'STOPPED') {
        return { saved: 0, skipped: 0, duplicates: 0, stopped: true };
      }
      console.error(`Error processing file ${file.name}:`, error);
      setSkippedRecords(prev => [...prev, { file: file.name, reason: 'Processing error' }]);
      return {
        saved: 0,
        skipped: 1,
        duplicates: 0
      };
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length) return;

    // Reset stop flag
    isStoppedRef.current = false;
    isPausedRef.current = false;

    setIsProcessing(true);
    setIsPaused(false);
    setOverallProgress(0);
    setFileQueueInfo({ current: 0, total: files.length });

    let totalSaved = 0;
    let totalSkipped = 0;
    let totalDuplicates = 0;
    let totalPartial = 0;
    let wasStopped = false;

    try {
      for (let i = 0; i < files.length; i++) {
        // Check if stopped before each file
        if (isStoppedRef.current) {
          wasStopped = true;
          break;
        }

        const result = await processSingleFile(files[i], i, files.length);

        if (result.stopped) {
          wasStopped = true;
          totalSaved += result.saved || 0;
          totalDuplicates += result.duplicates || 0;
          break;
        }

        totalSaved += result.saved || 0;
        totalSkipped += result.skipped || 0;
        totalDuplicates += result.duplicates || 0;
        totalPartial += (result as any).partial || 0;

        // Update progress after completing each file
        updateOverallProgress(i + 1, files.length, 0);
      }

      // Set final progress
      if (!wasStopped) {
        setOverallProgress(100);
      }

      // Show final status
      let statusMsg = wasStopped
        ? `⏹ Stopped. Saved: ${totalSaved}`
        : `✓ Processed ${files.length} file(s). Saved: ${totalSaved}`;

      if (totalPartial > 0) statusMsg += ` (${totalPartial} partial)`;
      if (totalDuplicates > 0) statusMsg += `, Duplicates: ${totalDuplicates}`;
      if (totalSkipped > 0) statusMsg += `, Errors: ${totalSkipped}`;
      setStatus(statusMsg);

      console.log('Processing complete:', {
        totalFiles: files.length,
        totalSaved,
        totalSkipped,
        totalDuplicates,
        totalPartial,
        wasStopped
      });

      // Refresh records if any were saved
      if (totalSaved > 0 && onUploadComplete) {
        onUploadComplete();
      }
    } catch (err: any) {
      console.error('Processing error:', err);
      setStatus("Error: " + (err.message || "An unknown error occurred."));
    } finally {
      setIsProcessing(false);
      setIsPaused(false);
      isPausedRef.current = false;
      isStoppedRef.current = false;
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleButtonClick = () => {
    if (fileInputRef.current && !isProcessing) {
      fileInputRef.current.click();
    }
  };

  const handlePause = () => {
    if (isProcessing && !isPaused) {
      isPausedRef.current = true;
      setIsPaused(true);
      setStatus(prev => prev.endsWith('(Paused)') ? prev : `${prev} (Paused)`);
    }
  };

  const handleResume = () => {
    if (isProcessing && isPaused) {
      isPausedRef.current = false;
      setIsPaused(false);
      setStatus(prev => prev.replace(/\s*\(Paused\)$/, '').trim());
    }
  };

  const handleStop = () => {
    if (isProcessing) {
      isStoppedRef.current = true;
      isPausedRef.current = false; // Unpause to allow loop to exit
      setIsPaused(false);
      setStatus(prev => prev.replace(/\s*\(Paused\)$/, '').trim() + ' (Stopping...)');
    }
  };

  const clearSkippedRecords = () => {
    setSkippedRecords([]);
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

      {isProcessing && (
        <>
          {!isPaused ? (
            <button
              onClick={handlePause}
              style={{ ...buttonStyle, backgroundColor: '#ffc107', color: '#333' }}
              title="Pause processing"
            >
              <FaPause /> Pause
            </button>
          ) : (
            <button
              onClick={handleResume}
              style={{ ...buttonStyle, backgroundColor: '#198754' }}
              title="Resume processing"
            >
              <FaPlay /> Resume
            </button>
          )}
          <button
            onClick={handleStop}
            style={{ ...buttonStyle, backgroundColor: '#dc3545' }}
            title="Stop processing completely"
          >
            <FaStop /> Stop
          </button>
        </>
      )}

      <p
        style={{
          marginTop: "15px",
          fontWeight: "bold",
          color: isProcessing
            ? (isPaused ? "#ffc107" : "#007bff")
            : status.startsWith('✓')
              ? "#28a745"
              : status.startsWith('⏹')
                ? "#dc3545"
                : "#333",
        }}
      >
        {status}
      </p>

      {/* Realistic Progress Bar */}
      {isProcessing && (
        <div style={progressBarContainerStyle}>
          <div
            style={{
              height: "100%",
              width: `${overallProgress}%`,
              backgroundColor: isPaused ? "#ffc107" : "#28a745",
              borderRadius: "10px",
              transition: "width 0.3s ease-in-out",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{
              color: overallProgress > 50 ? 'white' : '#333',
              fontSize: '12px',
              fontWeight: 'bold',
              position: 'absolute',
              width: '100%',
              textAlign: 'center'
            }}>
              {overallProgress}% — File {fileQueueInfo.current}/{fileQueueInfo.total}
              {isPaused && ' (Paused)'}
            </span>
          </div>
        </div>
      )}

      {/* Collapsible Skipped Records Panel */}
      {skippedRecords.length > 0 && (
        <div style={{
          marginTop: '20px',
          border: '1px solid #f5c6cb',
          borderRadius: '8px',
          backgroundColor: '#fff5f5',
          overflow: 'hidden'
        }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 15px',
              backgroundColor: '#f8d7da',
              cursor: 'pointer'
            }}
            onClick={() => setShowSkipped(!showSkipped)}
          >
            <h4 style={{ margin: 0, color: '#721c24', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {showSkipped ? <FaChevronUp /> : <FaChevronDown />}
              Skipped/Ignored Records ({skippedRecords.length})
            </h4>
            <button
              onClick={(e) => { e.stopPropagation(); clearSkippedRecords(); }}
              style={{
                ...buttonStyle,
                padding: '5px 10px',
                fontSize: '12px',
                backgroundColor: '#dc3545',
                marginRight: 0,
              }}
              title="Clear all skipped records"
            >
              <FaTimes /> Clear
            </button>
          </div>

          {showSkipped && (
            <ul style={{
              maxHeight: '250px',
              overflowY: 'auto',
              margin: 0,
              padding: '10px 15px 10px 35px',
              listStyle: 'none'
            }}>
              {skippedRecords.map((item, index) => (
                <li key={index} style={{
                  padding: '8px 0',
                  borderBottom: index < skippedRecords.length - 1 ? '1px solid #f5c6cb' : 'none',
                  color: '#856404'
                }}>
                  <strong style={{ color: '#721c24' }}>{item.file}</strong>
                  {item.name && <span style={{ color: '#666' }}> — {item.name}</span>}
                  <br />
                  <span style={{ fontSize: '13px', color: '#856404' }}>↳ {item.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
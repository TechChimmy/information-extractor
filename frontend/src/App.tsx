import React, { useState } from "react";
import UploadPDF from "./components/UploadPDFMulti";
import RecordsTable from "./components/RecordsTableSelectable";
import SheetsTabs from "./components/SheetsTabs";

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadComplete = () => {
    setRefreshKey(prev => prev + 1); // This will force a re-render and refresh the records
  };

  return (
    <div style={{fontFamily:"Arial, sans-serif", padding:20}}>
      <h1>Help With A Child – Dashboard</h1>
      <SheetsTabs>
        {({ sheetId }) => (
          <>
            <UploadPDF 
              key={`upload-${sheetId}-${refreshKey}`} 
              sheetId={sheetId} 
              onUploadComplete={handleUploadComplete} 
            />
            <RecordsTable key={`table-${sheetId}-${refreshKey}`} sheetId={sheetId} />
          </>
        )}
      </SheetsTabs>
    </div>
  );
}
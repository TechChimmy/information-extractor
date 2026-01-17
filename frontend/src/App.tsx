import React from "react";
import UploadPDF from "./components/UploadPDFMulti";
import RecordsTable from "./components/RecordsTableSelectable";
import SheetsTabs from "./components/SheetsTabs";

export default function App() {
  return (
    <div style={{fontFamily:"Arial, sans-serif", padding:20}}>
      <h1>Help With A Child – Dashboard</h1>
      <SheetsTabs>
        {({ sheetId }) => (
          <>
            <UploadPDF sheetId={sheetId} />
            <RecordsTable sheetId={sheetId} />
          </>
        )}
      </SheetsTabs>
    </div>
  );
}

import React from "react";
import UploadPDF from "./components/UploadPDF";
import RecordsTable from "./components/RecordsTable";

export default function App() {
  return (
    <div style={{fontFamily:"Arial, sans-serif", padding:20}}>
      <h1>Help With A Child – Dashboard</h1>
      <UploadPDF />
      <RecordsTable />
    </div>
  );
}

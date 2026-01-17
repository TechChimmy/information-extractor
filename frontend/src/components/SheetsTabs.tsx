import React, { useEffect, useState } from "react";
import { getSheets, createSheet, renameSheet, deleteSheet } from "../apiSheets";

type Sheet = { id: string; name: string; createdAt?: string; updatedAt?: string };

export default function SheetsTabs({
  children,
}: {
  children: (ctx: { sheetId: string }) => React.ReactNode;
}) {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await getSheets();
    setSheets(data);
    if (data.length) {
      setActiveId((prev) => (prev && data.some(s => s.id === prev) ? prev : data[0].id));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const onAdd = async () => {
    const name = prompt("New sheet name:", "Sheet " + (sheets.length + 1));
    if (!name) return;
    await createSheet(name.trim());
    await load();
  };

  const onRename = async (sheet: Sheet) => {
    const name = prompt("Rename sheet:", sheet.name);
    if (!name || name.trim() === sheet.name) return;
    await renameSheet(sheet.id, name.trim());
    await load();
  };

  const onDelete = async (sheet: Sheet) => {
    if (!confirm(`Delete sheet "${sheet.name}" and ALL its records?`)) return;
    await deleteSheet(sheet.id);
    await load();
  };

  if (loading) return <div style={{ padding: 12 }}>Loading sheets...</div>;
  if (!sheets.length) return (
    <div style={{ padding: 12 }}>
      <div style={{ marginBottom: 12 }}>No sheets yet.</div>
      <button onClick={onAdd} style={btn()}>+ Add Sheet</button>
    </div>
  );

  return (
    <div>
      <div style={tabsBar()}>
        {sheets.map((s) => (
          <div key={s.id} style={tab(s.id === activeId)}>
            <button onClick={() => setActiveId(s.id)} style={tabBtn(s.id === activeId)} title={s.name}>{s.name}</button>
            <button onClick={() => onRename(s)} style={iconBtn()} title="Rename">✏️</button>
            <button onClick={() => onDelete(s)} style={iconBtn()} title="Delete">🗑️</button>
          </div>
        ))}
        <button onClick={onAdd} style={{ ...btn(), marginLeft: 8 }}>+ Add Sheet</button>
      </div>

      {activeId && (
        <div style={{ marginTop: 16 }}>
          {children({ sheetId: activeId })}
        </div>
      )}
    </div>
  );
}

// Styles
const btn = (): React.CSSProperties => ({
  padding: "6px 10px",
  background: "#007bff",
  border: "none",
  color: "#fff",
  borderRadius: 4,
  cursor: "pointer",
});

const tabsBar = (): React.CSSProperties => ({
  display: "flex",
  gap: 6,
  alignItems: "center",
  borderBottom: "1px solid #ddd",
  padding: "8px 12px",
  flexWrap: "wrap",
});

const tab = (active: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: 4,
  borderRadius: 6,
  background: active ? "#e6f0ff" : "transparent",
});

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: "6px 10px",
  background: active ? "#0b5ed7" : "#3b82f6",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
});

const iconBtn = (): React.CSSProperties => ({
  padding: "4px 6px",
  background: "#f3f4f6",
  border: "1px solid #e5e7eb",
  borderRadius: 4,
  cursor: "pointer",
});

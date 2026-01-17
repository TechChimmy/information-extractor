import React, { useEffect, useState, useMemo, useRef } from "react";
import { jsPDF } from "jspdf"; 
import html2canvas from "html2canvas";
import { 
    FaEye, FaTrash, FaEdit, FaTimes, FaSave, 
    FaChevronLeft, FaChevronRight, FaFilePdf, FaSearch, FaFilter 
} from "react-icons/fa"; 
import { getRecords, deleteRecord, updateRecord, deleteAllRecords, downloadExcel as apiDownloadExcel } from "../api";
import { getSheetRecords, downloadSheetExcel } from "../apiSheets";
import { ChildData } from "../lib/ocr";
import ConfirmDialog from "./ConfirmDialog"; 

const RECORDS_PER_PAGE = 15;
const MAX_RECORDS = 250; // cap total entries across pagination
const PAGE_WINDOW_SIZE = 4;

interface RecordWithId extends ChildData {
    id: string; 
}

// --- STYLES ---
const actionButtonStyle: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: "4px",
    border: "none",
    color: "white",
    cursor: "pointer",
    fontSize: "14px",
    marginLeft: "5px",
    display: "inline-flex",
    alignItems: "center",
    transition: "opacity 0.2s",
};

const searchContainerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '20px'
};

const inputGroupStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#fff',
    border: '1px solid #ccc',
    borderRadius: '4px',
    padding: '4px 10px',
};

const selectStyle: React.CSSProperties = {
    border: 'none',
    outline: 'none',
    padding: '5px',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    borderRight: '1px solid #eee',
    marginRight: '5px'
};

const searchInputStyle: React.CSSProperties = {
    border: 'none',
    outline: 'none',
    padding: '8px',
    width: '200px',
};

const tableStyle: React.CSSProperties = { borderCollapse: "separate", borderSpacing: 0, width: "100%", boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)", borderRadius: "8px", overflow: "hidden", marginTop: "10px" };
const thStyle: React.CSSProperties = { backgroundColor: "#007bff", color: "white", padding: "12px 15px", textAlign: "left", fontWeight: "600" };
const tdStyle: React.CSSProperties = { padding: "10px 15px", borderBottom: "1px solid #ccc", backgroundColor: "white" };
const getRowStyle = (isEven: boolean): React.CSSProperties => ({ backgroundColor: isEven ? '#eef2f5' : 'white', transition: 'background-color 0.2s', cursor: 'default' });

// --- MODAL COMPONENT ---
const ViewEditModal: React.FC<{record: RecordWithId, onClose: () => void, isEditing: boolean, onSave: (r: RecordWithId) => void}> = ({ record, onClose, isEditing, onSave }) => {
    const [formData, setFormData] = useState<RecordWithId>(record);
    const handleChange = (e: any) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const fields = [
        { label: "Child Name", key: "name", editable: true },
        { label: "Child Number", key: "childNumber", editable: true },
        { label: "Gender", key: "gender", type: "select", options: ["Male", "Female", ""], editable: true },
        { label: "Date of Birth", key: "dateOfBirth", editable: true },
        { label: "Class of Study", key: "classOfStudy", editable: true },
        { label: "Center", key: "center", editable: true },
        { label: "Year of Admission", key: "yearOfAdmission", editable: true },
        { label: "Background", key: "background", editable: true, isTextArea: true }, 
    ];
    return (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000}}>
            <div style={{backgroundColor:'white', padding:'30px', borderRadius:'8px', width:'90%', maxWidth:'600px', position:'relative', maxHeight:'90vh', overflowY:'auto'}}>
                <button onClick={onClose} style={{position:'absolute', top:'10px', right:'10px', background:'transparent', border:'none', fontSize:'24px', cursor:'pointer', color:'#333'}}><FaTimes /></button>
                <h3>{isEditing ? "Edit Record" : "Child Details"}</h3>
                {fields.map(f => (
                    <div key={f.key} style={{marginBottom:'15px', display:'flex', flexDirection:'column'}}>
                        <label style={{fontWeight:'bold', marginBottom:'5px', color:'#555'}}>{f.label}:</label>
                        {isEditing ? (
                            // @ts-ignore
                            f.type === "select" ? (
                                // @ts-ignore
                                <select name={f.key} value={(formData as any)[f.key]} onChange={handleChange} style={{padding:'8px', border:'1px solid #ddd', borderRadius:'4px'}}>{f.options?.map((o: string) => <option key={o} value={o}>{o || 'N/A'}</option>)}</select>
                            ) : // @ts-ignore
                            f.isTextArea ? (
                                <textarea name={f.key} value={(formData as any)[f.key]} onChange={handleChange} rows={4} style={{padding:'8px', border:'1px solid #ddd', borderRadius:'4px', resize:'vertical'}} />
                            ) : (
                                <input name={f.key} value={(formData as any)[f.key]} onChange={handleChange} style={{padding:'8px', border:'1px solid #ddd', borderRadius:'4px'}} />
                            )
                        ) : <p style={{padding:'8px 0', borderBottom:'1px dotted #ccc', whiteSpace:'pre-wrap'}}>{(formData as any)[f.key]}</p>}
                    </div>
                ))}
                {isEditing && <button onClick={() => onSave(formData)} style={{...actionButtonStyle, backgroundColor: "#28a745", marginTop: "20px"}}><FaSave style={{marginRight: "5px"}}/> Save Changes</button>}
            </div>
        </div>
    );
};

export default function RecordsTableSelectable({ sheetId }: { sheetId?: string }) {
    const [rows, setRows] = useState<RecordWithId[]>([]); 
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<RecordWithId | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [confirmDeleteSelectedOpen, setConfirmDeleteSelectedOpen] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState("");
    const [filterColumn, setFilterColumn] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const tableRef = useRef<HTMLTableElement>(null); 

    const fetchRecords = async () => {
        setIsLoading(true);
        const data = sheetId ? await getSheetRecords(sheetId) : await getRecords();
        // Cap overall records to MAX_RECORDS (newest first retained)
        setRows((data as RecordWithId[]).slice(0, MAX_RECORDS)); 
        setIsLoading(false);
        setSelectedIds(new Set());
    };

    useEffect(() => { fetchRecords(); }, [sheetId]);

    // Reset pagination and selection when switching tabs
    useEffect(() => {
        setCurrentPage(1);
        setSelectedIds(new Set());
    }, [sheetId]);

    const filteredRows = useMemo(() => {
        let list = [...rows].reverse();
        if (!searchTerm) return list;
        return list.filter(row => {
            const term = searchTerm.toLowerCase();
            if (filterColumn === "all") {
                return Object.values(row).some(val => String(val).toLowerCase().includes(term));
            } else {
                return String((row as any)[filterColumn] || "").toLowerCase().includes(term);
            }
        });
    }, [rows, searchTerm, filterColumn]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, filterColumn]);

    const totalRecords = filteredRows.length;
    const totalPages = Math.ceil(totalRecords / RECORDS_PER_PAGE);
    const startIndex = (currentPage - 1) * RECORDS_PER_PAGE;
    const displayRows = filteredRows.slice(startIndex, startIndex + RECORDS_PER_PAGE);

    const handleView = (r: RecordWithId) => { setSelectedRecord(r); setIsEditing(false); setIsModalOpen(true); };
    const handleEdit = (r: RecordWithId) => { setSelectedRecord(r); setIsEditing(true); setIsModalOpen(true); };
    const handleDelete = (id: string) => { setDeleteId(id); };
    const handleSave = async (r: RecordWithId) => { await updateRecord(r); setIsModalOpen(false); await fetchRecords(); };

    const handleDownloadPDF = async () => {
        const table = tableRef.current; if (!table) return;
        await new Promise(r => setTimeout(r, 0));
        const canvas = await html2canvas(table, { scale: 2, logging: false, useCORS: true, backgroundColor: "#ffffff", removeContainer: true });
        const pdf = new jsPDF("p", "mm", "a4");
        const imgWidth = 210; const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight; let position = 0;
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= 297;
        while (heightLeft > 0) { position = heightLeft - imgHeight; pdf.addPage(); pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, position, imgWidth, imgHeight); heightLeft -= 297; }
        pdf.save(`records_page_${currentPage}.pdf`);
    };

    const confirmDelete = async () => {
        if (!deleteId) return; await deleteRecord(deleteId); setDeleteId(null); await fetchRecords();
    };
    const cancelDelete = () => setDeleteId(null);

    const handleDeleteAll = () => setConfirmDeleteAllOpen(true);
    const confirmDeleteAll = async () => { await deleteAllRecords(); setConfirmDeleteAllOpen(false); await fetchRecords(); };
    const cancelDeleteAll = () => setConfirmDeleteAllOpen(false);

    const handleDownloadExcel = async () => {
        const blob = sheetId ? await downloadSheetExcel(sheetId) : await apiDownloadExcel();
        const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = sheetId ? "records_sheet.xlsx" : "records.xlsx"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    };

    const isAllPageSelected = displayRows.length > 0 && displayRows.every(r => selectedIds.has(r.id));
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    };
    const toggleSelectAllCurrentPage = () => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            const allSelected = displayRows.every(r => next.has(r.id));
            if (allSelected) { displayRows.forEach(r => next.delete(r.id)); }
            else { displayRows.forEach(r => next.add(r.id)); }
            return next;
        });
    };

    if (isLoading) return <div style={{padding:20}}>Loading existing records...</div>;

    return (
        <div style={{padding:20}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h2>Existing Records ({totalRecords})</h2>
                <div style={searchContainerStyle}>
                    <div style={inputGroupStyle}>
                        <FaFilter style={{color: '#888', marginRight: '5px'}} />
                        <select style={selectStyle} value={filterColumn} onChange={(e) => setFilterColumn(e.target.value)}>
                            <option value="all">All Columns</option>
                            <option value="name">Name</option>
                            <option value="childNumber">Child#</option>
                            <option value="center">Centre</option>
                            <option value="classOfStudy">Class</option>
                            <option value="yearOfAdmission">Year</option>
                            <option value="pdfName">PDF Name</option>
                        </select>
                        <FaSearch style={{color: '#888', marginLeft: '5px'}} />
                        <input type="text" placeholder="Search records..." style={searchInputStyle} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </div>
            </div>

            <div style={{display:"flex", gap:8, margin:"12px 0"}}>
                <button onClick={() => setConfirmDeleteSelectedOpen(true)} disabled={selectedIds.size === 0} style={{...actionButtonStyle, backgroundColor: "#b91c1c", opacity: selectedIds.size === 0 ? 0.6 : 1}}>Delete Selected</button>
                <button onClick={handleDeleteAll} style={{...actionButtonStyle, backgroundColor:"#dc2626"}}>Delete All</button>
            </div>
            
            <table style={tableStyle} ref={tableRef}>
                <thead>
                    <tr>
                        <th style={{...thStyle, width: '40px'}}>
                            <input type="checkbox" checked={isAllPageSelected} onChange={toggleSelectAllCurrentPage} />
                        </th>
                        <th style={{...thStyle, borderTopLeftRadius: '8px', width: '50px'}}>S. No.</th>
                        <th style={thStyle}>Name</th>
                        <th style={thStyle}>Child#</th>
                        <th style={thStyle}>Gender</th>
                        <th style={thStyle}>DOB</th>
                        <th style={thStyle}>Class</th>
                        <th style={thStyle}>Centre</th>
                        <th style={thStyle}>Year</th>
                        <th style={thStyle}>PDF Name</th>
                        <th style={{...thStyle, borderTopRightRadius: '8px', width: '150px'}}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {displayRows.length > 0 ? displayRows.map((r, i) => (
                        <tr key={r.id} style={getRowStyle(i % 2 === 0)}>
                            <td style={tdStyle}>
                                <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} />
                            </td>
                            <td style={tdStyle}>{startIndex + i + 1}</td>
                            <td style={tdStyle}>{r.name}</td>
                            <td style={tdStyle}>{r.childNumber}</td>
                            <td style={tdStyle}>{r.gender}</td>
                            <td style={tdStyle}>{r.dateOfBirth}</td>
                            <td style={tdStyle}>{r.classOfStudy}</td>
                            <td style={tdStyle}>{r.center}</td>
                            <td style={tdStyle}>{r.yearOfAdmission}</td>
                            <td style={tdStyle}>{(r as any).pdfName || '-'}</td>
                            <td style={tdStyle}>
                                <button onClick={() => handleView(r)} style={{...actionButtonStyle, backgroundColor: "#007bff"}} title="View"><FaEye /></button>
                                <button onClick={() => handleEdit(r)} style={{...actionButtonStyle, backgroundColor: "#ffc107"}} title="Edit"><FaEdit /></button>
                                <button onClick={() => handleDelete(r.id)} style={{...actionButtonStyle, backgroundColor: "#dc3545"}} title="Delete"><FaTrash /></button>
                            </td>
                        </tr>
                    )) : (
                        <tr><td colSpan={11} style={{...tdStyle, textAlign:'center', padding: '40px'}}>No records matching your search.</td></tr>
                    )}
                </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                <button onClick={handleDownloadPDF} style={{...actionButtonStyle, backgroundColor: "#dc3545", padding: '10px 15px', marginLeft: 0}}>
                    <FaFilePdf style={{marginRight: "8px"}} /> Download PDF
                </button>
                <button onClick={handleDownloadExcel} style={{...actionButtonStyle, backgroundColor: "#16a34a", padding: '10px 15px'}}>Download Excel</button>

                {totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} style={{...actionButtonStyle, backgroundColor: "#007bff", opacity: currentPage === 1 ? 0.5 : 1}}><FaChevronLeft /></button>
                        {Array.from({ length: Math.min(PAGE_WINDOW_SIZE, totalPages) }, (_, i) => {
                             const start = Math.floor((currentPage - 1) / PAGE_WINDOW_SIZE) * PAGE_WINDOW_SIZE + 1;
                             const page = start + i;
                             return page <= totalPages ? (
                                <button key={page} onClick={() => setCurrentPage(page)} style={{...actionButtonStyle, backgroundColor: currentPage === page ? "#0056b3" : "#007bff", fontWeight: currentPage === page ? 'bold' : 'normal'}}>{page}</button>
                             ) : null;
                        })}
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} style={{...actionButtonStyle, backgroundColor: "#007bff", opacity: currentPage === totalPages ? 0.5 : 1}}><FaChevronRight /></button>
                    </div>
                )}
            </div>
            
            {isModalOpen && selectedRecord && <ViewEditModal record={selectedRecord} onClose={() => setIsModalOpen(false)} isEditing={isEditing} onSave={handleSave} />}
            <ConfirmDialog
            open={deleteId !== null}
            title="Delete record?"
            message="This action cannot be undone."
            confirmText="Delete"
            onConfirm={confirmDelete}
            onCancel={cancelDelete}
            />

            <ConfirmDialog
            open={confirmDeleteAllOpen}
            title="Delete ALL records?"
            message="This will permanently remove all records. This action cannot be undone."
            confirmText="Delete All"
            onConfirm={confirmDeleteAll}
            onCancel={cancelDeleteAll}
            />  

            <ConfirmDialog
            open={confirmDeleteSelectedOpen}
            title="Delete selected records?"
            message={`This will delete ${selectedIds.size} selected record(s). This action cannot be undone.`}
            confirmText="Delete Selected"
            onConfirm={async () => {
                const ids = Array.from(selectedIds);
                for (const id of ids) { try { await deleteRecord(id); } catch {} }
                setConfirmDeleteSelectedOpen(false);
                setSelectedIds(new Set());
                await fetchRecords();
            }}
            onCancel={() => setConfirmDeleteSelectedOpen(false)}
            />  
        </div>
    );
}

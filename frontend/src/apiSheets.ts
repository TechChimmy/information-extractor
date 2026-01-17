import axios from "axios";

const API = axios.create({ baseURL: "http://127.0.0.1:5000" });

export const getSheets = async () => {
  const res = await API.get("/sheets");
  return res.data as Array<{ id: string; name: string; createdAt: string; updatedAt: string }>;
};

export const createSheet = async (name: string) => {
  const res = await API.post("/sheets", { name });
  return res.data as { id: string; name: string };
};

export const renameSheet = async (id: string, name: string) => {
  const res = await API.patch(`/sheets/${id}`, { name });
  return res.data;
};

export const deleteSheet = async (id: string) => {
  const res = await API.delete(`/sheets/${id}`);
  return res.data;
};

export const getSheetRecords = async (sheetId: string) => {
  const res = await API.get(`/sheets/${sheetId}/records`);
  return res.data;
};

export const postSheetRecord = async (sheetId: string, record: any) => {
  const res = await API.post(`/sheets/${sheetId}/records`, record);
  return res.data;
};

export const downloadSheetExcel = async (sheetId: string): Promise<Blob> => {
  const res = await API.get(`/export/excel?sheetId=${encodeURIComponent(sheetId)}`, { responseType: "blob" });
  return res.data as Blob;
};

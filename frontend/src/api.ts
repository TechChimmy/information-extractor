// // frontend/src/api.ts

import axios from "axios";

const API = axios.create({ baseURL: "http://127.0.0.1:5000" });

export const postRecord = async (record: any) => {
  const res = await API.post("/upload", record);
  return res.data;
};

export const getRecords = async () => {
  const res = await API.get("/records");
  return res.data;
};

/**
 * Deletes a record by its unique ID.
 * Assumes the backend endpoint is DELETE /records/:id
 */
export const deleteRecord = async (id: string) => {
  const res = await API.delete(`/records/${id}`);
  return res.data;
};

/**
 * Updates an existing record.
 * Assumes the backend endpoint is PUT /records/:id and the record object contains the ID.
 */
export const updateRecord = async (record: any) => {
  // The ChildData object passed from RecordsTable.tsx is assumed to contain the 'id' field.
  const res = await API.put(`/records/${record.id}`, record);
  return res.data;
};

export const deleteAllRecords = async () => {
  const res = await API.delete("/records");
  return res.data;
};

export const downloadExcel = async (): Promise<Blob> => {
  const res = await API.get("/export/excel", { responseType: "blob" });
  return res.data;
};
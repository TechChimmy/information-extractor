# from flask import Flask, request, jsonify
# from flask_cors import CORS
# import os, json
# import pandas as pd
# from pathlib import Path

# app = Flask(__name__)
# CORS(app)

# DATA_FILE = Path("records.json")
# EXCEL_FILE = Path("records.xlsx")
# UPLOADS = Path("uploads")
# UPLOADS.mkdir(exist_ok=True)

# if not DATA_FILE.exists():
#     DATA_FILE.write_text("[]", encoding="utf-8")

# def save_record(record):
#     arr = json.loads(DATA_FILE.read_text(encoding="utf-8"))
#     arr.insert(0, record)  # newest first
#     DATA_FILE.write_text(json.dumps(arr, ensure_ascii=False, indent=2), encoding="utf-8")
#     # also update excel
#     df = pd.DataFrame(arr)
#     df.to_excel(EXCEL_FILE, index=False)

# @app.get("/")
# def home():
#     return "HelpAChild backend is running"

# @app.post("/upload")
# def upload():
#     # frontend sends parsed JSON (application/json)
#     data = request.get_json()
#     if not data:
#         return jsonify({"ok": False, "error": "no json received"}), 400
#     save_record(data)
#     return jsonify({"ok": True, "data": data})

# @app.get("/records")
# def records():
#     arr = json.loads(DATA_FILE.read_text(encoding="utf-8"))
#     return jsonify(arr)

# if __name__ == "__main__":
#     app.run(port=5000, debug=True)
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os, json
import pandas as pd
from pathlib import Path
import uuid  # <-- NEW: Import for generating unique IDs

app = Flask(__name__)
CORS(app)

DATA_FILE = Path("records.json")
EXCEL_FILE = Path("records.xlsx")
UPLOADS = Path("uploads")
UPLOADS.mkdir(exist_ok=True)
SHEETS_FILE = Path("sheets.json")

if not DATA_FILE.exists():
    DATA_FILE.write_text("[]", encoding="utf-8")
if not SHEETS_FILE.exists():
    SHEETS_FILE.write_text("[]", encoding="utf-8")

# --- CENTRALIZED FILE HANDLING FUNCTIONS ---

def _write_all_records(arr):
    """Writes all records to the JSON and updates the Excel file."""
    # 1. Write to JSON
    DATA_FILE.write_text(json.dumps(arr, ensure_ascii=False, indent=2), encoding="utf-8")
    
    # 2. Update Excel
    if arr:
        # Exclude the 'id' field from the Excel export for cleaner data
        df = pd.DataFrame(arr)
        if 'id' in df.columns:
            df = df.drop(columns=['id'])
    else:
        df = pd.DataFrame()
        
    df.to_excel(EXCEL_FILE, index=False)


def _read_all_records():
    """
    Reads all records from the JSON file. 
    Crucially, it checks for and assigns a persistent 'id' to older records
    that were created before the ID feature, preventing frontend crashes.
    """
    arr = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    needs_rewrite = False
    
    # Check all records for 'id' and assign one if missing
    for record in arr:
        if 'id' not in record:
            record['id'] = uuid.uuid4().hex  # Assign a unique ID
            needs_rewrite = True
            
    # If new IDs were assigned, rewrite the file to persist them
    if needs_rewrite:
        _write_all_records(arr)
        
    return arr


def _add_new_record(record):
    """Adds a unique ID and saves a new record to the list (newest first)."""
    arr = _read_all_records()
    
    # Add unique ID to the new record
    record['id'] = uuid.uuid4().hex
    
    # Insert the new record at the beginning (newest first)
    arr.insert(0, record)
    
    # Write all records back to files
    _write_all_records(arr)
    return record # Return the record with the new ID


# --- SHEETS HELPERS ---
def _read_sheets():
    try:
        return json.loads(SHEETS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []

def _write_sheets(sheets):
    SHEETS_FILE.write_text(json.dumps(sheets, ensure_ascii=False, indent=2), encoding="utf-8")


# --- ROUTES ---

@app.get("/")
def home():
    return "HelpAChild backend is running"

@app.post("/upload")
def upload():
    data = request.get_json()
    if not data:
        return jsonify({"ok": False, "error": "no json received"}), 400
        
    new_record_with_id = _add_new_record(data)
    return jsonify({"ok": True, "data": new_record_with_id})

@app.get("/records")
def records():
    arr = _read_all_records()
    return jsonify(arr)

# --- SHEETS ROUTES ---

@app.get("/sheets")
def list_sheets():
    return jsonify(_read_sheets())


@app.post("/sheets")
def create_sheet():
    data = request.get_json() or {}
    name = (data.get("name") or "Untitled").strip()
    sheets = _read_sheets()
    new_sheet = {
        "id": uuid.uuid4().hex,
        "name": name or "Untitled",
        "createdAt": pd.Timestamp.utcnow().isoformat(),
        "updatedAt": pd.Timestamp.utcnow().isoformat(),
    }
    sheets.append(new_sheet)
    _write_sheets(sheets)
    return jsonify(new_sheet), 201


@app.patch("/sheets/<string:sheet_id>")
def rename_sheet(sheet_id: str):
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    sheets = _read_sheets()
    found = False
    for s in sheets:
        if s.get("id") == sheet_id:
            if name:
                s["name"] = name
            s["updatedAt"] = pd.Timestamp.utcnow().isoformat()
            found = True
            break
    if not found:
        return jsonify({"ok": False, "error": "Sheet not found"}), 404
    _write_sheets(sheets)
    return jsonify({"ok": True})


@app.delete("/sheets/<string:sheet_id>")
def delete_sheet(sheet_id: str):
    # delete sheet entry
    sheets = _read_sheets()
    sheets_new = [s for s in sheets if s.get("id") != sheet_id]
    if len(sheets_new) == len(sheets):
        return jsonify({"ok": False, "error": "Sheet not found"}), 404
    _write_sheets(sheets_new)

    # cascade delete records belonging to this sheet
    arr = _read_all_records()
    arr_new = [r for r in arr if r.get('sheetId') != sheet_id]
    _write_all_records(arr_new)
    return jsonify({"ok": True})


@app.get("/sheets/<string:sheet_id>/records")
def list_sheet_records(sheet_id: str):
    arr = _read_all_records()
    filtered = [r for r in arr if r.get('sheetId') == sheet_id]
    return jsonify(filtered)


@app.post("/sheets/<string:sheet_id>/records")
def create_sheet_record(sheet_id: str):
    data = request.get_json()
    if not data:
        return jsonify({"ok": False, "error": "no json received"}), 400
    data['sheetId'] = sheet_id
    created = _add_new_record(data)
    return jsonify({"ok": True, "data": created})
# --- DELETE ALL ROUTE ---
@app.delete("/records")
def delete_all_records():
    """Deletes ALL records."""
    try:
        _write_all_records([])  # clears JSON and rewrites empty Excel
        return jsonify({"ok": True, "message": "All records deleted"}), 200
    except Exception as e:
        print(f"Error during DELETE ALL: {e}")
        return jsonify({"ok": False, "error": "Failed to delete all records"}), 500


# --- NEW CRUD ROUTES FOR EDIT AND DELETE ---

@app.route('/records/<string:id>', methods=['DELETE'])
def delete_record_route(id):
    """Handles deletion of a record by ID."""
    try:
        arr = _read_all_records()
        
        # Filter out the record with the matching ID
        arr_new = [r for r in arr if r.get('id') != id]
        
        if len(arr_new) == len(arr):
            # No record was deleted
            return jsonify({"ok": False, "error": "Record not found"}), 404
            
        _write_all_records(arr_new)
        return jsonify({"ok": True, "message": f"Record {id} deleted successfully"}), 200

    except Exception as e:
        print(f"Error during DELETE operation: {e}")
        return jsonify({"ok": False, "error": "Failed to delete record"}), 500

# --- EXPORT ROUTE ---
@app.get("/export/excel")
def export_excel():
    """Downloads Excel of all records or a single sheet if sheetId is provided."""
    try:
        sheet_id = request.args.get('sheetId')
        arr = _read_all_records()
        if sheet_id:
            arr = [r for r in arr if r.get('sheetId') == sheet_id]

        # Build a temp DataFrame and send as a file-like response
        if arr:
            df = pd.DataFrame(arr)
            if 'id' in df.columns:
                df = df.drop(columns=['id'])
        else:
            df = pd.DataFrame()

        # Write to a temporary file path
        tmp_path = EXCEL_FILE if not sheet_id else Path(f"records_{sheet_id}.xlsx")
        df.to_excel(tmp_path, index=False)
        download_name = "records.xlsx" if not sheet_id else "records_sheet.xlsx"
        return send_file(
            tmp_path,
            as_attachment=True,
            download_name=download_name,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except Exception as e:
        print(f"Error during Excel export: {e}")
        return jsonify({"ok": False, "error": "Failed to export"}), 500


# --- UPDATE ROUTE ---
@app.route('/records/<string:id>', methods=['PUT'])
def update_record_route(id):
    """Handles updating an existing record by ID."""
    data = request.get_json()
    if not data:
        return jsonify({"ok": False, "error": "No JSON data received for update"}), 400
        
    try:
        arr = _read_all_records()
        record_found = False
        
        # Iterate and replace the target record
        for i, record in enumerate(arr):
            if record.get('id') == id:
                # Replace the old record with the new data
                data['id'] = id # Ensure the ID is preserved
                arr[i] = data 
                record_found = True
                break

        if not record_found:
            return jsonify({"ok": False, "error": f"Record {id} not found for update"}), 404

        _write_all_records(arr)
        return jsonify({"ok": True, "data": data, "message": f"Record {id} updated successfully"}), 200

    except Exception as e:
        print(f"Error during PUT operation: {e}")
        return jsonify({"ok": False, "error": "Failed to update record"}), 500


if __name__ == "__main__":
    app.run(port=5000, debug=True)

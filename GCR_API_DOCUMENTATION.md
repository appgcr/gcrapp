# GCR — MASTER API SPECIFICATION & CONTRACTS
**Document ID:** `GCR_API_DOCUMENTATION.md`  
**Date:** November 4, 2026  
**Role:** Principal Software Architect, Backend Engineering Lead, and API Security Specialist  
**Base URL:** `http://localhost:5001/api` (Development) / `https://api.gcrvaluations.com/api` (Production)  

---

## 1. Authentication & Security Headers

All protected endpoints require a standard Bearer token in the `Authorization` header:
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
Accept: application/json
```

Token payload structure:
```json
{
  "id": "67246b9a89c9e802...",
  "username": "engineer1",
  "name": "Field Engineer One",
  "role": "ENGINEER",
  "iat": 1793780000,
  "exp": 1793866400
}
```

---

## 2. API Endpoints

### 2.1 Authentication (`/api/auth`)

#### `POST /api/auth/login`
- **Description:** Authenticate user and issue JWT token.
- **Access:** Public
- **Request Body:**
  ```json
  {
    "username": "admin",
    "password": "Password123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "67246b9a89c9e801...",
      "username": "admin",
      "name": "Super Admin",
      "role": "SUPER_ADMIN"
    }
  }
  ```
- **Errors:** `400 Bad Request` (Missing credentials), `401 Unauthorized` (Invalid username/password).

#### `GET /api/auth/me`
- **Description:** Retrieve current authenticated user session details.
- **Access:** `SUPER_ADMIN`, `ENGINEER`
- **Response (200 OK):** User profile object.

---

### 2.2 User Management (`/api/users`)

#### `GET /api/users`
- **Description:** Fetch all registered system users.
- **Access:** `SUPER_ADMIN` only. (Engineers receive `403 Forbidden`).

#### `POST /api/users`
- **Description:** Provision a new staff user.
- **Access:** `SUPER_ADMIN` only.
- **Request Body:**
  ```json
  {
    "username": "engineer_kadapa",
    "name": "R. Kumar",
    "password": "SecurePassword123!",
    "role": "ENGINEER",
    "mobile": "9876543210"
  }
  ```
- **Response (201 Created):** Created user object (excluding password hash).

#### `DELETE /api/users/:id`
- **Description:** Deactivate / delete a staff account.
- **Access:** `SUPER_ADMIN` only.

---

### 2.3 Valuation Case Lifecycle (`/api/cases`)

#### `GET /api/cases`
- **Description:** Fetch list of valuation cases.
- **Access:**
  - `SUPER_ADMIN`: Receives all cases across the system.
  - `ENGINEER`: Receives only cases where `assignedEngineerId === req.user.id`.
- **Query Parameters:** `status`, `bankName`, `search`, `page`, `limit`.

#### `POST /api/cases`
- **Description:** Super Admin creates and assigns a new valuation case.
- **Access:** `SUPER_ADMIN`
- **Validation Rule (Step 1):** Only 4 initial fields required. Bank selection is optional. No forced document upload.
- **Request Body:**
  ```json
  {
    "applicantName": "K. Venkateswarlu",
    "propertyLocation": "Plot 9, Sy No 176/2, Kadapa Municipal Corporation",
    "mobileNumber": "9876543210",
    "assignedEngineerId": "67246b9a89c9e802...",
    "bankName": "State Bank of India" // Optional
  }
  ```
- **Response (201 Created):** Case document with assigned sequential ID and status `Assigned`.

#### `GET /api/cases/:id`
- **Description:** Fetch full case details, inspection forms, legal documents, and calculation logs.
- **Access:** Authorized Admin or Assigned Engineer.

#### `PUT /api/cases/:id`
- **Description:** Update case details, save inspection progress, or update status.
- **Access:** Authorized Admin or Assigned Engineer.

#### `POST /api/cases/:id/submit`
- **Description:** Field engineer submits completed inspection with digital signature.
- **Access:** `ENGINEER`
- **Request Body:**
  ```json
  {
    "digitalSignature": "data:image/png;base64,iVBORw0KGgo...",
    "signatureTimestamp": "2026-11-04T10:00:00.000Z",
    "propertyDetails": { ... },
    "valuationData": { ... }
  }
  ```
- **Response (200 OK):** Case updated to `Completed (Under Review)` with calculation breakdown attached.

#### `POST /api/cases/:id/return`
- **Description:** Super Admin returns a case for corrections.
- **Access:** `SUPER_ADMIN`
- **Request Body:**
  ```json
  {
    "feedback": "Boundary mismatch on North side. Verify physical measurement vs deed."
  }
  ```
- **Response (200 OK):** Case updated to `Returned for Corrections` with feedback logged in case history.

#### `POST /api/cases/:id/approve`
- **Description:** Super Admin approves the case. Binds approval to version and generates immutable report archive.
- **Access:** `SUPER_ADMIN`
- **Response (200 OK):** Case status updated to `Approved` with `ReportArchive` record created.

#### `GET /api/cases/:id/report`
- **Description:** Download generated DOCX or PDF valuation report.
- **Access:** Authenticated Users.
- **Query Parameters:** `version` (e.g., `1`, `2`), `format` (`docx`, `pdf`).
- **Response:** File stream with `Content-Disposition` header.

---

### 2.4 Attendance & Field Tracking (`/api/attendance`)

#### `POST /api/attendance`
- **Description:** Record engineer attendance clock-in or clock-out.
- **Access:** `ENGINEER`
- **Request Body:**
  ```json
  {
    "userId": "67246b9a89c9e802...",
    "engineerName": "Field Engineer One",
    "type": "CLOCK_IN", // or "CLOCK_OUT"
    "latitude": 14.4674,
    "longitude": 78.8242,
    "accuracy": 8.5,
    "verificationMethod": "FACE_BIOMETRIC",
    "selfieUrl": "/uploads/attendance_selfies_1793738701667.jpg"
  }
  ```
- **Response (201 Created):** Attendance record with authoritative server timestamp.
- **Errors:** `400 Bad Request` if duplicate clock-in on same day.

#### `GET /api/attendance`
- **Description:** Fetch attendance logs.
- **Access:** `SUPER_ADMIN` (all logs) or `ENGINEER` (own logs).

---

### 2.5 Document Upload & Extraction (`/api/upload`, `/api/extract`)

#### `POST /api/upload`
- **Description:** Multipart file upload for documents, site photographs, and selfies.
- **Access:** `ENGINEER`, `SUPER_ADMIN`
- **Content-Type:** `multipart/form-data`
- **Response (200 OK):**
  ```json
  {
    "url": "/uploads/deeds/sale_deed_20261101.pdf",
    "filename": "sale_deed_20261101.pdf",
    "size": 1450230,
    "mimetype": "application/pdf"
  }
  ```

#### `POST /api/extract/ocr`
- **Description:** Process uploaded document through bilingual OCR and canonical normalizers.
- **Access:** Authenticated Users.
- **Request Body:**
  ```json
  {
    "documentUrl": "/uploads/deeds/sale_deed_20261101.pdf",
    "documentType": "SALE_DEED"
  }
  ```
- **Response (200 OK):** Normalized schema object (Deed No, Survey No, Plot No, Extent, Boundaries, Owner).

---

## 3. Error Code Catalog

| Error Code | HTTP Status | Description |
| :--- | :---: | :--- |
| `UNAUTHORIZED` | 401 | Missing, expired, or invalid JWT authentication token |
| `FORBIDDEN` | 403 | Authenticated role does not possess required privilege |
| `CASE_NOT_FOUND` | 404 | Case ID does not exist in the database |
| `DUPLICATE_KEY` | 400 | Unique index violation (e.g., duplicate caseId or attendance) |
| `ARCHIVE_FILE_MISSING` | 404 | Physical report binary or manifest is absent from persistent storage |
| `ARCHIVE_FILE_CORRUPTED` | 500 | Checksum mismatch between stored hash and physical file bytes |
| `ARCHIVE_MANIFEST_TAMPERED` | 403 | Cryptographic signature verification failed over manifest contents |
| `ARCHIVE_METADATA_INCONSISTENT` | 409 | Manifest on disk disagrees with database archive document |
| `ARCHIVE_KEY_UNKNOWN` | 500 | Manifest references an unknown or revoked signing key ID |
| `ARCHIVE_SECURITY_ERROR` | 500 | Active signing key is unconfigured in the environment keyring |
